"""Compatibility entrypoint for product candidate detection.

The detector implementation lives under app.detectors so site-specific behavior
can be expressed through profiles instead of growing this module.
"""

from .detectors.engine import (
    build_candidate_from_source_log,
    build_profile_product_catalog_candidate,
    get_all_status_keywords,
    get_db_keyword_matches,
    get_detection_keywords,
    get_keywords_for_statuses,
    get_matched_keywords,
    has_product_keyword_signal,
    has_product_opportunity_signal,
    has_product_page_signal,
    has_selected_status_signal,
    is_product_catalog_item_url,
    is_profile_product_catalog_candidate,
    is_status_only_keyword,
)
from .detectors.extractors import (
    ReleaseDateMatch,
    clean_product_name,
    extract_jan_from_url,
    extract_price,
    extract_product_name,
    extract_release_date,
    extract_release_date_with_reason,
    find_contextual_release_date,
    find_general_release_date,
    score_release_date_context,
)
from .detectors.filters import (
    EXCLUDE_KEYWORDS,
    NOISY_TITLE_PATTERNS,
    PRODUCT_SIGNAL_KEYWORDS,
    PRODUCT_URL_HINTS,
    SALES_SIGNAL_KEYWORDS,
    SELECTED_STATUS_PRODUCT_SIGNAL_KEYWORDS,
    has_excluded_keyword,
    has_sales_signal,
    is_noisy_title,
)
from .detectors.profiles import SITE_PROFILES, get_site_profile
from .detectors.scoring import (
    DETECTION_RULES,
    HIGH_VALUE_CATEGORIES,
    STATUS_KEYWORD_GROUPS,
    score_for_keyword_priority,
)
from .detectors.text_utils import (
    FULL_DATE_PATTERN,
    MONTH_DAY_PATTERN,
    build_date,
    infer_year_from_text,
)

PRICE_CONTEXT_KEYWORDS = get_site_profile("").get("price_labels", [])
DATE_CONTEXT_KEYWORDS = get_site_profile("").get("release_labels", [])
SANRIO_NOISE_KEYWORDS = SITE_PROFILES["sanrio.co.jp"]["noise_keywords"]
SANRIO_NOISE_URL_PARTS = SITE_PROFILES["sanrio.co.jp"]["exclude_paths"]
SANRIO_WEAK_URL_PARTS = SITE_PROFILES["sanrio.co.jp"]["weak_paths"]
BANDAI_CATALOG_PRODUCT_MARKERS = SITE_PROFILES["bandai.co.jp"]["required_markers"]


def is_bandai_catalog_item_url(url: str) -> bool:
    return is_product_catalog_item_url(url)


def is_bandai_product_candidate(*, url: str, text: str, title: str) -> bool:
    profile = get_site_profile(url)
    return is_profile_product_catalog_candidate(
        url=url, text=text, title=title, profile=profile
    )


def build_bandai_catalog_candidate(*, source, source_log):
    profile = get_site_profile(source_log.url)
    return build_profile_product_catalog_candidate(
        source=source, source_log=source_log, profile=profile
    )


def extract_bandai_product_name(text: str, title: str) -> str:
    return extract_product_name(title, text, get_site_profile("https://www.bandai.co.jp/"))


def extract_bandai_price(text: str) -> int | None:
    return extract_price(text, get_site_profile("https://www.bandai.co.jp/"))


def extract_bandai_release_date(text: str):
    return extract_release_date(text, get_site_profile("https://www.bandai.co.jp/"))


def is_sanrio_noise_page(title: str, raw_text: str | None, url: str) -> bool:
    from .detectors.filters import should_exclude_page

    return should_exclude_page(url, title, raw_text, get_site_profile(url))


def is_sanrio_weak_path(url: str) -> bool:
    profile = get_site_profile(url)
    return any(part in url for part in profile.get("weak_paths", []))
