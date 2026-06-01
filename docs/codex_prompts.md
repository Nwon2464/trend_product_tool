# Codex CLI Prompts

## Prompt 1 - Read Documents and Make Plan

Use this first.

```text
このリポジトリで、AGENTS.md と docs/ 配下のMarkdownをすべて読んでください。

まずは実装に入らず、以下を行ってください。

1. 要件を読み取って、MVPとして実装すべき範囲を整理してください。
2. backend / frontend の推奨ディレクトリ構成を提案してください。
3. FastAPI + SQLite + React + TypeScript で実装する場合の開発ステップを小さなタスクに分解してください。
4. 自動購入、CAPTCHA回避、ログイン回避、過度なスクレイピングは実装対象外であることを確認してください。
5. まだコードは変更しないでください。
```

## Prompt 2 - Implement Backend Milestone 1

Use after reviewing the plan.

```text
計画は良いです。
まずは Milestone 1 の backend だけを実装してください。

範囲:
- backend に FastAPI プロジェクトを作成
- SQLite DB を作成
- Product モデルを作成
- Product の登録、一覧取得、詳細取得、更新、削除 API を作成
- GET /health を作成
- CORS設定を追加
- README に起動方法を書く

まだ frontend は作らないでください。
実装後、起動確認方法とテスト用 curl コマンドも提示してください。
```

## Prompt 3 - Add Keyword and Source APIs

```text
次に Milestone 2 を実装してください。

範囲:
- Keyword モデルとCRUD APIを追加
- Source モデルとCRUD APIを追加
- docs/database_design.md の初期キーワードを seed できる仕組みを追加
- README に seed 方法を書く
- テスト用 curl コマンドを提示

frontend はまだ作らないでください。
```

## Prompt 4 - Implement Frontend

```text
次に frontend を作成してください。

範囲:
- Vite + React + TypeScript を使用
- Product 一覧画面
- Product 登録フォーム
- Product 編集・削除
- API接続
- Keyword 一覧画面
- Source 一覧画面
- README に frontend 起動方法を書く

デザインはシンプルで構いません。
まずは動くことを優先してください。
```

## Prompt 5 - Review and Refactor

```text
現在のコードを確認してください。

以下の観点でレビューしてください。

1. 要件から外れた実装がないか
2. MVPとして過剰な実装がないか
3. ファイル構成が分かりやすいか
4. エラーハンドリングが最低限あるか
5. READMEの手順で起動できるか

問題があれば、最小限の修正案を提示してください。
まだコードは変更しないでください。
```

## Prompt 6 - Add Simple Collector Later

Use only after CRUD and frontend are complete.

```text
後続フェーズとして、許可された範囲で簡単な情報取得機能の試作を行いたいです。

まずは実装に入らず、以下を提案してください。

1. 公式サイトやRSSなど、低リスクな取得方法
2. robots.txt と利用規約を尊重する設計
3. 過度なアクセスを避ける間隔
4. 取得結果を source_logs に保存する設計
5. 重複検知の方法

自動購入、CAPTCHA回避、ログイン回避は実装しないでください。
```
