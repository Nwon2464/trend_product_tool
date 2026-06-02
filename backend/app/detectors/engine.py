import json

from .. import models, schemas
from .extractors import (
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
from .filters import (
    PRODUCT_SIGNAL_KEYWORDS,
    PRODUCT_URL_HINTS,
    SELECTED_STATUS_PRODUCT_SIGNAL_KEYWORDS,
    has_excluded_keyword,
    has_sales_signal,
    is_allowed_path,
    is_noisy_title,
    should_exclude_page,
)
from .profiles import get_site_profile
from .scoring import (
    DETECTION_RULES,
    HIGH_VALUE_CATEGORIES,
    STATUS_KEYWORD_GROUPS,
    score_for_keyword_priority,
    score_keyword_matches,
    score_price,
    score_product_url_pattern,
    score_release_date,
    score_sales_signals,
)


def build_candidate_from_source_log(
    *,
    source: models.Source,
    source_log: models.SourceLog,
    selected_statuses: list[str] | None = None,
    db_keywords: list[models.Keyword] | None = None,
) -> schemas.ProductCandidateCreate | None:
    haystack = f"{source_log.title}\n{source_log.raw_text or ''}"
    profile = get_site_profile(source_log.url)

    if is_profile_product_catalog_candidate(
        url=source_log.url,
        text=haystack,
        title=source_log.title,
        profile=profile,
    ):
        return build_profile_product_catalog_candidate(
            source=source, source_log=source_log, profile=profile
        )

    if should_exclude_page(source_log.url, source_log.title, source_log.raw_text, profile):
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

    matched, score, reasons = score_keyword_matches(haystack)
    db_keyword_matches = get_db_keyword_matches(haystack, db_keywords)
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
        if not has_sales_signal(haystack, profile):
            return None
        product_page_only = True
        matched.append("商品ページ候補")
        score += 4
        reasons.append("商品ページ候補")

    if not matched:
        return None

    price = extract_price(haystack, profile)
    release_date, release_date_reason = extract_release_date_with_reason(haystack, profile)
    if product_page_only and price is None and release_date is None:
        return None
    sales_store = source.source_name
    product_name = extract_product_name(source_log.title, haystack, profile)
    candidate_category = (
        db_keyword_matches[0].category if db_keyword_matches else source.target_category
    )

    if price is not None:
        price_score, price_reason = score_price()
        score += price_score
        reasons.append(price_reason)
    if release_date is not None:
        release_score, _default_reason = score_release_date()
        score += release_score
        reasons.append(release_date_reason)

    source_score, source_reason = score_sales_signals(source.source_type, matched)
    score += source_score
    if source_reason:
        reasons.append(source_reason)

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


def has_product_opportunity_signal(
    *,
    title: str,
    raw_text: str | None,
    url: str,
    source: models.Source,
    db_keywords: list[models.Keyword] | None = None,
) -> bool:
    haystack = f"{title}\n{raw_text or ''}"
    profile = get_site_profile(url)
    if is_profile_product_catalog_candidate(url=url, text=haystack, title=title, profile=profile):
        return True

    if should_exclude_page(url, title, raw_text, profile):
        return False

    if any(keyword in haystack for keyword in get_detection_keywords()):
        return True

    if get_db_keyword_matches(haystack, db_keywords):
        return True

    return has_product_page_signal(
        title=title, raw_text=raw_text, url=url, source=source
    )


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
    profile = get_site_profile(url)
    if is_profile_product_catalog_candidate(url=url, text=haystack, title=title, profile=profile):
        return True
    if should_exclude_page(url, title, raw_text, profile):
        return False

    status_keywords = set(selected_status_keywords or [])

    for keyword in get_db_keyword_matches(haystack, db_keywords):
        if not is_status_only_keyword(keyword.keyword, status_keywords):
            return True

    if any(
        keyword in haystack
        for keyword in SELECTED_STATUS_PRODUCT_SIGNAL_KEYWORDS
        if keyword not in status_keywords
    ):
        return True

    return has_product_page_signal(
        title=title, raw_text=raw_text, url=url, source=source
    )


def has_product_page_signal(
    *,
    title: str,
    raw_text: str | None,
    url: str,
    source: models.Source,
) -> bool:
    profile = get_site_profile(url)
    if is_profile_product_catalog_candidate(
        url=url, text=f"{title}\n{raw_text or ''}", title=title, profile=profile
    ):
        return True
    if "productType=" in url:
        return False
    if not is_allowed_path(url, profile):
        return False
    haystack = f"{title}\n{raw_text or ''}\n{source.target_category}"
    has_product_word = any(keyword in haystack for keyword in PRODUCT_SIGNAL_KEYWORDS)
    has_url_hint = any(hint in url for hint in PRODUCT_URL_HINTS)
    title_is_specific = len(title.strip()) >= 6 and not is_noisy_title(title)
    return title_is_specific and has_product_word and has_url_hint


def is_profile_product_catalog_candidate(
    *, url: str, text: str, title: str, profile: dict
) -> bool:
    if profile.get("source_type") != "product_catalog":
        return False
    if not has_product_url_pattern(url, profile):
        return False
    product_name = extract_product_name(title, text, profile)
    if len(product_name) < 4 or is_noisy_title(product_name):
        return False
    required_markers = profile.get("required_markers", [])
    return any(marker in text for marker in required_markers)


def build_profile_product_catalog_candidate(
    *,
    source: models.Source,
    source_log: models.SourceLog,
    profile: dict,
) -> schemas.ProductCandidateCreate | None:
    haystack = f"{source_log.title}\n{source_log.raw_text or ''}"
    if not is_profile_product_catalog_candidate(
        url=source_log.url, text=haystack, title=source_log.title, profile=profile
    ):
        return None

    product_name = extract_product_name(source_log.title, haystack, profile)
    price = extract_price(haystack, profile)
    release_date = extract_release_date(haystack, profile)

    base_score, base_reason = score_product_url_pattern(profile)
    matched = [str(profile.get("catalog_keyword", "公式商品ページ"))]
    reasons = [base_reason]
    score = base_score

    if release_date is not None:
        matched.append("発売日")
        score += 10
        reasons.append("発売時期ラベルから日付抽出")
    if price is not None:
        matched.append("価格情報")
        score += 8
        reasons.append("価格ラベルから価格抽出")
    if source.source_type == "official":
        score += 12
        reasons.append("公式情報源")
    if product_name != source_log.title:
        reasons.append("商品名を整形")

    return schemas.ProductCandidateCreate(
        source_log_id=source_log.id,
        category=source.target_category,
        product_name=product_name,
        price=price,
        release_date=release_date,
        sales_store=source.source_name,
        source_url=source_log.url,
        detected_reason="; ".join(reasons),
        detected_keywords=json.dumps(sorted(set(matched)), ensure_ascii=False),
        profit_expectation=min(score, 100),
        candidate_status="new",
    )


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


def get_db_keyword_matches(
    text: str, db_keywords: list[models.Keyword] | None
) -> list[models.Keyword]:
    if not db_keywords:
        return []
    return [
        keyword
        for keyword in db_keywords
        if keyword.is_active and keyword.keyword and keyword.keyword in text
    ]


def is_status_only_keyword(keyword: str, selected_status_keywords: set[str]) -> bool:
    status_keywords = get_all_status_keywords() | selected_status_keywords
    return keyword in status_keywords


def is_product_catalog_item_url(url: str) -> bool:
    profile = get_site_profile(url)
    return profile.get("source_type") == "product_catalog" and has_product_url_pattern(
        url, profile
    )


def is_noise_page(title: str, raw_text: str | None, url: str) -> bool:
    profile = get_site_profile(url)
    return should_exclude_page(url, title, raw_text, profile)


def is_weak_path_without_sales_signal(url: str, text: str) -> bool:
    profile = get_site_profile(url)
    return any(part in url for part in profile.get("weak_paths", [])) and not has_sales_signal(
        text, profile
    )

