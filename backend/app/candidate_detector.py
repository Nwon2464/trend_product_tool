import json
import re
from dataclasses import dataclass
from datetime import date

from . import models, schemas

DETECTION_RULES = [
    ("予約開始", 22, ["予約開始", "予約受付", "予約販売", "先行予約", "抽選予約", "予約"]),
    ("販売予定", 15, ["販売予定", "発売予定", "新発売", "発売日", "発売決定", "登場予定"]),
    ("再販売", 22, ["再販売", "再販", "再入荷", "再登場", "追加販売"]),
    ("入荷", 14, ["入荷", "入荷予定", "在庫あり", "販売中", "在庫復活"]),
    ("限定", 20, ["限定", "数量限定", "期間限定", "店舗限定", "オンライン限定", "受注限定"]),
    ("コラボ", 18, ["コラボ", "コラボレーション", "タイアップ", "別注"]),
    ("廃盤", 24, ["廃盤", "終売", "販売終了", "生産終了", "販売休止"]),
    ("抽選販売", 18, ["抽選", "抽選販売", "抽選受付", "抽選申込"]),
]

STATUS_KEYWORD_GROUPS = {
    "予約開始": ["予約開始", "予約受付", "予約販売", "先行予約", "抽選予約", "予約"],
    "発売予定": ["販売予定", "発売予定", "新発売", "発売日", "発売決定", "登場予定"],
    "発売中": ["発売中", "販売中", "在庫あり"],
    "再販": ["再販売", "再販", "再入荷", "再登場", "追加販売"],
    "入荷": ["入荷", "入荷予定", "在庫あり", "在庫復活"],
    "抽選販売": ["抽選", "抽選販売", "抽選受付", "抽選申込"],
    "限定": ["限定", "数量限定", "期間限定", "店舗限定", "オンライン限定", "受注限定"],
    "コラボ": ["コラボ", "コラボレーション", "タイアップ", "別注"],
    "廃盤": ["廃盤", "終売", "販売終了", "生産終了", "販売休止"],
}

EXCLUDE_KEYWORDS = [
    "大会",
    "ルール",
    "遊び方",
    "あそびかた",
    "お問い合わせ",
    "採用",
    "会社情報",
    "利用規約",
    "キャンペーン応募規約",
    "メンテナンス",
    "障害情報",
    "重要なお知らせ",
    "個人情報",
    "プライバシーポリシー",
    "Youtube",
    "YouTube",
    "Twitter",
    "X公式",
]

HIGH_VALUE_CATEGORIES = [
    "ポケモンカード",
    "ワンピースカード",
    "ちいかわ",
    "サンリオ",
    "ポケモン系グッズ",
    "スタバ",
    "アパレルコラボ",
    "廃盤",
]

NOISY_TITLE_PATTERNS = [
    r"^ニュース$",
    r"^お知らせ$",
    r"^新着情報$",
    r"^商品情報$",
    r"^一覧$",
    r"^はじめての方へ$",
    r"^お店検索$",
    r"^カード検索$",
    r"^デッキ構築$",
    r"^イベント$",
    r"^トップ$",
    r"^HOME$",
    r"^SNS$",
]

PRODUCT_SIGNAL_KEYWORDS = [
    "商品",
    "新商品",
    "発売",
    "販売",
    "予約",
    "再販",
    "再販売",
    "再入荷",
    "入荷",
    "抽選",
    "限定",
    "コラボ",
    "廃盤",
    "終売",
    "拡張パック",
    "強化拡張パック",
    "スターター",
    "スタートデッキ",
    "デッキ",
    "カード",
    "BOX",
    "パック",
    "グッズ",
    "ぬいぐるみ",
    "ガチャ",
    "ガシャポン",
]

SELECTED_STATUS_PRODUCT_SIGNAL_KEYWORDS = [
    "拡張パック",
    "強化拡張パック",
    "スターター",
    "スタートデッキ",
    "デッキ",
    "カード",
    "BOX",
    "パック",
    "グッズ",
    "ぬいぐるみ",
    "ガチャ",
    "ガシャポン",
]

PRODUCT_URL_HINTS = [
    "/products/",
    "/product/",
    "/news/",
    "/topics/",
    "/item/",
    "/items/",
    "/goods/",
    "/release/",
    "/press/",
]

