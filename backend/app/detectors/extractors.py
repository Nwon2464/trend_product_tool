import re
from dataclasses import dataclass
from datetime import date
from urllib.parse import parse_qs, urlparse

from .text_utils import (
    FULL_DATE_PATTERN,
    MONTH_DAY_PATTERN,
    build_date,
    clean_price_number,
    infer_year_from_text,
    parse_japanese_date,
)
from .profiles import DEFAULT_PROFILE

TITLE_CLEANUP_PATTERNS = [
    r"予約開始のお知らせ",
    r"予約受付開始",
    r"発売予定のお知らせ",
    r"新商品情報",
    r"商品情報",
    r"販売開始のお知らせ",
    r"再販売のお知らせ",
    r"再入荷のお知らせ",
    r"のお知らせ",
]

NON_RELEASE_DATE_CONTEXT_KEYWORDS = [
    "記事公開日",
    "公開日",
    "投稿日",
    "更新日",
    "掲載日",
    "ニュースの日付",
]


@dataclass(frozen=True)
class ReleaseDateMatch:
    value: date
    reason: str
    score: int
    position: int


def has_product_url_pattern(url: str, profile: dict) -> bool:
    patterns = profile.get("product_url_patterns", [])
    parsed = urlparse(url)
    if any(pattern in url for pattern in patterns):
        if parsed.path == "/catalog/item.php":
            return bool(parse_qs(parsed.query).get("jan_cd"))
        return True
    if "/catalog/item.php?jan_cd=" in patterns and parsed.path == "/catalog/item.php":
        return bool(parse_qs(parsed.query).get("jan_cd"))
    return False


def extract_jan_from_url(url: str) -> str | None:
    query = parse_qs(urlparse(url).query)
    values = query.get("jan_cd")
    return values[0] if values else None


def extract_product_name(title: str, text: str, profile: dict) -> str:
    rules = profile.get("product_name_rules", [])
    if "prefer_title" in rules:
        ignored_title_parts = set(profile.get("ignored_title_parts", []))
        title_parts = [
            part.strip() for part in re.split(r"\s*[｜|]\s*", title) if part.strip()
        ]
        for part in title_parts:
            if part not in ignored_title_parts and len(part) >= 4:
                return part

    if "catalog_breadcrumb" in rules:
        marker_match = re.search(r"TOP\s+商品情報\s+(.+?)\s+\1\s+", text)
        if marker_match:
            return marker_match.group(1).strip()

    return clean_product_name(title, profile)


def clean_product_name(title: str, profile: dict | None = None) -> str:
    product_name = re.sub(r"\s+", " ", title).strip()
    for suffix in (profile or {}).get("site_suffixes", []):
        product_name = re.sub(rf"\s*[｜|]\s*{re.escape(suffix)}\s*$", "", product_name)
    product_name = product_name.replace("Sanrio＋会員】", "【Sanrio＋会員】")
    product_name = re.sub(
        r"^[【\[]?(ニュース|お知らせ|商品情報|新着情報)[】\]]?\s*[:：-]?\s*",
        "",
        product_name,
    )
    quoted_match = re.search(r"「([^」]{4,120})」", product_name)
    if quoted_match and re.search(r"(登場|再登場|発売|販売|予約)", product_name):
        product_name = quoted_match.group(1)
    for pattern in TITLE_CLEANUP_PATTERNS:
        product_name = re.sub(pattern, "", product_name)
    product_name = re.sub(
        r"(20[0-9]{2})[年/-]\s*([0-9]{1,2})[月/-]\s*([0-9]{1,2})\s*日?(発売|販売|登場|予定)?",
        "",
        product_name,
    )
    product_name = re.sub(
        r"([0-9]{1,2})\s*月\s*([0-9]{1,2})\s*日(?:発売|販売|登場|予定)?",
        "",
        product_name,
    )
    product_name = re.sub(
        r"(?:税込|税抜|価格|メーカー希望小売価格)?\s*[¥￥]?\s*[0-9,]{2,7}\s*円(?:\\(税込\\)|税込)?",
        "",
        product_name,
    )
    product_name = re.sub(r"[¥￥]\s*[0-9,]{2,7}", "", product_name)
    product_name = re.sub(
        r"(予約開始|予約受付|発売予定|新発売|再販売|再販|再入荷|入荷|在庫あり|数量限定|期間限定|限定)",
        "",
        product_name,
    )
    product_name = re.sub(r"\s+", " ", product_name)
    product_name = product_name.strip(" -:：｜|【】[]")
    return product_name or title.strip()


