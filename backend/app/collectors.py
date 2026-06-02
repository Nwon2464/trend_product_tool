from dataclasses import dataclass
from datetime import datetime, timezone
from html.parser import HTMLParser
from typing import Callable
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen
from urllib.robotparser import RobotFileParser
import json
import re
import xml.etree.ElementTree as ET

from sqlalchemy.orm import Session

from . import candidate_detector, crud, models, schemas

USER_AGENT = "TrendProductToolMVP/0.1"
MAX_RESPONSE_BYTES = 1_000_000
MAX_RAW_TEXT_CHARS = 2_000
MAX_DETAIL_FETCHES = 30
SKIP_LINK_TITLES = {
    "more",
    "read more",
    "click here",
    "こちら",
    "詳しくはこちら",
    "詳細",
    "もっと見る",
    "続きを読む",
}
SKIP_DETAIL_URL_PARTS = {
    "youtube.com",
    "twitter.com",
    "x.com",
    "/contact",
    "/policy",
    "/privacy",
    "/sitemap",
    "/link.html",
    "/login",
    "/register",
}


@dataclass(frozen=True)
class CollectedItem:
    title: str
    url: str
    raw_text: str | None


ProgressCallback = Callable[[str, str, str, dict | None], None]


def emit_progress(
    progress_callback: ProgressCallback | None,
    event_type: str,
    level: str,
    message: str,
    payload: dict | None = None,
) -> None:
    if progress_callback is not None:
        progress_callback(event_type, level, message, payload)


def normalize_text(value: str | None) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", value).strip()


