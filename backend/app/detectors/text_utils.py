import re
from datetime import date
from urllib.parse import urlparse


FULL_DATE_PATTERN = re.compile(
    r"(20[0-9]{2})[年/-]\s*([0-9]{1,2})[月/-]\s*([0-9]{1,2})"
)
MONTH_DAY_PATTERN = re.compile(
    r"([0-9]{1,2})\s*月\s*([0-9]{1,2})\s*日(?:\s*[（(][月火水木金土日][）)])?"
)


def normalize_text(text: str | None) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def contains_any(text: str, keywords: list[str] | set[str] | tuple[str, ...]) -> bool:
    return any(keyword in text for keyword in keywords if keyword)


def extract_domain(url: str) -> str:
    return urlparse(url).netloc.lower()


def clean_price_number(value: str) -> int:
    return int(value.replace(",", ""))


def build_date(year: int, month: int, day: int) -> date | None:
    try:
        return date(year, month, day)
    except ValueError:
        return None


def infer_year_from_text(text: str) -> int:
    year_match = re.search(r"20[0-9]{2}", text)
    if year_match:
        return int(year_match.group(0))
    return date.today().year


def parse_japanese_date(text: str) -> date | None:
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

