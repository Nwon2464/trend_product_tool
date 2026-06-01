# Trend Product Tool - Data Sources

## 1. Source Policy

情報源は、信頼度と実装難易度に応じて段階的に追加する。

最初のMVPでは、情報源を登録・管理できるようにするが、自動取得はまだ実装しない。

## 2. Source Priority

### Priority A - Official Sources

公式情報は最も信頼度が高い。

Examples:

- ポケモンカードゲーム公式サイト
- ONE PIECEカードゲーム公式サイト
- バンダイ ガシャポン公式
- ちいかわ公式サイト / 公式X
- サンリオ公式サイト
- ポケモンセンターオンライン
- スターバックス公式サイト
- スターバックス公式プレスリリース
- ユニクロ公式
- GU公式
- しまむら公式
- 各お菓子メーカー公式サイト

### Priority B - Retail / EC Sources

販売開始や在庫復活を確認するために使う。

Examples:

- Amazon
- 楽天市場
- 楽天ブックス
- Yahoo!ショッピング
- セブンネットショッピング
- 駿河屋
- あみあみ
- ヨドバシ.com
- ビックカメラ.com
- トイザらス
- ポケモンセンターオンライン
- プレミアムバンダイ
- ガシャポンオンライン

### Priority C - Summary / Release Information Sites

発売日や入荷情報をまとめて確認するために使う。

Examples:

- 入荷Now
- ホビー系ニュースサイト
- アニメグッズ発売情報サイト
- ガチャガチャ発売情報まとめ
- 食品新商品ニュースサイト
- コンビニ新商品まとめサイト

### Priority D - SNS

リアルタイム性が高いが、API制限や規約確認が必要。

Examples:

- X
- Instagram
- YouTube
- TikTok

MVPでは実装しない。
後続フェーズで検討する。

## 3. Initial Source Candidates

### Pokemon Card

- ポケモンカードゲーム公式サイト
- ポケモンセンターオンライン
- Amazon
- 楽天ブックス
- セブンネットショッピング
- 入荷Now
- X keyword: ポケカ 再販
- X keyword: ポケモンカード 予約

### One Piece Card

- ONE PIECEカードゲーム公式サイト
- プレミアムバンダイ
- バンダイカードショップ関連情報
- Amazon
- 楽天ブックス
- セブンネットショッピング
- 入荷Now
- X keyword: ワンピースカード 再販
- X keyword: ワンピースカード 予約

### Anime Gacha

- ガシャポン公式
- ガシャポンオンライン
- タカラトミーアーツ
- カプセルトイ専門店サイト
- アニメグッズニュースサイト
- X keyword: ガチャガチャ 新作
- X keyword: ガシャポン 新商品

### Bonbon Drop Seal

- メーカー公式情報
- キャラクターグッズ系ニュース
- 文具・シール関連EC
- X keyword: ボンボンドロップシール
- Instagram hashtag: ボンボンドロップシール

### Chiikawa / Sanrio / Pokemon Goods

- ちいかわ公式
- ちいかわマーケット
- サンリオ公式
- サンリオオンラインショップ
- ポケモンセンターオンライン
- キャラクターグッズニュースサイト
- X keyword: ちいかわ 新商品
- X keyword: サンリオ コラボ

### Starbucks

- スターバックス公式サイト
- スターバックス公式プレスリリース
- スターバックス公式オンラインストア
- X keyword: スタバ 新作
- X keyword: スタバ コラボ
- Instagram hashtag: スタバ新作

### Apparel Collaboration

- ユニクロ公式
- GU公式
- しまむら公式
- ZOZOTOWN
- 各ブランド公式ニュース
- X keyword: ユニクロ コラボ
- X keyword: GU コラボ
- X keyword: しまむら コラボ

### Discontinued Snacks

- メーカー公式ニュース
- コンビニ新商品情報
- 食品新聞系サイト
- SNS口コミ
- X keyword: お菓子 廃盤
- X keyword: メーカー終売
- X keyword: 期間限定 お菓子

## 4. Source Types

Use these source types in the database:

- official
- retail
- summary
- sns_x
- sns_instagram
- news
- manual
- other

## 5. MVP Handling

In MVP, the user can manually register sources.

The system should not automatically crawl these sources yet.

Required functions:

- Add source
- List sources
- Update source
- Delete source
- Activate/deactivate source
- Assign category
- Assign priority

## 6. Later Automation Policy

When automatic collection is added later:

1. Prefer official RSS or official news pages.
2. Respect robots.txt and website terms.
3. Avoid high-frequency requests.
4. Cache results.
5. Add rate limits.
6. Store source URL and collection timestamp.
7. Do not bypass login or CAPTCHA.