def normalize_item_url(url: str, base_url: str) -> str | None:
    normalized_url = urljoin(base_url, normalize_text(url))
    parsed = urlparse(normalized_url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return None
    return parsed._replace(fragment="").geturl()


def build_collected_item(
    *,
    title: str,
    url: str,
    base_url: str,
    raw_text: str | None = None,
) -> CollectedItem | None:
    clean_title = normalize_text(title)
    normalized_url = normalize_item_url(url, base_url)
    if not clean_title or normalized_url is None:
        return None
    if clean_title.lower() in SKIP_LINK_TITLES:
        return None

    clean_raw_text = normalize_text(raw_text or clean_title)
    return CollectedItem(
        title=clean_title[:255],
        url=normalized_url,
        raw_text=clean_raw_text[:MAX_RAW_TEXT_CHARS] if clean_raw_text else None,
    )


class LinkParser(HTMLParser):
    def __init__(self, base_url: str) -> None:
        super().__init__()
        self.base_url = base_url
        self.page_title = ""
        self.links: list[CollectedItem] = []
        self._in_title = False
        self._current_href: str | None = None
        self._current_text: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "title":
            self._in_title = True
        if tag != "a":
            return
        attrs_dict = dict(attrs)
        href = attrs_dict.get("href")
        if href:
            linked_url = normalize_item_url(href, self.base_url)
            if linked_url is None:
                return
            self._current_href = linked_url
            self._current_text = []

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.page_title += data
        if self._current_href:
            self._current_text.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self._in_title = False
        if tag == "a" and self._current_href:
            title = " ".join(part.strip() for part in self._current_text if part.strip())
            item = build_collected_item(
                title=title,
                url=self._current_href,
                base_url=self.base_url,
                raw_text=title,
            )
            if item:
                self.links.append(item)
            self._current_href = None
            self._current_text = []


class DetailPageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.title = ""
        self.text_parts: list[str] = []
        self._in_title = False
        self._skip_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "title":
            self._in_title = True
        if tag in {"script", "style", "noscript", "svg"}:
            self._skip_depth += 1

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title += data
        if self._skip_depth == 0:
            clean_data = normalize_text(data)
            if clean_data:
                self.text_parts.append(clean_data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self._in_title = False
        if tag in {"script", "style", "noscript", "svg"} and self._skip_depth > 0:
            self._skip_depth -= 1

    @property
    def body_text(self) -> str:
        return normalize_text(" ".join(self.text_parts))


def run_collector(
    db: Session,
    *,
    source: models.Source,
    max_items: int,
    max_candidates: int,
    respect_robots: bool,
    minimum_interval_seconds: int,
    selected_statuses: list[str] | None = None,
    progress_callback: ProgressCallback | None = None,
) -> schemas.CollectorRunResponse:
    now = datetime.now(timezone.utc)
    emit_progress(
        progress_callback,
        "check",
        "info",
        f"Collector started: {source.source_name}",
        {"source_id": source.id, "source_url": source.url},
    )
    collection_run = crud.create_collection_run(
        db,
        source_id=source.id,
        fetched_url=source.url,
        selected_statuses=json.dumps(selected_statuses or [], ensure_ascii=False),
        started_at=now,
    )
    emit_progress(progress_callback, "check", "info", "Checking minimum interval")
    latest_log = crud.get_latest_source_log(db, source.id)
    if latest_log is not None and minimum_interval_seconds > 0:
        elapsed = (now.replace(tzinfo=None) - latest_log.detected_at.replace(tzinfo=None)).total_seconds()
        if elapsed < minimum_interval_seconds:
            next_retry_seconds = max(0, int(minimum_interval_seconds - elapsed))
            emit_progress(
                progress_callback,
                "skip",
                "warn",
                f"直近で取得済みのためスキップ。次回取得まで {next_retry_seconds}秒",
                {
                    "reason": "minimum_interval",
                    "details": "Recently collected source",
                    "next_retry_seconds": next_retry_seconds,
                },
            )
            crud.finish_collection_run(
                db,
                collection_run,
                status="skipped",
                finished_at=datetime.now(timezone.utc),
                skipped_reason="minimum_interval",
            )
            return schemas.CollectorRunResponse(
                collection_run_id=collection_run.id,
                source_id=source.id,
                fetched_url=source.url,
                created_count=0,
                skipped_count=0,
                skipped_reason="minimum_interval",
                skipped_details=[f"minimum_interval:{next_retry_seconds}"],
                logs=[],
            )

    if respect_robots:
        emit_progress(progress_callback, "check", "info", "Checking robots.txt")
    if respect_robots and not is_allowed_by_robots(source.url):
        emit_progress(
            progress_callback,
            "skip",
            "warn",
            "robots.txt によりスキップ",
            {
                "reason": "robots_disallow",
                "details": "robots.txt disallowed this URL",
            },
        )
        crud.finish_collection_run(
            db,
            collection_run,
            status="skipped",
            finished_at=datetime.now(timezone.utc),
            skipped_reason="robots_disallow",
        )
        return schemas.CollectorRunResponse(
            collection_run_id=collection_run.id,
            source_id=source.id,
            fetched_url=source.url,
            created_count=0,
            skipped_count=0,
            skipped_reason="robots_disallow",
            skipped_details=["robots_disallow"],
            logs=[],
    )

    try:
        emit_progress(progress_callback, "fetch", "info", f"HTML取得開始: {source.url}", {"url": source.url})
        content, content_type = fetch_url(source.url)
        emit_progress(
            progress_callback,
            "fetch",
            "success",
            "HTML取得完了",
            {"content_type": content_type, "bytes": len(content)},
        )
        emit_progress(progress_callback, "parse", "info", "本文解析開始")
        parsed_items = parse_content(content, content_type, source.url)
        emit_progress(progress_callback, "parse", "success", "本文解析完了", {"items": len(parsed_items)})
        items = dedupe_collected_items(parsed_items)
        if is_html_content(content_type, source.url):
            emit_progress(progress_callback, "detail_fetch", "info", "詳細ページ取得開始", {"items": len(items)})
            items = list_to_detail_items(
                items,
                source_url=source.url,
                respect_robots=respect_robots,
                max_detail_fetches=min(
                    MAX_DETAIL_FETCHES,
                    max(max_items, max_candidates) * 3,
                ),
                progress_callback=progress_callback,
            )
            emit_progress(progress_callback, "detail_fetch", "success", "詳細ページ取得完了", {"items": len(items)})
        if not items:
            emit_progress(
                progress_callback,
                "skip",
                "warn",
                "対象候補なし",
                {
                    "reason": "no_usable_items",
                    "details": "No product opportunity signal detected",
                },
            )
            crud.finish_collection_run(
                db,
                collection_run,
                status="skipped",
                finished_at=datetime.now(timezone.utc),
                skipped_reason="no_usable_items",
            )
            return schemas.CollectorRunResponse(
                collection_run_id=collection_run.id,
                source_id=source.id,
                fetched_url=source.url,
                created_count=0,
                skipped_count=0,
                skipped_reason="no_usable_items",
                skipped_details=["no_usable_items"],
                logs=[],
            )

        created_logs: list[models.SourceLog] = []
        created_candidates: list[models.ProductCandidate] = []
        skipped_count = 0
        skipped_details: list[str] = []
        candidate_limit_reached = False
        active_keywords = crud.list_active_keywords(db)
        for item in items:
            if len(created_logs) >= max_items:
                break
            if len(created_candidates) >= max_candidates:
                candidate_limit_reached = True
                break
            if selected_statuses:
                has_signal = candidate_detector.has_selected_status_signal(
                    title=item.title,
                    raw_text=item.raw_text,
                    url=item.url,
                    source=source,
                    selected_statuses=selected_statuses,
                    db_keywords=active_keywords,
                )
            else:
                has_signal = candidate_detector.has_product_opportunity_signal(
                    title=item.title,
                    raw_text=item.raw_text,
                    url=item.url,
                    source=source,
                    db_keywords=active_keywords,
                )
            if not has_signal:
                skipped_count += 1
                skipped_details.append(f"not_selected_opportunity: {item.url}")
                continue
            emit_progress(
                progress_callback,
                "keyword",
                "info",
                f"商品候補シグナル検出: {item.title}",
                {"url": item.url, "title": item.title},
            )
            if crud.get_source_log_by_url(db, source_id=source.id, url=item.url) is not None:
                skipped_count += 1
                skipped_details.append(f"duplicate_url: {item.url}")
                emit_progress(
                    progress_callback,
                    "skip",
                    "warn",
                    "重複URLのためスキップ",
                    {
                        "reason": "duplicate_url",
                        "details": "Already collected URL",
                        "url": item.url,
                    },
                )
                continue
            if crud.get_product_candidate_by_source_url(db, item.url) is not None:
                skipped_count += 1
                skipped_details.append(f"duplicate_candidate_url: {item.url}")
                emit_progress(
                    progress_callback,
                    "skip",
                    "warn",
                    "重複URLのためスキップ",
                    {
                        "reason": "duplicate_url",
                        "details": "Already collected candidate URL",
                        "url": item.url,
                    },
                )
                continue

            created_log = crud.create_source_log(
                db,
                schemas.SourceLogCreate(
                    source_id=source.id,
                    title=item.title,
                    url=item.url,
                    raw_text=item.raw_text,
                    detected_at=now,
                ),
            )
            created_logs.append(created_log)
            emit_progress(
                progress_callback,
                "candidate",
                "info",
                "source_log を作成しました",
                {"source_log_id": created_log.id, "url": created_log.url},
            )
            candidate = candidate_detector.build_candidate_from_source_log(
                source=source,
                source_log=created_log,
                selected_statuses=selected_statuses,
                db_keywords=active_keywords,
            )
            if candidate and crud.get_product_candidate_by_source_url(db, candidate.source_url) is None:
                created_candidate = crud.create_product_candidate(db, candidate)
                created_candidates.append(created_candidate)
                emit_progress(
                    progress_callback,
                    "candidate",
                    "success",
                    "商品候補を作成しました",
                    {"candidate_id": created_candidate.id, "source_log_id": created_log.id},
                )
                if len(created_candidates) >= max_candidates:
                    candidate_limit_reached = True
                    skipped_details.append(
                        f"candidate_limit_reached: max_candidates={max_candidates}"
                    )
                    emit_progress(
                        progress_callback,
                        "candidate_limit",
                        "warn",
                        "候補生成数が上限に達したため停止しました",
                        {
                            "reason": "candidate_limit_reached",
                            "max_candidates": max_candidates,
                            "created_candidates_count": len(created_candidates),
                        },
                    )
                    break

        crud.finish_collection_run(
            db,
            collection_run,
            status="completed",
            finished_at=datetime.now(timezone.utc),
            created_count=len(created_logs),
            skipped_count=skipped_count,
        )
        emit_progress(
            progress_callback,
            "source_done",
            "success",
            "Source completed",
            {
                "created_logs_count": len(created_logs),
                "created_candidates_count": len(created_candidates),
                "skipped_count": skipped_count,
                "candidate_limit_reached": candidate_limit_reached,
                "max_candidates": max_candidates,
            },
        )
        return schemas.CollectorRunResponse(
            collection_run_id=collection_run.id,
            source_id=source.id,
            fetched_url=source.url,
            created_count=len(created_logs),
            skipped_count=skipped_count,
            skipped_details=skipped_details[:20],
            logs=created_logs,
            candidates=created_candidates,
        )
    except Exception as exc:
        emit_progress(
            progress_callback,
            "error",
            "error",
            f"Collector error: {exc}",
        )
        crud.finish_collection_run(
            db,
            collection_run,
            status="failed",
            finished_at=datetime.now(timezone.utc),
            error_message=str(exc),
        )
        raise


def fetch_url(url: str) -> tuple[bytes, str]:
    request = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=10) as response:
        content_type = response.headers.get("Content-Type", "")
        return response.read(MAX_RESPONSE_BYTES), content_type


def is_html_content(content_type: str, source_url: str) -> bool:
    parsed = urlparse(source_url)
    return "html" in content_type or parsed.path.endswith(("/", ".html", ".htm", ".php")) or not parsed.path


def list_to_detail_items(
    items: list[CollectedItem],
    *,
    source_url: str,
    respect_robots: bool,
    max_detail_fetches: int,
    progress_callback: ProgressCallback | None = None,
) -> list[CollectedItem]:
    detail_items: list[CollectedItem] = []
    for item in items:
        if len(detail_items) >= max_detail_fetches:
            break
        if not is_detail_link_candidate(item, source_url):
            continue
        if respect_robots and not is_allowed_by_robots(item.url):
            emit_progress(
                progress_callback,
                "skip",
                "warn",
                "robots.txt によりスキップ",
                {
                    "reason": "robots_disallow",
                    "details": "robots.txt disallowed detail URL",
                    "url": item.url,
                },
            )
            continue
        emit_progress(progress_callback, "detail_fetch", "info", f"詳細ページ取得開始: {item.url}", {"url": item.url})
        detail_item = fetch_detail_item(item)
        if detail_item:
            emit_progress(progress_callback, "detail_fetch", "success", f"詳細ページ取得完了: {item.url}", {"url": item.url})
            detail_items.append(detail_item)
    return detail_items or items


def is_detail_link_candidate(item: CollectedItem, source_url: str) -> bool:
    item_url = item.url.lower()
    if any(part.lower() in item_url for part in SKIP_DETAIL_URL_PARTS):
        return False
    if candidate_detector.has_excluded_keyword(item.title) or candidate_detector.is_noisy_title(item.title):
        return False

    parsed_item = urlparse(item.url)
    parsed_source = urlparse(source_url)
    same_site = parsed_item.netloc == parsed_source.netloc
    path_has_hint = any(hint in parsed_item.path for hint in candidate_detector.PRODUCT_URL_HINTS)
    title_has_signal = any(keyword in item.title for keyword in candidate_detector.PRODUCT_SIGNAL_KEYWORDS)
    selected_site = parsed_item.netloc.endswith("pokemoncenter-online.com")
    return same_site or selected_site or path_has_hint or title_has_signal


def fetch_detail_item(item: CollectedItem) -> CollectedItem | None:
    content, content_type = fetch_url(item.url)
    if "html" not in content_type and not item.url.endswith((".html", ".htm", ".php", "/")):
        return item
    text = content.decode("utf-8", errors="replace")
    parser = DetailPageParser()
    parser.feed(text)
    title = normalize_text(parser.title) or item.title
    body_text = parser.body_text or item.raw_text or title
    return build_collected_item(
        title=title,
        url=item.url,
        base_url=item.url,
        raw_text=body_text,
    )


def is_allowed_by_robots(url: str) -> bool:
    parsed = urlparse(url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    parser = RobotFileParser()
    parser.set_url(robots_url)
    try:
        parser.read()
    except Exception:
        return True
    return parser.can_fetch(USER_AGENT, url)


def parse_content(content: bytes, content_type: str, source_url: str) -> list[CollectedItem]:
    text = content.decode("utf-8", errors="replace")
    if is_pokemon_card_products_page(source_url):
        pokemon_items = parse_pokemon_card_products(source_url)
        if pokemon_items:
            return pokemon_items
    if "json" in content_type or text.lstrip().startswith("{"):
        json_items = parse_product_json(text, source_url)
        if json_items:
            return json_items
    if "xml" in content_type or text.lstrip().startswith("<?xml") or "<rss" in text[:300]:
        rss_items = parse_rss(text, source_url)
        if rss_items:
            return rss_items
    return parse_html(text, source_url)


def is_pokemon_card_products_page(source_url: str) -> bool:
    parsed = urlparse(source_url)
    return parsed.netloc == "www.pokemon-card.com" and parsed.path.startswith("/products")


def parse_pokemon_card_products(source_url: str) -> list[CollectedItem]:
    products_url = "https://www.pokemon-card.com/products/topList.php"
    content, content_type = fetch_url(products_url)
    text = content.decode("utf-8", errors="replace")
    if "json" not in content_type and not text.lstrip().startswith("{"):
        return []
    return parse_product_json(text, products_url)


def parse_product_json(text: str, source_url: str) -> list[CollectedItem]:
    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        return []

    products = payload.get("products")
    if not isinstance(products, list):
        return []

    items: list[CollectedItem] = []
    for product in products:
        if not isinstance(product, dict):
            continue
        title = normalize_text(str(product.get("productTitle") or ""))
        if not title:
            continue

        detail_url = (
            product.get("link_detailPage")
            or product.get("link_pokemonCenter")
            or product.get("link_cardList")
            or source_url
        )
        raw_parts = [
            title,
            f"商品種別: {product.get('productType')}" if product.get("productType") else "",
            f"発売日: {product.get('releaseDate')}" if product.get("releaseDate") else "",
            f"価格: {product.get('priceTxt')}" if product.get("priceTxt") else "",
            f"販売店舗: {product.get('storesAvailable')}" if product.get("storesAvailable") else "",
            str(product.get("description") or ""),
        ]
        item = build_collected_item(
            title=title,
            url=str(detail_url),
            base_url=source_url,
            raw_text=" ".join(part for part in raw_parts if part),
        )
        if item:
            items.append(item)

    return items


def parse_rss(text: str, source_url: str) -> list[CollectedItem]:
    try:
        root = ET.fromstring(text)
    except ET.ParseError:
        return []

    items: list[CollectedItem] = []
    for item in root.findall(".//item"):
        title = item.findtext("title") or "Untitled"
        link = item.findtext("link") or source_url
        description = item.findtext("description")
        collected_item = build_collected_item(
            title=title,
            url=link,
            base_url=source_url,
            raw_text=description,
        )
        if collected_item:
            items.append(collected_item)

    if items:
        return items

    atom_namespace = "{http://www.w3.org/2005/Atom}"
    for entry in root.findall(f".//{atom_namespace}entry"):
        title = entry.findtext(f"{atom_namespace}title") or "Untitled"
        link = source_url
        link_element = entry.find(f"{atom_namespace}link")
        if link_element is not None and link_element.attrib.get("href"):
            link = link_element.attrib["href"]
        summary = entry.findtext(f"{atom_namespace}summary")
        collected_item = build_collected_item(
            title=title,
            url=link,
            base_url=source_url,
            raw_text=summary,
        )
        if collected_item:
            items.append(collected_item)
    return items


def parse_html(text: str, source_url: str) -> list[CollectedItem]:
    parser = LinkParser(source_url)
    parser.feed(text)
    page_title = parser.page_title.strip()
    if parser.links:
        return parser.links
    item = build_collected_item(
        title=page_title or source_url,
        url=source_url,
        base_url=source_url,
        raw_text=text,
    )
    return [item] if item else []


def dedupe_collected_items(items: list[CollectedItem]) -> list[CollectedItem]:
    seen_urls: set[str] = set()
    deduped_items: list[CollectedItem] = []
    for item in items:
        if item.url in seen_urls:
            continue
        seen_urls.add(item.url)
        deduped_items.append(item)
    return deduped_items


def is_http_url(url: str) -> bool:
    parsed = urlparse(url)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)
