# Trend Product Tool - Database Design

## 1. Database

MVP uses SQLite.

File example:

```text
backend/trend_product.db
```

## 2. Tables

### 2.1 products

Stores product information.

Fields:

- id
- category
- product_name
- brand
- price
- release_date
- sales_store
- status
- source_name
- source_url
- trend_score
- memo
- created_at
- updated_at

Example status values:

- 予約開始
- 発売予定
- 発売中
- 再販
- 抽選販売
- 売り切れ
- 完売
- 廃盤
- 不明

### 2.2 keywords

Stores monitoring keywords.

Fields:

- id
- category
- keyword
- priority
- is_active
- memo
- created_at
- updated_at

Priority:

- 1: High
- 2: Middle
- 3: Low

### 2.3 sources

Stores information sources.

Fields:

- id
- source_name
- source_type
- url
- target_category
- priority
- is_active
- memo
- created_at
- updated_at

Source type examples:

- official
- retail
- summary
- sns_x
- sns_instagram
- news
- manual
- other

### 2.4 source_logs

Stores raw source detection logs.

Fields:

- id
- source_id
- title
- url
- raw_text
- detected_at
- created_at

This is mainly for later automation.

### 2.5 notification_logs

Stores notification records.

Fields:

- id
- product_id
- message
- channel
- status
- sent_at
- created_at

Channel examples:

- discord
- line
- email
- manual

Status examples:

- pending
- sent
- failed

## 3. Initial Product Model

Python model idea:

```python
class Product:
    id: int
    category: str
    product_name: str
    brand: str | None
    price: int | None
    release_date: date | None
    sales_store: str | None
    status: str
    source_name: str | None
    source_url: str | None
    trend_score: int
    memo: str | None
    created_at: datetime
    updated_at: datetime
```

## 4. Initial Seed Keywords

The app should include these as initial data:

- 話題の商品
- ポケモンカード
- ポケカ
- ポケカ 再販
- ポケカ 予約
- ワンピースカード
- ワンピースカード 再販
- ワンピースカード 予約
- アニメ系ガチャ
- ガチャガチャ 新作
- ガシャポン 新商品
- ボンボンドロップシール
- ちいかわ 新商品
- ちいかわ 再販
- サンリオ 新商品
- サンリオ コラボ
- ポケモン系グッズ
- ポケモンセンター 新商品
- スタバ 新作
- スタバ コラボ
- スタバ 季節限定
- アパレルコラボ商品
- ユニクロ コラボ
- GU コラボ
- しまむら コラボ
- お菓子 廃盤
- 有名メーカー お菓子 廃盤
- メーカー終売
- 期間限定 お菓子

## 5. Duplicate Prevention

For MVP, duplicates can be checked by:

- product_name
- source_url
- release_date

Later, use more advanced normalization.

## 6. Index Suggestions

Later, add indexes for:

- category
- product_name
- status
- trend_score
- release_date
- source_url
