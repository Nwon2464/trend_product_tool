from __future__ import annotations

import sys
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app import candidate_detector, collectors, models  # noqa: E402
from app.database import Base  # noqa: E402


SANRIO_RSS = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <item>
    <title>Sanrio＋会員限定 プレゼントキャンペーン</title>
    <link>https://www.sanrio.co.jp/news/sanrioplus/campaign/</link>
    <description>デジタルコンテンツ 壁紙 プレゼントキャンペーン</description>
  </item>
  <item>
    <title>サンリオカフェのお知らせ</title>
    <link>https://www.sanrio.co.jp/news/spots/cafe/</link>
    <description>イベントのお知らせ</description>
  </item>
  <item>
    <title>「クロミ 新商品マスコット」発売予定のお知らせ | サンリオ</title>
    <link>https://www.sanrio.co.jp/news/goods/kuromi-202606/</link>
    <description>発売日：2026年6月10日 価格 1,980円（税込） 全国の店舗で販売開始</description>
  </item>
</channel></rss>
"""

BANDAI_RSS = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <item>
    <title>機動戦士ガンダム TEST FIGURE | バンダイ 商品・サービスサイト</title>
    <link>https://www.bandai.co.jp/catalog/item.php?foo=1&amp;jan_cd=4570118000000</link>
    <description>
      TOP 商品情報 機動戦士ガンダム TEST FIGURE 機動戦士ガンダム TEST FIGURE
      商品情報 価格 3,300円(税込) 売場 全国量販店
      発売時期 2026年6月15日発売 対象年齢 15才以上
    </description>
  </item>
</channel></rss>
"""

STARBUCKS_RSS = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <item>
    <title>バナナ アフォガート フラペチーノ®</title>
    <link>https://stories.starbucks.co.jp/press/2026/pr2026-05-20/</link>
    <description>
      商品名／価格 バナナ アフォガート フラペチーノ® Tall 687円
      2026年5月27日より発売 新商品 季節限定
      一時的な欠品または早期に販売終了する場合がございます。
    </description>
  </item>
