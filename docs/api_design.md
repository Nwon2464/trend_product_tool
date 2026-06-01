# Trend Product Tool - API Design

## 1. API Style

Use REST API with FastAPI.

Base URL in local development:

```text
http://localhost:8000
```

## 2. Health Check

### GET /health

Response:

```json
{
  "status": "ok"
}
```

## 3. Product API

### GET /products

Query parameters:

- category
- keyword
- status
- sales_store
- min_score
- sort_by
- sort_order
- limit
- offset

Response:

```json
[
  {
    "id": 1,
    "category": "ポケモンカード",
    "product_name": "拡張パック サンプル",
    "brand": "Pokemon",
    "price": 5400,
    "release_date": "2026-06-10",
    "sales_store": "ポケモンセンターオンライン",
    "status": "予約開始",
    "source_name": "公式サイト",
    "source_url": "https://example.com",
    "trend_score": 85,
    "memo": "MVP sample data",
    "created_at": "2026-05-31T21:00:00",
    "updated_at": "2026-05-31T21:00:00"
  }
]
```

### POST /products

Request:

```json
{
  "category": "ポケモンカード",
  "product_name": "拡張パック サンプル",
  "brand": "Pokemon",
  "price": 5400,
  "release_date": "2026-06-10",
  "sales_store": "ポケモンセンターオンライン",
  "status": "予約開始",
  "source_name": "公式サイト",
  "source_url": "https://example.com",
  "trend_score": 85,
  "memo": "MVP sample data"
}
```

### GET /products/{product_id}

Get one product.

### PUT /products/{product_id}

Update one product.

### DELETE /products/{product_id}

Delete one product.

## 4. Keyword API

### GET /keywords

Response:

```json
[
  {
    "id": 1,
    "category": "ポケモンカード",
    "keyword": "ポケカ 再販",
    "priority": 1,
    "is_active": true,
    "memo": ""
  }
]
```

### POST /keywords

Request:

```json
{
  "category": "ポケモンカード",
  "keyword": "ポケカ 再販",
  "priority": 1,
  "is_active": true,
  "memo": ""
}
```

### GET /keywords/{keyword_id}

Get one keyword.

### PUT /keywords/{keyword_id}

Update one keyword.

### DELETE /keywords/{keyword_id}

Delete one keyword.

## 5. Source API

### GET /sources

Response:

```json
[
  {
    "id": 1,
    "source_name": "ポケモンカードゲーム公式サイト",
    "source_type": "official",
    "url": "https://www.pokemon-card.com/",
    "target_category": "ポケモンカード",
    "priority": 1,
    "is_active": true,
    "memo": "公式ニュース確認用"
  }
]
```

### POST /sources

Request:

```json
{
  "source_name": "ポケモンカードゲーム公式サイト",
  "source_type": "official",
  "url": "https://www.pokemon-card.com/",
  "target_category": "ポケモンカード",
  "priority": 1,
  "is_active": true,
  "memo": "公式ニュース確認用"
}
```

### GET /sources/{source_id}

Get one source.

### PUT /sources/{source_id}

Update one source.

### DELETE /sources/{source_id}

Delete one source.

## 6. Source Log and Collector API

Automatic high-frequency scraping is not included.
The collector is manually executed and stores fetched candidates in source logs.

### GET /source-logs

Query parameters:

- source_id
- limit
- offset

### GET /source-logs/{source_log_id}

Get one source log.

### DELETE /source-logs/{source_log_id}

Delete one source log.

### POST /collectors/run

Request:

```json
{
  "source_id": 1,
  "max_items": 10,
  "respect_robots": true,
  "minimum_interval_seconds": 300
}
```

Response:

```json
{
  "source_id": 1,
  "fetched_url": "https://example.com/feed.xml",
  "created_count": 3,
  "skipped_count": 1,
  "skipped_reason": null,
  "logs": []
}
```

## 7. Notification Log API

External notification delivery is not included in the MVP.
The API stores manual notification previews and send-status records.

### GET /notification-logs

Query parameters:

- product_id
- channel
- status
- limit
- offset

### POST /notification-logs

Request:

```json
{
  "product_id": 1,
  "message": "【ポケモンカード】サンプル商品の通知プレビュー",
  "channel": "manual",
  "status": "pending",
  "sent_at": null
}
```

### GET /notification-logs/{notification_log_id}

Get one notification log.

### PUT /notification-logs/{notification_log_id}

Update one notification log.

### DELETE /notification-logs/{notification_log_id}

Delete one notification log.

## 8. Error Handling

Use simple and clear error responses.

Example:

```json
{
  "detail": "Product not found"
}
```

## 9. CORS

During local development, allow frontend origin:

```text
http://localhost:5173
```
