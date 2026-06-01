from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Keyword, Source

INITIAL_KEYWORDS = [
    ("話題の商品", "話題の商品", 1),
    ("ポケモンカード", "ポケモンカード", 1),
    ("ポケモンカード", "ポケカ", 1),
    ("ポケモンカード", "ポケカ 再販", 1),
    ("ポケモンカード", "ポケカ 予約", 1),
    ("ポケモンカード", "ポケモンカード 新弾", 1),
    ("ポケモンカード", "ポケモンカード 抽選", 1),
    ("ワンピースカード", "ワンピースカード", 1),
    ("ワンピースカード", "ワンピースカード 再販", 1),
    ("ワンピースカード", "ワンピースカード 予約", 1),
    ("ワンピースカード", "ONE PIECEカードゲーム", 1),
    ("アニメ系ガチャ", "アニメ系ガチャ", 1),
    ("アニメ系ガチャ", "ガチャガチャ 新作", 2),
    ("アニメ系ガチャ", "ガシャポン 新商品", 2),
    ("ボンボンドロップシール", "ボンボンドロップシール", 1),
    ("ちいかわ系グッズ", "ちいかわ 新商品", 1),
    ("ちいかわ系グッズ", "ちいかわ 再販", 1),
    ("サンリオ系グッズ", "サンリオ 新商品", 1),
    ("サンリオ系グッズ", "サンリオ コラボ", 1),
    ("ポケモン系グッズ", "ポケモン系グッズ", 1),
    ("ポケモン系グッズ", "ポケモンセンター 新商品", 1),
    ("スタバ コラボ商品", "スタバ 新作", 1),
    ("スタバ コラボ商品", "スタバ コラボ", 1),
    ("スタバ 季節限定商品", "スタバ 季節限定", 1),
    ("アパレルコラボ商品", "アパレルコラボ商品", 1),
    ("アパレルコラボ商品", "ユニクロ コラボ", 2),
    ("アパレルコラボ商品", "GU コラボ", 2),
    ("アパレルコラボ商品", "しまむら コラボ", 2),
    ("有名メーカーのお菓子の廃盤商品", "お菓子 廃盤", 1),
    ("有名メーカーのお菓子の廃盤商品", "有名メーカー お菓子 廃盤", 1),
    ("有名メーカーのお菓子の廃盤商品", "メーカー終売", 1),
    ("有名メーカーのお菓子の廃盤商品", "期間限定 お菓子", 2),
    ("共通", "再販", 2),
    ("共通", "入荷", 2),
    ("共通", "予約開始", 2),
    ("共通", "抽選販売", 2),
    ("共通", "売り切れ", 2),
    ("共通", "完売", 2),
    ("共通", "限定販売", 2),
]

INITIAL_SOURCES = [
    {
        "source_name": "ポケモンカード公式ニュース",
        "source_type": "official",
        "url": "https://www.pokemon-card.com/info/",
        "target_category": "ポケモンカード",
        "priority": 1,
        "memo": "Initial seed source: official news",
    },
    {
        "source_name": "ポケモンカード公式 products",
        "source_type": "official",
        "url": "https://www.pokemon-card.com/products/",
        "target_category": "ポケモンカード",
        "priority": 1,
        "memo": "Initial seed source: official products",
    },
    {
        "source_name": "ONE PIECEカード NEWS",
        "source_type": "official",
        "url": "https://www.onepiece-cardgame.com/topics/",
        "target_category": "ワンピースカード",
        "priority": 1,
        "memo": "Initial seed source: official news",
    },
    {
        "source_name": "ガシャポン発売スケジュール",
        "source_type": "official",
        "url": "https://gashapon.jp/schedule/",
        "target_category": "アニメ系ガチャ",
        "priority": 1,
        "memo": "Initial seed source: official schedule",
    },
    {
        "source_name": "サンリオニュース",
        "source_type": "official",
        "url": "https://www.sanrio.co.jp/news/",
        "target_category": "サンリオ系グッズ",
        "priority": 1,
        "memo": "Initial seed source: official news",
    },
    {
        "source_name": "スターバックス公式プレスリリース",
        "source_type": "official",
        "url": "https://www.starbucks.co.jp/press_release/",
        "target_category": "スタバ コラボ商品",
        "priority": 1,
        "memo": "Initial seed source: official press release",
    },
    {
        "source_name": "ちいかわマーケット新着商品",
        "source_type": "official",
        "url": "https://chiikawa-market.jp/",
        "target_category": "ちいかわ系グッズ",
        "priority": 1,
        "memo": "Initial seed source: new items",
    },
]


def seed_initial_keywords(db: Session) -> int:
    inserted = 0
    for category, keyword, priority in INITIAL_KEYWORDS:
        exists = db.scalar(select(Keyword).where(Keyword.keyword == keyword))
        if exists is not None:
            continue
        db.add(
            Keyword(
                category=category,
                keyword=keyword,
                priority=priority,
                is_active=True,
                memo="初期登録キーワード",
            )
        )
        inserted += 1
    db.commit()
    return inserted


def seed_initial_sources(db: Session) -> int:
    inserted = 0
    for source in INITIAL_SOURCES:
        exists = db.scalar(select(Source).where(Source.url == source["url"]))
        if exists is not None:
            for field, value in source.items():
                setattr(exists, field, value)
            exists.is_active = True
            continue
        db.add(
            Source(
                **source,
                is_active=True,
            )
        )
        inserted += 1
    db.commit()
    return inserted