</channel></rss>
"""


@contextmanager
def patched_fetch(fixtures: dict[str, str]) -> Iterator[None]:
    original_fetch = collectors.fetch_url

    def fake_fetch(url: str) -> tuple[bytes, str]:
        if url not in fixtures:
            raise AssertionError(f"Unexpected fetch URL: {url}")
        return fixtures[url].encode("utf-8"), "application/rss+xml"

    collectors.fetch_url = fake_fetch
    try:
        yield
    finally:
        collectors.fetch_url = original_fetch


def make_session() -> Session:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)
    return session_factory()


def make_source(
    db: Session,
    *,
    source_name: str,
    source_type: str,
    url: str,
    target_category: str,
) -> models.Source:
    source = models.Source(
        source_name=source_name,
        source_type=source_type,
        url=url,
        target_category=target_category,
        priority=1,
        is_active=True,
    )
    db.add(source)
    db.commit()
    db.refresh(source)
    return source


def make_source_log(title: str, url: str, raw_text: str) -> models.SourceLog:
    return models.SourceLog(
        id=1,
        source_id=1,
        title=title,
        url=url,
        raw_text=raw_text,
        detected_at=datetime.now(),
    )


def assert_direct_detector_cases() -> None:
    sanrio_source = models.Source(
        id=1,
        source_name="サンリオ公式",
        source_type="official",
        url="https://www.sanrio.co.jp/news/goods/",
        target_category="サンリオ",
        priority=1,
        is_active=True,
    )
    bandai_source = models.Source(
        id=2,
        source_name="バンダイ公式",
        source_type="official",
        url="https://www.bandai.co.jp/catalog/",
        target_category="アニメ系ガチャ",
        priority=1,
        is_active=True,
    )
    starbucks_source = models.Source(
        id=3,
        source_name="スターバックス公式",
        source_type="official",
        url="https://stories.starbucks.co.jp/press/2026/pr2026-05-20/",
        target_category="スタバ",
        priority=1,
        is_active=True,
    )

    sanrio_goods = candidate_detector.build_candidate_from_source_log(
        source=sanrio_source,
        source_log=make_source_log(
            "「クロミ 新商品マスコット」発売予定のお知らせ | サンリオ",
            "https://www.sanrio.co.jp/news/goods/kuromi-202606/",
            "発売日：2026年6月10日 価格 1,980円（税込） 全国の店舗で販売開始",
        ),
    )
    assert sanrio_goods is not None

    sanrio_plus = candidate_detector.build_candidate_from_source_log(
        source=sanrio_source,
        source_log=make_source_log(
            "Sanrio＋会員限定 プレゼントキャンペーン",
            "https://www.sanrio.co.jp/news/sanrioplus/campaign/",
            "デジタルコンテンツ 壁紙 プレゼントキャンペーン",
        ),
    )
    assert sanrio_plus is None

    sanrio_spots = candidate_detector.build_candidate_from_source_log(
        source=sanrio_source,
        source_log=make_source_log(
            "サンリオカフェのお知らせ",
            "https://www.sanrio.co.jp/news/spots/cafe/",
            "イベントのお知らせ",
        ),
    )
    assert sanrio_spots is None

    bandai = candidate_detector.build_candidate_from_source_log(
        source=bandai_source,
        source_log=make_source_log(
            "機動戦士ガンダム TEST FIGURE | バンダイ 商品・サービスサイト",
            "https://www.bandai.co.jp/catalog/item.php?foo=1&jan_cd=4570118000000",
            "TOP 商品情報 機動戦士ガンダム TEST FIGURE 機動戦士ガンダム TEST FIGURE "
            "商品情報 価格 3,300円(税込) 売場 全国量販店 "
            "発売時期 2026年6月15日発売 対象年齢 15才以上",
        ),
    )
    assert bandai is not None
    assert bandai.product_name == "機動戦士ガンダム TEST FIGURE"
    assert str(bandai.release_date) == "2026-06-15"
    assert bandai.price == 3300

    starbucks = candidate_detector.build_candidate_from_source_log(
        source=starbucks_source,
        source_log=make_source_log(
            "バナナ アフォガート フラペチーノ®",
            "https://stories.starbucks.co.jp/press/2026/pr2026-05-20/",
            "商品名／価格 バナナ アフォガート フラペチーノ® Tall 687円 "
            "2026年5月27日より発売 新商品 季節限定 "
            "一時的な欠品または早期に販売終了する場合がございます。",
        ),
    )
    assert starbucks is not None
    assert starbucks.product_name == "バナナ アフォガート フラペチーノ®"
    assert str(starbucks.release_date) == "2026-05-27"
    assert starbucks.price == 687
    assert "販売終了" not in (starbucks.detected_keywords or "")

    negative_only = candidate_detector.build_candidate_from_source_log(
        source=starbucks_source,
        source_log=make_source_log(
            "販売終了のお知らせ",
            "https://stories.starbucks.co.jp/press/2026/ended/",
            "販売終了 完売 在庫なし 受付終了 終了しました",
        ),
    )
    assert negative_only is None


def assert_collector_smoke() -> None:
    db = make_session()
    sanrio_url = "https://www.sanrio.co.jp/news/goods/feed.xml"
    bandai_url = "https://www.bandai.co.jp/catalog/feed.xml"
    starbucks_url = "https://stories.starbucks.co.jp/press/feed.xml"
    sanrio_source = make_source(
        db,
        source_name="サンリオ公式",
        source_type="official",
        url=sanrio_url,
        target_category="サンリオ",
    )
    bandai_source = make_source(
        db,
        source_name="バンダイ公式",
        source_type="official",
        url=bandai_url,
        target_category="アニメ系ガチャ",
    )
    starbucks_source = make_source(
        db,
        source_name="スターバックス公式",
        source_type="official",
        url=starbucks_url,
        target_category="スタバ",
    )

    sanrio_events: list[tuple[str, str, str, dict | None]] = []
    bandai_events: list[tuple[str, str, str, dict | None]] = []
    starbucks_events: list[tuple[str, str, str, dict | None]] = []
    fixtures = {sanrio_url: SANRIO_RSS, bandai_url: BANDAI_RSS, starbucks_url: STARBUCKS_RSS}
    with patched_fetch(fixtures):
        sanrio_result = collectors.run_collector(
            db,
            source=sanrio_source,
            max_items=10,
            max_candidates=1,
            respect_robots=False,
            minimum_interval_seconds=0,
            progress_callback=lambda *event: sanrio_events.append(event),
        )
        assert len(sanrio_result.candidates) == 1
        assert sanrio_result.candidates[0].product_name == "クロミ 新商品マスコット"
        assert sanrio_result.skipped_count == 2
        assert any("candidate_limit_reached" in item for item in sanrio_result.skipped_details)
        assert any(event[0] == "candidate_limit" for event in sanrio_events)

        sanrio_duplicate = collectors.run_collector(
            db,
            source=sanrio_source,
            max_items=10,
            max_candidates=1,
            respect_robots=False,
            minimum_interval_seconds=0,
        )
        assert len(sanrio_duplicate.candidates) == 0
        assert any("duplicate_url:" in item for item in sanrio_duplicate.skipped_details)

        bandai_result = collectors.run_collector(
            db,
            source=bandai_source,
            max_items=10,
            max_candidates=1,
            respect_robots=False,
            minimum_interval_seconds=0,
            progress_callback=lambda *event: bandai_events.append(event),
        )
        assert len(bandai_result.candidates) == 1
        bandai_candidate = bandai_result.candidates[0]
        assert bandai_candidate.product_name == "機動戦士ガンダム TEST FIGURE"
        assert str(bandai_candidate.release_date) == "2026-06-15"
        assert bandai_candidate.price == 3300
        assert any("candidate_limit_reached" in item for item in bandai_result.skipped_details)
        assert any(event[0] == "candidate_limit" for event in bandai_events)

        starbucks_result = collectors.run_collector(
            db,
            source=starbucks_source,
            max_items=10,
            max_candidates=1,
            respect_robots=False,
            minimum_interval_seconds=0,
            progress_callback=lambda *event: starbucks_events.append(event),
        )
        assert len(starbucks_result.candidates) == 1
        starbucks_candidate = starbucks_result.candidates[0]
        assert starbucks_candidate.product_name == "バナナ アフォガート フラペチーノ®"
        assert str(starbucks_candidate.release_date) == "2026-05-27"
        assert starbucks_candidate.price == 687
        assert "販売終了" not in (starbucks_candidate.detected_keywords or "")
        assert any("candidate_limit_reached" in item for item in starbucks_result.skipped_details)
        assert any(event[0] == "candidate_limit" for event in starbucks_events)


def main() -> None:
    assert_direct_detector_cases()
    assert_collector_smoke()
    print("detector regression check passed")


if __name__ == "__main__":
    main()