def extract_price(text: str, profile: dict | None = None) -> int | None:
    labels = (profile or DEFAULT_PROFILE).get("price_labels", [])
    label_pattern = "|".join(re.escape(label) for label in labels) if labels else ""
    if label_pattern:
        match = re.search(
            rf"(?:{label_pattern})\s*[：:]?\s*([0-9,]{{2,7}})\s*円\s*(?:\(税込\)|税込)?",
            text,
        )
        if match:
            return clean_price_number(match.group(1))

    for match in re.finditer(r"[¥￥]\s*([0-9,]{2,7})", text):
        return clean_price_number(match.group(1))

    for match in re.finditer(r"([0-9,]{2,7})\s*円", text):
        before = text[max(0, match.start() - 24) : match.start()]
        after = text[match.end() : min(len(text), match.end() + 24)]
        context = f"{before}{match.group(0)}{after}"
        if not labels or any(keyword in context for keyword in labels):
            return clean_price_number(match.group(1))

    return None


def extract_release_date(text: str, profile: dict | None = None) -> date | None:
    release_date, _reason = extract_release_date_with_reason(text, profile)
    return release_date


def extract_release_date_with_reason(
    text: str, profile: dict | None = None
) -> tuple[date | None, str]:
    context_match = find_contextual_release_date(text, profile)
    if context_match:
        return context_match.value, context_match.reason

    return None, ""


def find_contextual_release_date(
    text: str, profile: dict | None = None
) -> ReleaseDateMatch | None:
    matches: list[ReleaseDateMatch] = []
    base_year = infer_year_from_text(text)

    for match in FULL_DATE_PATTERN.finditer(text):
        year, month, day = (int(value) for value in match.groups())
        candidate = build_date(year, month, day)
        if candidate:
            context_score = score_release_date_context(text, match.start(), match.end(), profile)
            if context_score > 0:
                matches.append(
                    ReleaseDateMatch(
                        candidate,
                        "発売日文脈から日付抽出",
                        context_score,
                        match.start(),
                    )
                )

    for match in MONTH_DAY_PATTERN.finditer(text):
        month, day = (int(value) for value in match.groups())
        candidate = build_date(base_year, month, day)
        if candidate:
            context_score = score_release_date_context(text, match.start(), match.end(), profile)
            if context_score > 0:
                matches.append(
                    ReleaseDateMatch(
                        candidate,
                        "発売日文脈から日付抽出",
                        context_score,
                        match.start(),
                    )
                )

    if not matches:
        return None

    return sorted(matches, key=lambda item: (-item.score, item.position))[0]


def find_general_release_date(text: str) -> date | None:
    return parse_japanese_date(text)


def score_release_date_context(
    text: str, start: int, end: int, profile: dict | None = None
) -> int:
    before = text[max(0, start - 28) : start]
    after = text[end : min(len(text), end + 28)]
    context = f"{before}{text[start:end]}{after}"
    labels = (profile or DEFAULT_PROFILE).get("release_labels", [])

    if any(keyword in context for keyword in NON_RELEASE_DATE_CONTEXT_KEYWORDS):
        return 0

    score = 0
    if any(keyword in before[-14:] for keyword in labels):
        score += 80
    label_group = "|".join(re.escape(label) for label in labels)
    if label_group and re.search(rf"({label_group})\s*[：:]\s*$", before):
        score += 40
    if re.search(r"(から|より)\s*(発売|販売|予約)", after):
        score += 60
    if re.search(r"(発売|販売|予約受付|予約)\s*(開始|スタート|予定)?", after):
        score += 35
    if any(keyword in context for keyword in labels):
        score += 25

    return score
