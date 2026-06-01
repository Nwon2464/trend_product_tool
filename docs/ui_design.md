# Trend Product Tool - UI Design

## 1. UI Goal

最初の画面はシンプルにする。

目的は、商品情報を早く登録し、一覧で確認できること。

## 2. Required Screens

### 2.1 Product List Screen

Main screen.

Display columns:

- ID
- Category
- Product name
- Brand
- Price
- Release date
- Sales store
- Status
- Source name
- Trend score
- Created at
- Actions

Actions:

- Detail
- Edit
- Delete
- Open source URL

Filters:

- Category
- Keyword
- Status
- Minimum score

Sort:

- Created date desc
- Release date asc
- Trend score desc

### 2.2 Product Create / Edit Screen

Fields:

- Category
- Product name
- Brand
- Price
- Release date
- Sales store
- Status
- Source name
- Source URL
- Trend score
- Memo

Validation:

- Product name is required
- Category is required
- Trend score should be 0-100
- Price should be positive number if entered
- Source URL should be URL if entered

### 2.3 Keyword Management Screen

Display columns:

- Category
- Keyword
- Priority
- Active
- Memo
- Actions

Actions:

- Add
- Edit
- Delete
- Activate/deactivate

### 2.4 Source Management Screen

Display columns:

- Source name
- Source type
- URL
- Target category
- Priority
- Active
- Memo
- Actions

Actions:

- Add
- Edit
- Delete
- Open URL
- Activate/deactivate
- Run allowed collection manually

### 2.5 Source Log Screen

Display columns:

- ID
- Source ID
- Title
- URL
- Product candidate status
- Detected at
- Actions

Actions:

- Open URL
- Fill product form from source log
- Delete

### 2.6 Notification Log Screen

Display columns:

- ID
- Product ID
- Channel
- Status
- Message
- Created at
- Actions

Actions:

- Create manual notification log from product list
- Mark as sent
- Delete

## 3. Navigation

Simple navigation:

```text
Product List | Add Product | Keywords | Sources | Source Logs | Notification Logs
```

## 4. Status Display

Recommended status options:

- 予約開始
- 発売予定
- 発売中
- 再販
- 抽選販売
- 売り切れ
- 完売
- 廃盤
- 不明

## 5. Trend Score Display

Score labels:

- 80-100: High
- 60-79: Watch
- 40-59: Low
- 0-39: Ignore

MVP can use simple text labels.

Example:

```text
85 / High
65 / Watch
30 / Ignore
```

## 6. Layout

MVP layout:

- Header
- Navigation
- Main content
- Table
- Form

Avoid complex design in the first version.

## 7. Future UI Ideas

Later, add:

- Dashboard cards
- Trend score chart
- Category distribution chart
- New product timeline
- Notification history
- CSV export button
- Dark mode
