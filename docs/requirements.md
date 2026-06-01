# Trend Product Tool - MVP Requirements

## 1. Service Name

作業名:

**話題商品・最新情報収集ツール**

英語名:

**Trend Product Tool**

## 2. Service Goal

話題商品、限定商品、再販商品、コラボ商品、廃盤商品の情報を収集・整理し、商品名、価格、発売日、販売店舗、情報元URL、注目度スコアを一覧化する。

このツールは、メルカリなどで売れやすい可能性のある商品を早く見つけるためのリサーチ補助ツールである。

ただし、MVPでは自動購入や決済自動化は行わない。

## 3. Target Keywords and Categories

最初にユーザーが指定したキーワードは、必ず初期データとして含める。

### Main Categories

- 話題の商品
- ポケモンカード
- ワンピースカード
- アニメ系ガチャ
- ボンボンドロップシール
- ちいかわ・サンリオ・ポケモン系のグッズ
- スタバ コラボ・季節限定商品
- アパレルコラボ商品
- 有名メーカーのお菓子の廃盤商品

### Initial Keywords

- ポケモンカード
- ポケカ
- ポケカ 再販
- ポケカ 予約
- ポケモンカード 新弾
- ポケモンカード 抽選
- ワンピースカード
- ワンピースカード 再販
- ワンピースカード 予約
- ONE PIECEカードゲーム
- アニメ系ガチャ
- ガチャガチャ 新作
- ガシャポン 新商品
- ボンボンドロップシール
- ちいかわ 新商品
- ちいかわ 再販
- サンリオ 新商品
- サンリオ コラボ
- ポケモンセンター 新商品
- スタバ 新作
- スタバ コラボ
- スタバ 季節限定
- アパレル コラボ
- ユニクロ コラボ
- GU コラボ
- しまむら コラボ
- お菓子 廃盤
- 期間限定 お菓子
- メーカー終売
- 再販
- 入荷
- 予約開始
- 抽選販売
- 売り切れ
- 完売
- 限定販売

## 4. MVP Features

### 4.1 Product Management

The user can manually register product information.

Required fields:

- Category
- Product name
- Brand
- Price
- Release date
- Sales store
- Status
- Source name
- Source URL
- Memo
- Trend score

### 4.2 Product List

The user can view all registered products in a table/list format.

The list should show:

- Category
- Product name
- Price
- Release date
- Store
- Status
- Source
- Trend score
- Created date

### 4.3 Product Search / Filter

The user can filter products by:

- Category
- Keyword
- Status
- Store
- Minimum trend score

### 4.4 Keyword Management

The user can register and manage monitoring keywords.

Fields:

- Keyword
- Category
- Priority
- Is active
- Memo

### 4.5 Source Management

The user can manage information sources.

Fields:

- Source name
- Source type
- URL
- Target category
- Priority
- Is active
- Memo

### 4.6 Data Storage

The MVP uses SQLite.

Reason:

- Easy local development
- No server setup required
- Good enough for first prototype

### 4.7 API

The backend provides REST APIs through FastAPI.

Minimum API groups:

- Product API
- Keyword API
- Source API

### 4.8 Frontend

The frontend provides a simple dashboard.

Minimum screens:

- Product list screen
- Product registration/edit form
- Keyword management screen
- Source management screen

## 5. Out of Scope for MVP

The following are not included in the first MVP:

- X API integration
- Instagram API integration
- Automatic scraping
- Automatic purchasing
- CAPTCHA bypass
- Login automation
- Mercari price scraping
- Payment automation
- Cloud deployment
- User authentication

## 6. Later Features

After the MVP works:

- Official site monitoring
- RSS monitoring
- HTML scraping for allowed pages
- Discord notification
- LINE notification
- Trend scoring automation
- Mercari price memo
- X keyword monitoring
- Instagram hashtag monitoring
- CSV export
- Dashboard charts