SALES_SIGNAL_KEYWORDS = [
    "発売日",
    "発売予定",
    "販売開始",
    "発売スタート",
    "販売スタート",
    "から発売",
    "より発売",
    "から販売",
    "より販売",
    "予約開始",
    "再登場",
    "再販",
    "再販売",
    "価格",
    "税込",
    "税抜",
    "メーカー希望小売価格",
    "販売価格",
    "全国のお菓子売り場",
    "店舗限定",
]

PRICE_CONTEXT_KEYWORDS = [
    "税込",
    "税抜",
    "価格",
    "メーカー希望小売価格",
    "販売価格",
    "本体価格",
    "円（税込",
    "円 税込",
]

SANRIO_NOISE_KEYWORDS = [
    "Sanrio＋とは",
    "Sanrio+とは",
    "Sanrio＋会員",
    "Sanrio+会員",
    "デジタルコンテンツ",
    "プレゼントキャンペーン",
    "壁紙",
    "会員限定",
]

SANRIO_NOISE_URL_PARTS = [
    "/sanrioplus/",
    "/news/sanrioplus/",
]

SANRIO_WEAK_URL_PARTS = [
    "/news/spots/",
]

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

DATE_CONTEXT_KEYWORDS = [
    "発売日",
    "発売予定日",
    "発売開始日",
    "販売日",
    "販売予定日",
    "販売開始日",
    "予約開始日",
    "予約受付開始",
    "発売スタート",
    "販売スタート",
    "から発売",
    "より発売",
    "から販売",
    "より販売",
]

NON_RELEASE_DATE_CONTEXT_KEYWORDS = [
    "記事公開日",
    "公開日",
    "投稿日",
    "更新日",
    "掲載日",
    "ニュースの日付",
]

FULL_DATE_PATTERN = re.compile(r"(20[0-9]{2})[年/-]\s*([0-9]{1,2})[月/-]\s*([0-9]{1,2})")
MONTH_DAY_PATTERN = re.compile(r"([0-9]{1,2})\s*月\s*([0-9]{1,2})\s*日(?:\s*[（(][月火水木金土日][）)])?")


@dataclass(frozen=True)
class ReleaseDateMatch:
    value: date
    reason: str
    score: int
    position: int


def build_candidate_from_source_log(
    *,
    source: models.Source,
    source_log: models.SourceLog,
    selected_statuses: list[str] | None = None,
    db_keywords: list[models.Keyword] | None = None,
) -> schemas.ProductCandidateCreate | None:
    haystack = f"{source_log.title}\n{source_log.raw_text or ''}"
    if has_excluded_keyword(haystack):
        return None
    if is_noisy_title(source_log.title):
        return None
    if is_sanrio_noise_page(source_log.title, source_log.raw_text, source_log.url):
        return None
    if is_sanrio_weak_path(source_log.url) and not has_sales_signal(haystack):
        return None

    selected_keywords = get_keywords_for_statuses(selected_statuses)
    if selected_keywords:
        selected_keyword_matches = get_matched_keywords(haystack, selected_keywords)
        if not selected_keyword_matches:
            return None
        if not has_product_keyword_signal(
            title=source_log.title,
            raw_text=source_log.raw_text,
            url=source_log.url,
            source=source,
            db_keywords=db_keywords,
            selected_status_keywords=selected_keywords,
        ):
            return None

    matched: list[str] = []
    score = 0
    reasons: list[str] = []
    db_keyword_matches = get_db_keyword_matches(haystack, db_keywords)
    for label, points, keywords in DETECTION_RULES:
        rule_matches = [keyword for keyword in keywords if keyword in haystack]
        if rule_matches:
            matched.extend(rule_matches)
            score += points
            reasons.append(f"{label}: {', '.join(rule_matches)}")

    for keyword in db_keyword_matches:
        matched.append(keyword.keyword)
        keyword_score = score_for_keyword_priority(keyword.priority)
        score += keyword_score
        reasons.append(f"登録キーワード「{keyword.keyword}」を検出")
        reasons.append(f"優先度{keyword.priority}のキーワードを検出")
        reasons.append(f"カテゴリ「{keyword.category}」の登録キーワードに一致")

    product_page_only = False
    if not matched and has_product_page_signal(
        title=source_log.title,
        raw_text=source_log.raw_text,
        url=source_log.url,
        source=source,
    ):
        if not has_sales_signal(haystack):
            return None
        product_page_only = True
        matched.append("商品ページ候補")
        score += 4
        reasons.append("商品ページ候補")

    if not matched:
        return None

    price = extract_price(haystack)
    release_date, release_date_reason = extract_release_date_with_reason(haystack)
    if product_page_only and price is None and release_date is None:
        return None
    sales_store = source.source_name
    product_name = clean_product_name(source_log.title)
    candidate_category = db_keyword_matches[0].category if db_keyword_matches else source.target_category

    if price is not None:
        score += 6
        reasons.append("価格情報あり")
    if release_date is not None:
        score += 6
        reasons.append(release_date_reason)
    if source.source_type == "official":
        score += 12
        reasons.append("公式情報源")
    elif source.source_type == "retail":
        retail_bonus = 8 if any(keyword in matched for keyword in ["入荷", "在庫あり", "在庫復活", "再入荷", "再販"]) else 4
        score += retail_bonus
        reasons.append("小売・EC情報源")

    if any(category in source.target_category for category in HIGH_VALUE_CATEGORIES):
        score += 8
        reasons.append("注目カテゴリ")

    if product_name != source_log.title:
        reasons.append("商品名を整形")
    if len(product_name) < 4:
        return None
    if len(product_name) > 120:
        score -= 8
        reasons.append("タイトルが長いため減点")

    return schemas.ProductCandidateCreate(
        source_log_id=source_log.id,
        category=candidate_category,
        product_name=product_name,
        price=price,
        release_date=release_date,
        sales_store=sales_store,
        source_url=source_log.url,
        detected_reason="; ".join(reasons),
        detected_keywords=json.dumps(sorted(set(matched)), ensure_ascii=False),
        profit_expectation=min(score, 100),
        candidate_status="new",
    )


