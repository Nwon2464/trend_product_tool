import re
from urllib.parse import urlparse

from .extractors import extract_price, has_product_url_pattern
from .text_utils import contains_any

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


def is_excluded_path(url: str, profile: dict) -> bool:
    return contains_any(url, profile.get("exclude_paths", []))


def is_allowed_path(url: str, profile: dict) -> bool:
    allow_paths = profile.get("allow_paths", [])
    if not allow_paths:
        return True
    return contains_any(urlparse(url).path, allow_paths)


def is_weak_path(url: str, profile: dict) -> bool:
    return contains_any(url, profile.get("weak_paths", []))


def contains_noise_keyword(title: str, text: str | None, profile: dict) -> bool:
    title_and_text = f"{title}\n{text or ''}"
    if contains_any(title_and_text, profile.get("noise_keywords", [])):
        raw_noise_keywords = profile.get("raw_noise_keywords", [])
        if contains_any(text or "", raw_noise_keywords) and has_sales_signal(text or "", profile):
            return False
        return True
    return False


def should_exclude_page(url: str, title: str, text: str | None, profile: dict) -> bool:
    haystack = f"{title}\n{text or ''}"
    if has_product_url_pattern(url, profile):
        return False
    if has_excluded_keyword(haystack):
        return True
    if is_noisy_title(title):
        return True
    if is_excluded_path(url, profile):
        return True
    if contains_noise_keyword(title, text, profile):
        return True
    if is_weak_path(url, profile) and not has_sales_signal(haystack, profile):
        return True
    return False


def has_excluded_keyword(text: str) -> bool:
    return contains_any(text, EXCLUDE_KEYWORDS)


def is_noisy_title(title: str) -> bool:
    clean_title = title.strip()
    return any(re.search(pattern, clean_title) for pattern in NOISY_TITLE_PATTERNS)


def has_sales_signal(text: str, profile: dict | None = None) -> bool:
    labels = (profile or {}).get("price_labels", [])
    release_labels = (profile or {}).get("release_labels", [])
    return (
        contains_any(text, SALES_SIGNAL_KEYWORDS)
        or contains_any(text, labels)
        or contains_any(text, release_labels)
        or extract_price(text, profile) is not None
    )

