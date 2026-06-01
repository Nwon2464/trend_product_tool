# Trend Product Tool

Trend Product Tool は、日本の話題商品、限定商品、再販商品、コラボ商品、廃盤商品を手動で登録・管理するローカル向けの情報収集ダッシュボードです。

このプロジェクトは自動購入ツールではありません。自動購入、決済自動化、CAPTCHA回避、ログイン回避、過度なスクレイピングは実装対象外です。

## 現在の実装範囲

- FastAPI backend
- SQLite database
- Product CRUD API
- Keyword CRUD API
- Source CRUD API
- Source log API
- Manual allowed collector API
- Notification log API
- Initial keyword seed
- Health check API
- Local frontend 用 CORS 設定
- React frontend
- Product list screen
- Product registration/edit form
- Keyword management screen
- Source management screen
- Source collection log screen
- Notification log screen

## Backend setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

API は `http://localhost:8000` で起動します。

SQLite ファイルは backend 起動時に `backend/trend_product.db` として作成されます。

## Frontend setup

```bash
cd frontend
npm install
npm run dev
```

Frontend は通常 `http://127.0.0.1:5173` で起動します。
5173 が使用中の場合、Vite は `http://127.0.0.1:5174` などの次のポートを使います。

Backend URL を変更したい場合は、frontend 側で `VITE_API_BASE_URL` を設定してください。

## API

### Health check

```bash
curl http://localhost:8000/health
```

### Create product

```bash
curl -X POST http://localhost:8000/products \
  -H "Content-Type: application/json" \
  -d '{
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
  }'
```

### List products

```bash
curl "http://localhost:8000/products?category=ポケモンカード&min_score=50&sort_by=trend_score&sort_order=desc"
```

### Get product

```bash
curl http://localhost:8000/products/1
```

### Update product

```bash
curl -X PUT http://localhost:8000/products/1 \
  -H "Content-Type: application/json" \
  -d '{"trend_score": 90, "status": "発売中"}'
```

### Delete product

```bash
curl -X DELETE http://localhost:8000/products/1
```

### List keywords

```bash
curl http://localhost:8000/keywords
```

### Create keyword

```bash
curl -X POST http://localhost:8000/keywords \
  -H "Content-Type: application/json" \
  -d '{
    "category": "ポケモンカード",
    "keyword": "ポケモンカード 抽選",
    "priority": 1,
    "is_active": true,
    "memo": ""
  }'
```

### List sources

```bash
curl http://localhost:8000/sources
```

### Create source

```bash
curl -X POST http://localhost:8000/sources \
  -H "Content-Type: application/json" \
  -d '{
    "source_name": "ポケモンカードゲーム公式サイト",
    "source_type": "official",
    "url": "https://www.pokemon-card.com/",
    "target_category": "ポケモンカード",
    "priority": 1,
    "is_active": true,
    "memo": "公式ニュース確認用"
  }'
```

### Run allowed collector manually

```bash
curl -X POST http://localhost:8000/collectors/run \
  -H "Content-Type: application/json" \
  -d '{
    "source_id": 1,
    "max_items": 10,
    "respect_robots": true,
    "minimum_interval_seconds": 300
  }'
```

### List source logs

```bash
curl http://localhost:8000/source-logs
```

## Milestone 6 manual test

Allowed collection prototype は、情報源を手動で取得し、結果を `source_logs` に保存するための機能です。
商品への自動登録は行いません。

Browser test:

1. Frontend を開く。
2. `情報源` タブを開く。
3. `新規情報源` に低リスクな URL を登録する。
   - 例: 公式 RSS、公式ニュースページ、静的なニュース一覧ページ
   - ログインが必要なページ、購入ページ、CAPTCHA があるページは使わない
4. 登録済み情報源の `取得実行` を押す。
5. `取得ログ` タブで結果を確認する。
6. もう一度同じ情報源で `取得実行` を押し、重複または取得間隔のスキップを確認する。
7. 必要なログだけ `商品候補にする` を押し、商品登録フォームに反映されることを確認する。
8. 内容を人が確認してから `商品を保存` する。

Expected behavior:

- `取得実行` は手動操作でのみ動く
- 結果は `source_logs` に保存される
- 同じ URL は重複保存されない
- 既定では同じ情報源の再取得は 300 秒以内にスキップされる
- `javascript:`, `mailto:`, `tel:` などの非 HTTP リンクは保存されない
- robots.txt で許可されない場合は取得をスキップする

Milestone 6 done criteria:

- One source can be fetched manually
- Result can be stored
- Duplicates are avoided

### List notification logs

```bash
curl http://localhost:8000/notification-logs
```

### Create manual notification log

```bash
curl -X POST http://localhost:8000/notification-logs \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": 1,
    "message": "【ポケモンカード】サンプル商品の通知プレビュー",
    "channel": "manual",
    "status": "pending",
    "sent_at": null
  }'
```

## Documents

設計資料は `docs/` 配下にあります。
