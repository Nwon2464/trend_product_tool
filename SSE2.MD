SSE実装はできていますが、現在は scraping_jobs.py 側で fetch / parse event を collectors.run_collector の前に出しているため、minimum_interval や robots_disallow で実際には取得していない場合でも「HTML取得開始」「本文解析中」と表示される可能性があります。

これを実使用向けに改善してください。

目的:
SSE terminal に表示される progress を、実際の backend 処理順序に近づけたいです。
Frontend terminal には、実際に backend collector 内で起きている処理に近いログを表示したいです。

修正内容:

1. collectors.run_collector に progress_callback オプションを追加してください。

progress_callback は optional にしてください。
既存の /collectors/run API や既存処理が壊れないようにしてください。

想定インターフェース例:

progress_callback(
  event_type: str,
  level: str,
  message: str,
  payload: dict | None = None
)

event_type の例:
- check
- skip
- fetch
- parse
- detail_fetch
- keyword
- candidate
- source_done
- error

level の例:
- info
- success
- warn
- error

2. collectors.run_collector 内の実際の処理タイミングで progress_callback を呼んでください。

最低限、以下のタイミングで callback を呼んでください。

- collector開始
- minimum_interval チェック開始
- minimum_interval により skip
- robots.txt チェック開始
- robots_disallow により skip
- fetch_url 開始
- fetch_url 完了
- parse_content 開始
- parse_content 完了
- list_to_detail 開始
- detail page fetch 開始
- detail page fetch 完了
- 商品候補シグナル検出
- duplicate_url により skip
- source_log 作成
- product_candidate 作成
- source完了
- collector内エラー

3. scraping_jobs.run_scraping_job では collectors.run_collector に progress_callback を渡してください。

progress_callback 内では append_job_event を呼び出し、ScrapingJobEvent として DB に保存してください。

例:

def progress_callback(event_type, level, message, payload=None):
    append_job_event(
        db=db,
        job=job,
        event_type=event_type,
        level=level,
        message=message,
        source=source,
        payload=payload,
    )

4. scraping_jobs.run_scraping_job 側で collectors.run_collector 実行前に出している fetch / parse event は削除、または collector_start 程度の event に変更してください。

現在のように、実際にはまだ取得していない段階で「HTML取得開始」「本文解析中」と表示しないでください。

5. skip reason を payload に入れてください。

minimum_interval の場合:

payload:
{
  "reason": "minimum_interval",
  "details": "...",
  "next_retry_seconds": 300
}

robots.txt による skip の場合:

payload:
{
  "reason": "robots_disallow",
  "details": "robots.txt disallowed this URL"
}

duplicate_url の場合:

payload:
{
  "reason": "duplicate_url",
  "details": "Already collected URL"
}

no usable item の場合:

payload:
{
  "reason": "no_usable_items",
  "details": "No product opportunity signal detected"
}

6. Frontend の SSE skip event 処理を改善してください。

現在 skip event を受け取ったときに一律で cooldownUntil を設定している場合は修正してください。

payload.reason を見て分岐してください。

- reason === "minimum_interval"
  → cooldownUntil を設定する
  → 「直近で取得済みのためスキップ。次回取得まで mm:ss」と表示

- reason === "robots_disallow"
  → cooldownUntil は設定しない
  → 「robots.txt によりスキップ」と表示

- reason === "duplicate_url"
  → cooldownUntil は設定しない
  → 「重複URLのためスキップ」と表示

- reason === "no_usable_items"
  → cooldownUntil は設定しない
  → 「対象候補なし」と表示

- その他
  → cooldownUntil は設定しない
  → payload.details または message を表示

7. Terminal 表示を reason ごとに分かりやすくしてください。

表示例:

[INFO] Collector started: ポケモンカード公式ニュース
[INFO] Checking minimum interval
[WARN] 直近で取得済みのためスキップ。次回取得まで 248秒
[INFO] Checking robots.txt
[WARN] robots.txt によりスキップ
[FETCH] HTML取得開始: https://...
[FETCH] HTML取得完了
[PARSE] 本文解析開始
[PARSE] 本文解析完了
[DETAIL] 詳細ページ取得開始: https://...
[KEYWORD] 予約開始, 再販 を検出
[CANDIDATE] 商品候補を作成しました
[DONE] Source completed

8. 既存機能を壊さないでください。

以下は維持してください。

- 既存の /collectors/run
- 既存の /scraping-jobs
- 既存の SSE endpoint
- 既存の Product CRUD
- 既存の Source CRUD
- 既存の Keyword CRUD
- 既存の ProductCandidate 表示
- 既存の Evidence Modal
- 既存の Scraping Modal UI

9. 安全方針を維持してください。

以下は実装しないでください。

- 自動購入
- CAPTCHA回避
- ログイン突破
- 購入制限回避
- 過度な高頻度 scraping

10. 実装後、動作確認してください。

確認したいこと:

- Scraping Job を作成できる
- SSE terminal に collector 内部の progress event が表示される
- minimum_interval skip 時に fetch / parse が先に表示されない
- robots_disallow skip 時に fetch / parse が先に表示されない
- minimum_interval のときだけ cooldown が設定される
- duplicate_url や no_usable_items では cooldown が設定されない
- source_logs / product_candidates が従来通り更新される