def extract_price(text: str) -> int | None:
    for match in re.finditer(r"[¥￥]\s*([0-9,]{2,7})", text):
        return int(match.group(1).replace(",", ""))

    for match in re.finditer(r"([0-9,]{2,7})\s*円", text):
        before = text[max(0, match.start() - 24):match.start()]
        after = text[match.end():min(len(text), match.end() + 24)]
        context = f"{before}{match.group(0)}{after}"
        if any(keyword in context for keyword in PRICE_CONTEXT_KEYWORDS):
            return int(match.group(1).replace(",", ""))

    return None


def extract_release_date(text: str) -> date | None:
    release_date, _reason = extract_release_date_with_reason(text)
    return release_date


def extract_release_date_with_reason(text: str) -> tuple[date | None, str]:
    context_match = find_contextual_release_date(text)
    if context_match:
        return context_match.value, context_match.reason

    return None, ""


def find_contextual_release_date(text: str) -> ReleaseDateMatch | None:
    matches: list[ReleaseDateMatch] = []
    base_year = infer_year_from_text(text)

    for match in FULL_DATE_PATTERN.finditer(text):
        year, month, day = (int(value) for value in match.groups())
        candidate = build_date(year, month, day)
        if candidate:
            context_score = score_release_date_context(text, match.start(), match.end())
            if context_score > 0:
                matches.append(ReleaseDateMatch(candidate, "発売日文脈から日付抽出", context_score, match.start()))

    for match in MONTH_DAY_PATTERN.finditer(text):
        month, day = (int(value) for value in match.groups())
        candidate = build_date(base_year, month, day)
        if candidate:
            context_score = score_release_date_context(text, match.start(), match.end())
            if context_score > 0:
                matches.append(ReleaseDateMatch(candidate, "発売日文脈から日付抽出", context_score, match.start()))

    if not matches:
        return None

    return sorted(matches, key=lambda item: (-item.score, item.position))[0]


def find_general_release_date(text: str) -> date | None:
    year_match = FULL_DATE_PATTERN.search(text)
    if year_match:
        year, month, day = (int(value) for value in year_match.groups())
        return build_date(year, month, day)

    month_day_match = MONTH_DAY_PATTERN.search(text)
    if month_day_match:
        today = date.today()
        month, day = (int(value) for value in month_day_match.groups())
        candidate = build_date(today.year, month, day)
        if candidate and candidate < today:
            candidate = build_date(today.year + 1, month, day)
        return candidate

    return None


def infer_year_from_text(text: str) -> int:
    year_match = re.search(r"20[0-9]{2}", text)
    if year_match:
        return int(year_match.group(0))
    return date.today().year


