"""Compatibility facade for product candidate detection.

Collectors import this module, but detection behavior is implemented in
app.detectors.* so site-specific values stay profile-driven.
"""

from .detectors.engine import (
    build_candidate_from_source_log,
    get_all_status_keywords,
    get_db_keyword_matches,
    get_detection_keywords,
    get_keywords_for_statuses,
    get_matched_keywords,
    has_product_keyword_signal,
    has_product_opportunity_signal,
    has_product_page_signal,
    has_selected_status_signal,
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
    has_product_url_pattern,
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
    should_exclude_page,
)
from .detectors.profiles import DEFAULT_PROFILE, SITE_PROFILES, get_site_profile
from .detectors.scoring import (
    DETECTION_RULES,
    HIGH_VALUE_CATEGORIES,
    NEGATIVE_AVAILABILITY_KEYWORDS,
    STATUS_KEYWORD_GROUPS,
    score_for_keyword_priority,
)
from .detectors.text_utils import (
    FULL_DATE_PATTERN,
    MONTH_DAY_PATTERN,
    build_date,
    contains_any,
    extract_domain,
    infer_year_from_text,
    normalize_text,
    parse_japanese_date,
)
