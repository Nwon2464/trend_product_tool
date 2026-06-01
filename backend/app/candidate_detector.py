import json
import re
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


def build_candidate_from_source_log(
    *,
    source: models.Source,
    source_log: models.SourceLog,
) -> schemas.ProductCandidateCreate | None:
    haystack = f"{source_log.title}\n{source_log.raw_text or ''}"
    if has_excluded_keyword(haystack):
        return None
    if is_noisy_title(source_log.title):
        return None

    matched: list[str] = []
    score = 0
    reasons: list[str] = []
    for label, points, keywords in DETECTION_RULES:
        rule_matches = [keyword for keyword in keywords if keyword in haystack]
        if rule_matches:
            matched.extend(rule_matches)
            score += points
            reasons.append(f"{label}: {', '.join(rule_matches)}")

    if not matched and has_product_page_signal(
        title=source_log.title,
        raw_text=source_log.raw_text,
        url=source_log.url,
        source=source,
    ):
        matched.append("商品ページ候補")
        score += 10
        reasons.append("商品ページ候補")

    if not matched:
        return None

    price = extract_price(haystack)
    release_date = extract_release_date(haystack)
    sales_store = source.source_name
    product_name = clean_product_name(source_log.title)

    if price is not None:
        score += 6
        reasons.append("価格情報あり")
    if release_date is not None:
        score += 6
        reasons.append("日付情報あり")
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
        category=source.target_category,
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
    match = re.search(r"(?:税込|税抜|価格|メーカー希望小売価格)?\s*[¥￥]?\s*([0-9,]{2,7})\s*円", text)
    if not match:
        match = re.search(r"[¥￥]\s*([0-9,]{2,7})", text)
    if not match:
        return None
    return int(match.group(1).replace(",", ""))


def extract_release_date(text: str) -> date | None:
    year_match = re.search(r"(20[0-9]{2})[年/-]\s*([0-9]{1,2})[月/-]\s*([0-9]{1,2})", text)
    if year_match:
        year, month, day = (int(value) for value in year_match.groups())
        return build_date(year, month, day)

    month_day_match = re.search(r"([0-9]{1,2})\s*月\s*([0-9]{1,2})\s*日(?:発売|販売|登場|予定)?", text)
    if month_day_match:
        today = date.today()
        month, day = (int(value) for value in month_day_match.groups())
        candidate = build_date(today.year, month, day)
        if candidate and candidate < today:
            candidate = build_date(today.year + 1, month, day)
        return candidate

    return None


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
) -> bool:
    haystack = f"{title}\n{raw_text or ''}"
    if has_excluded_keyword(haystack) or is_noisy_title(title):
        return False

    if any(keyword in haystack for keyword in get_detection_keywords()):
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


def get_detection_keywords() -> list[str]:
    keywords: list[str] = []
    for _, _, rule_keywords in DETECTION_RULES:
        keywords.extend(rule_keywords)
    return keywords


def clean_product_name(title: str) -> str:
    product_name = re.sub(r"\s+", " ", title).strip()
    product_name = re.sub(r"^[【\[]?(ニュース|お知らせ|商品情報|新着情報)[】\]]?\s*[:：-]?\s*", "", product_name)
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