def score_release_date_context(text: str, start: int, end: int) -> int:
    before = text[max(0, start - 28):start]
    after = text[end:min(len(text), end + 28)]
    context = f"{before}{text[start:end]}{after}"

    if any(keyword in context for keyword in NON_RELEASE_DATE_CONTEXT_KEYWORDS):
        return 0

    score = 0
    if any(keyword in before[-14:] for keyword in ["発売日", "発売予定日", "発売開始日", "販売日", "販売予定日", "販売開始日", "予約開始日", "予約受付開始"]):
        score += 80
    if re.search(r"(発売日|発売予定日|発売開始日|販売日|販売予定日|販売開始日|予約開始日|予約受付開始)\s*[：:]\s*$", before):
        score += 40
    if re.search(r"(から|より)\s*(発売|販売|予約)", after):
        score += 60
    if re.search(r"(発売|販売|予約受付|予約)\s*(開始|スタート|予定)?", after):
        score += 35
    if any(keyword in context for keyword in DATE_CONTEXT_KEYWORDS):
        score += 25

    return score


def build_date(year: int, month: int, day: int) -> date | None:
    try:
        return date(year, month, day)
    except ValueError:
        return None


def has_excluded_keyword(text: str) -> bool:
    return any(keyword in text for keyword in EXCLUDE_KEYWORDS)


def is_noisy_title(title: str) -> bool:
    clean_title = title.strip()
    return any(re.search(pattern, clean_title) for pattern in NOISY_TITLE_PATTERNS)


def has_product_opportunity_signal(
    *,
    title: str,
    raw_text: str | None,
    url: str,
    source: models.Source,
    db_keywords: list[models.Keyword] | None = None,
) -> bool:
    haystack = f"{title}\n{raw_text or ''}"
    if has_excluded_keyword(haystack) or is_noisy_title(title):
        return False
    if is_sanrio_noise_page(title, raw_text, url):
        return False
    if is_sanrio_weak_path(url) and not has_sales_signal(haystack):
        return False

    if any(keyword in haystack for keyword in get_detection_keywords()):
        return True

    if get_db_keyword_matches(haystack, db_keywords):
        return True

    return has_product_page_signal(title=title, raw_text=raw_text, url=url, source=source)


def has_selected_status_signal(
    *,
    title: str,
    raw_text: str | None,
    url: str,
    source: models.Source,
    selected_statuses: list[str] | None,
    db_keywords: list[models.Keyword] | None = None,
) -> bool:
    selected_keywords = get_keywords_for_statuses(selected_statuses)
    if not selected_keywords:
        return has_product_opportunity_signal(
            title=title,
            raw_text=raw_text,
            url=url,
            source=source,
            db_keywords=db_keywords,
        )
    haystack = f"{title}\n{raw_text or ''}"
    return bool(
        get_matched_keywords(haystack, selected_keywords)
        and has_product_keyword_signal(
            title=title,
            raw_text=raw_text,
            url=url,
            source=source,
            db_keywords=db_keywords,
            selected_status_keywords=selected_keywords,
        )
    )


def has_product_keyword_signal(
    *,
    title: str,
    raw_text: str | None,
    url: str,
    source: models.Source,
    db_keywords: list[models.Keyword] | None = None,
    selected_status_keywords: list[str] | None = None,
) -> bool:
    haystack = f"{title}\n{raw_text or ''}"
    status_keywords = set(selected_status_keywords or [])

    for keyword in get_db_keyword_matches(haystack, db_keywords):
        if not is_status_only_keyword(keyword.keyword, status_keywords):
            return True

    if any(keyword in haystack for keyword in SELECTED_STATUS_PRODUCT_SIGNAL_KEYWORDS if keyword not in status_keywords):
        return True

    return has_product_page_signal(title=title, raw_text=raw_text, url=url, source=source)


def has_product_page_signal(
    *,
    title: str,
    raw_text: str | None,
    url: str,
    source: models.Source,
) -> bool:
    if "productType=" in url:
        return False
    haystack = f"{title}\n{raw_text or ''}\n{source.target_category}"
    has_product_word = any(keyword in haystack for keyword in PRODUCT_SIGNAL_KEYWORDS)
    has_url_hint = any(hint in url for hint in PRODUCT_URL_HINTS)
    title_is_specific = len(title.strip()) >= 6 and not is_noisy_title(title)
    return title_is_specific and has_product_word and has_url_hint


