from urllib.parse import urlparse
from typing import Literal, TypedDict


SourceType = Literal["generic", "news_article", "product_catalog"]
ProductNameRule = Literal[
    "clean_title",
    "prefer_title",
    "remove_site_suffix",
    "catalog_breadcrumb",
]


class SiteProfile(TypedDict):
    domain: str
    source_type: SourceType
    allow_paths: list[str]
    exclude_paths: list[str]
    weak_paths: list[str]
    noise_keywords: list[str]
    raw_noise_keywords: list[str]
    product_url_patterns: list[str]
    required_markers: list[str]
    release_labels: list[str]
    price_labels: list[str]
    product_name_rules: list[ProductNameRule]
    site_suffixes: list[str]
    ignored_title_parts: list[str]
    catalog_base_score: int
    product_url_reason: str
    catalog_keyword: str


DEFAULT_PROFILE: SiteProfile = {
    "domain": "",
    "source_type": "generic",
    "allow_paths": [],
    "exclude_paths": [],
    "weak_paths": [],
    "noise_keywords": [],
    "raw_noise_keywords": [],
    "product_url_patterns": [],
    "release_labels": [
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
    ],
    "price_labels": [
        "税込",
        "税抜",
        "価格",
        "メーカー希望小売価格",
        "販売価格",
        "本体価格",
        "円（税込",
        "円 税込",
    ],
    "product_name_rules": ["clean_title"],
    "site_suffixes": [],
    "ignored_title_parts": [],
    "required_markers": [],
    "catalog_base_score": 42,
    "product_url_reason": "商品ページURL",
    "catalog_keyword": "公式商品ページ",
}


SITE_PROFILES: dict[str, SiteProfile] = {
    "sanrio.co.jp": {
        **DEFAULT_PROFILE,
        "domain": "sanrio.co.jp",
        "source_type": "news_article",
        "allow_paths": ["/news/goods/"],
        "exclude_paths": ["/sanrioplus/", "/news/sanrioplus/"],
        "weak_paths": ["/news/spots/"],
        "noise_keywords": [
            "Sanrio＋とは",
            "Sanrio+とは",
            "Sanrio＋会員",
            "Sanrio+会員",
            "デジタルコンテンツ",
            "プレゼントキャンペーン",
            "壁紙",
            "会員限定",
        ],
        "raw_noise_keywords": ["デジタルコンテンツ", "プレゼントキャンペーン", "壁紙"],
        "product_url_patterns": [],
        "release_labels": ["発売日", "販売開始", "発売スタート", "から発売", "より発売"],
        "price_labels": ["価格", "税込", "円"],
        "product_name_rules": ["clean_title", "remove_site_suffix"],
        "site_suffixes": ["サンリオ"],
        "ignored_title_parts": [],
    },
    "bandai.co.jp": {
        **DEFAULT_PROFILE,
        "domain": "bandai.co.jp",
        "source_type": "product_catalog",
        "allow_paths": ["/catalog/item.php"],
        "exclude_paths": [],
        "weak_paths": [],
        "noise_keywords": [],
        "raw_noise_keywords": [],
        "product_url_patterns": ["/catalog/item.php?jan_cd="],
        "release_labels": ["発売時期", "発売日", "発売予定日", "販売時期", "販売開始日"],
        "price_labels": ["価格"],
        "product_name_rules": ["prefer_title", "remove_site_suffix", "catalog_breadcrumb"],
        "site_suffixes": [],
        "ignored_title_parts": ["バンダイ 商品・サービスサイト", "商品情報"],
        "required_markers": ["商品情報", "価格", "売場", "発売時期", "対象年齢"],
        "catalog_base_score": 42,
        "product_url_reason": "Bandai公式catalog商品URL",
        "catalog_keyword": "Bandai公式商品ページ",
    },
}


def get_site_profile(url: str) -> SiteProfile:
    parsed = urlparse(url)
    host = parsed.netloc.lower()
    for domain, site_profile in SITE_PROFILES.items():
        if host == domain or host.endswith(f".{domain}"):
            return {**DEFAULT_PROFILE, **site_profile, "domain": domain}

    profile: SiteProfile = {**DEFAULT_PROFILE, "domain": host}
    return profile