def is_sanrio_noise_page(title: str, raw_text: str | None, url: str) -> bool:
    if any(part in url for part in SANRIO_NOISE_URL_PARTS):
        return True
    title_and_url = f"{title}\n{url}"
    if any(keyword in title_and_url for keyword in SANRIO_NOISE_KEYWORDS):
        return True
    raw = raw_text or ""
    raw_noise_keywords = ["デジタルコンテンツ", "プレゼントキャンペーン", "壁紙"]
    return any(keyword in raw for keyword in raw_noise_keywords) and not has_sales_signal(raw)


def is_sanrio_weak_path(url: str) -> bool:
    return any(part in url for part in SANRIO_WEAK_URL_PARTS)


def has_sales_signal(text: str) -> bool:
    return any(keyword in text for keyword in SALES_SIGNAL_KEYWORDS) or extract_price(text) is not None


def get_detection_keywords() -> list[str]:
    keywords: list[str] = []
    for _, _, rule_keywords in DETECTION_RULES:
        keywords.extend(rule_keywords)
    return keywords


def get_keywords_for_statuses(selected_statuses: list[str] | None) -> list[str]:
    if not selected_statuses:
        return []
    keywords: list[str] = []
    for status in selected_statuses:
        if status in {"すべて", "全て", "all", ""}:
            continue
        keywords.extend(STATUS_KEYWORD_GROUPS.get(status, [status]))
    return sorted(set(keywords))


def get_all_status_keywords() -> set[str]:
    keywords: set[str] = set()
    for status, status_keywords in STATUS_KEYWORD_GROUPS.items():
        keywords.add(status)
        keywords.update(status_keywords)
    return keywords


def get_matched_keywords(text: str, keywords: list[str]) -> list[str]:
    return [keyword for keyword in keywords if keyword and keyword in text]


def get_db_keyword_matches(text: str, db_keywords: list[models.Keyword] | None) -> list[models.Keyword]:
    if not db_keywords:
        return []
    return [keyword for keyword in db_keywords if keyword.is_active and keyword.keyword and keyword.keyword in text]


def is_status_only_keyword(keyword: str, selected_status_keywords: set[str]) -> bool:
    status_keywords = get_all_status_keywords() | selected_status_keywords
    return keyword in status_keywords


def score_for_keyword_priority(priority: int) -> int:
    if priority <= 1:
        return 15
    if priority == 2:
        return 10
    return 5


def clean_product_name(title: str) -> str:
    product_name = re.sub(r"\s+", " ", title).strip()
    product_name = re.sub(r"\s*[｜|]\s*サンリオ\s*$", "", product_name)
    product_name = product_name.replace("Sanrio＋会員】", "【Sanrio＋会員】")
    product_name = re.sub(r"^[【\[]?(ニュース|お知らせ|商品情報|新着情報)[】\]]?\s*[:：-]?\s*", "", product_name)
    quoted_match = re.search(r"「([^」]{4,120})」", product_name)
    if quoted_match and re.search(r"(登場|再登場|発売|販売|予約)", product_name):
        product_name = quoted_match.group(1)
    for pattern in TITLE_CLEANUP_PATTERNS:
        product_name = re.sub(pattern, "", product_name)
    product_name = re.sub(r"(20[0-9]{2})[年/-]\s*([0-9]{1,2})[月/-]\s*([0-9]{1,2})\s*日?(発売|販売|登場|予定)?", "", product_name)
    product_name = re.sub(r"([0-9]{1,2})\s*月\s*([0-9]{1,2})\s*日(?:発売|販売|登場|予定)?", "", product_name)
    product_name = re.sub(r"(?:税込|税抜|価格|メーカー希望小売価格)?\s*[¥￥]?\s*[0-9,]{2,7}\s*円(?:\\(税込\\)|税込)?", "", product_name)
    product_name = re.sub(r"[¥￥]\s*[0-9,]{2,7}", "", product_name)
    product_name = re.sub(r"(予約開始|予約受付|発売予定|新発売|再販売|再販|再入荷|入荷|在庫あり|数量限定|期間限定|限定)", "", product_name)
    product_name = re.sub(r"\s+", " ", product_name)
    product_name = product_name.strip(" -:：｜|【】[]")
    return product_name or title.strip()
