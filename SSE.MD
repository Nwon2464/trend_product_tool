このプロジェクトに SSE(Server-Sent Events) ベースの Scraping Job Progress 機能を追加してください。

目的:
現在の Scraping Modal は、フロントエンド側で擬似的にログを追加する方式です。
しかし今後は scraping 対象 source が20件以上になり、さらに将来的には特定時刻に自動 scraping するスケジューラーも追加する予定です。

そのため、Scraping 実行を単発 API ではなく「Scraping Job」として扱い、
Backend 側で進行状況を記録し、Frontend は SSE で進行ログを受信して、
右側の terminal 風 UI にリアルタイム表示できるようにしてください。

重要:
- WebSocket ではなく SSE を使ってください。
- 自動購入、CAPTCHA回避、ログイン突破、購入制限回避は実装しないでください。
- 既存の安全方針、robots.txt確認、minimum interval は維持してください。
- 既存の Product / Source / SourceLog / ProductCandidate の基本機能を壊さないでください。

==================================================
1. 全体アーキテクチャ
==================================================

現在:
Frontend
  → POST /collectors/run
  → Backend scraping完了まで待つ
  → 結果を受け取る

変更後:
Frontend
  → POST /scraping-jobs
  → Backend が job_id を返す
  → Backend は background task で scraping を実行
  → Frontend は GET /scraping-jobs/{job_id}/events に SSE 接続
  → Backend は scraping progress event を逐次送信
  → Frontend は terminal UI にログを表示

処理フロー:
1. ユーザーが Scraping Modal で複数 source を選択
2. 「選択したURLを一括Scraping」をクリック
3. Frontend が POST /scraping-jobs を呼ぶ
4. Backend が ScrapingJob を作成し job_id を返す
5. Backend が background task で selected source を順番に scraping
6. 各段階で ScrapingJobEvent を作成
7. Frontend が SSE で events を受信
8. terminal にリアルタイムログ表示
9. job 完了後、product_candidates / source_logs を再取得

==================================================
2. Backend: DB Model 追加
==================================================

以下の model を追加してください。

ScrapingJob:
- id: int
- job_uid: str  # frontend/SSEで使う一意ID。uuid推奨
- status: str   # queued / running / completed / failed / cancelled
- target_category: str | null
- selected_statuses: str | null  # JSON文字列でも可
- source_ids: str                # JSON文字列でも可
- total_sources: int
- completed_sources: int
- failed_sources: int
- skipped_sources: int
- created_logs_count: int
- created_candidates_count: int
- started_at: datetime | null
- finished_at: datetime | null
- error_message: str | null
- created_at: datetime
- updated_at: datetime

ScrapingJobEvent:
- id: int
- job_id: int
- event_type: str
  # queued / start / source_start / fetch / parse / keyword / candidate / skip / warn / error / source_done / done
- level: str
  # info / success / warn / error
- message: str
- source_id: int | null
- source_name: str | null
- source_url: str | null
- payload: str | null  # JSON文字列でも可
- created_at: datetime

既存の CollectionRun は残してください。
ScrapingJob は batch job 全体の管理用、
CollectionRun は source 単位の実行履歴として扱ってください。

==================================================
3. Backend: Schema 追加
==================================================

以下の Pydantic schema を追加してください。

ScrapingJobCreateRequest:
- source_ids: list[int]
- target_category: str | None
- selected_statuses: list[str] | None
- max_items_per_source: int = 10
- respect_robots: bool = True
- minimum_interval_seconds: int = 300

ScrapingJobCreateResponse:
- job_id: str
- status: str
- total_sources: int
- message: str

ScrapingJobRead:
- job_id: str
- status: str
- target_category: str | None
- selected_statuses: list[str] | None
- total_sources: int
- completed_sources: int
- failed_sources: int
- skipped_sources: int
- created_logs_count: int
- created_candidates_count: int
- started_at: datetime | None
- finished_at: datetime | None
- error_message: str | None

ScrapingJobEventRead:
- id: int
- event_type: str
- level: str
- message: str
- source_id: int | None
- source_name: str | None
- source_url: str | None
- payload: dict | None
- created_at: datetime

==================================================
4. Backend: API 追加
==================================================

以下の endpoints を追加してください。

POST /scraping-jobs
- 複数 source_id を受け取る
- ScrapingJob を queued で作成
- BackgroundTasks または asyncio task で scraping job を開始
- job_id を返す
- この API は scraping 完了まで待たない

GET /scraping-jobs/{job_id}
- job status を返す

GET /scraping-jobs/{job_id}/events
- SSE endpoint
- text/event-stream を返す
- ScrapingJobEvent を作成日時順に送信
- 新しい event が追加されたら随時送信
- job が completed / failed / cancelled になったら done event を送って接続終了してよい

GET /scraping-jobs
- 最近の scraping jobs 一覧を返す
- 将来的な scheduler 管理画面に使えるようにする

注意:
- 既存の POST /collectors/run は残してください。
- ただし Scraping Modal の一括実行は新しい POST /scraping-jobs を使うようにしてください。
- 個別実行も可能なら POST /scraping-jobs に source_ids: [id] を渡す方式に寄せてください。

==================================================
5. Backend: SSE 実装方針
==================================================

FastAPI の StreamingResponse を使って SSE endpoint を実装してください。

SSE形式:
event: progress
data: {"event_type":"source_start","level":"info","message":"Scraping started: xxx","created_at":"..."}

event: done
data: {"status":"completed","message":"Scraping job completed"}

要件:
1. 最初に既存 event をすべて送信する
2. その後、新しい event を定期的に確認して送信する
3. polling interval は 0.5〜1秒程度でよい
4. job が completed / failed / cancelled になったら done を送信して終了
5. heartbeat comment を送ってもよい
   例: ": heartbeat\n\n"

実装例の方向:
- generator 関数を作る
- last_event_id を管理する
- DBから id > last_event_id の event を取得する
- yield で SSE文字列を返す

==================================================
6. Backend: Scraping Job 実行ロジック
==================================================

新しい service を作成してください。

例:
backend/app/scraping_jobs.py

責務:
- create_scraping_job
- run_scraping_job
- append_job_event
- update_job_progress
- finish_job
- fail_job

run_scraping_job の流れ:
1. job status を running に変更
2. start event を追加
3. source_ids を順番に処理
4. 各 source 開始時に source_start event を追加
5. robots.txt 確認前に fetch準備 event を追加
6. skip理由がある場合は skip/warn event を追加
7. HTML/RSS/JSON取得開始時に fetch event を追加
8. parse開始時に parse event を追加
9. keyword検出時に keyword event を追加
10. product candidate 作成時に candidate event を追加
11. source完了時に source_done event を追加
12. 全source完了時に done event を追加
13. job status を completed に変更

source単位で error が出ても、可能なら job 全体は止めずに次の source に進んでください。
ただし致命的エラーの場合は job を failed にしてください。

==================================================
7. 既存 collector との統合
==================================================

既存の collectors.py のロジックを大きく壊さずに統合してください。

理想:
- 既存の run_collector 相当処理に progress callback を渡せるようにする

例:
async def run_collector(..., progress_callback: Callable | None = None):
    progress_callback("fetch", "HTML取得開始", ...)
    ...
    progress_callback("candidate", "商品候補を作成しました", ...)

もし大規模変更になる場合:
- 最初は scraping_jobs.py 側で source単位の開始/完了/skip/error だけ event 化してください
- その後、fetch/parse/candidate の詳細 event を追加してください

段階的実装で構いません。

==================================================
8. Frontend: API 追加
==================================================

frontend/src/api.ts に以下を追加してください。

createScrapingJob(request):
- POST /scraping-jobs
- job_id を返す

getScrapingJob(jobId):
- GET /scraping-jobs/{job_id}

getScrapingJobs():
- GET /scraping-jobs

SSE 接続は api.ts でも App.tsx 内でも構いません。
EventSource を使ってください。

例:
const eventSource = new EventSource(`${API_BASE_URL}/scraping-jobs/${jobId}/events`);

eventSource.addEventListener("progress", ...)
eventSource.addEventListener("done", ...)
eventSource.onerror = ...

==================================================
9. Frontend: Scraping Modal UI
==================================================

Scraping Modal を左右2カラムにしてください。

左側:
- 既存のカテゴリ選択
- ステータス選択
- source URL一覧
- checkbox
- 個別Scraping
- 一括Scraping

右側:
- terminal風 SSE log panel

Terminalに表示する内容:
- job作成
- source開始
- fetch
- parse
- keyword検出
- candidate作成
- skip
- error
- done

表示例:
[12:00:01] [INFO] Scraping job created: job_xxx
[12:00:02] [START] Batch scraping started: 20 sources
[12:00:03] [START] 1/20 ポケモンカード公式ニュース
[12:00:04] [FETCH] HTML取得開始
[12:00:06] [PARSE] 本文解析中
[12:00:07] [KEYWORD] 予約開始, 再販 を検出
[12:00:08] [CANDIDATE] 商品候補 2件作成
[12:00:09] [DONE] 1/20 completed
[12:01:30] [DONE] Scraping job completed

UI機能:
- terminal auto scroll
- ログをクリア
- 最新ログへ移動
- 現在の job status 表示
- completed_sources / total_sources 表示
- created_candidates_count 表示
- failed_sources / skipped_sources 表示

==================================================
10. Frontend: Scraping 実行変更
==================================================

現在の一括 scraping は frontend が複数 source に対して順番に runCollector を呼んでいる可能性があります。
これを変更してください。

変更後:
1. 選択 source_ids を集める
2. POST /scraping-jobs を1回呼ぶ
3. job_id を受け取る
4. EventSource で /scraping-jobs/{job_id}/events に接続
5. terminal に events を表示
6. done 受信後に product_candidates / source_logs を再取得

個別 scraping も source_ids: [source_id] で POST /scraping-jobs を使ってください。

==================================================
11. 再実行ボタン方針
==================================================

成功後の「再実行」ボタンは不要です。

状態別:
- 実行前: このURLをScraping
- 実行中: 取得中...
- 成功後: 取得完了
- minimum interval 中: 次回取得まで mm:ss
- 失敗後: 再試行

minimum interval は維持してください。
失敗後の再試行は可能にしてください。
強制再取得は通常UIには表示しないでください。

==================================================
12. 将来のスケジューラーを意識した設計
==================================================

今すぐスケジューラーは実装しなくてよいです。
ただし将来以下に対応しやすい設計にしてください。

将来追加予定:
- 毎日 09:00 に scraping
- 1時間ごとの scraping
- カテゴリ別 scheduled scraping
- failed source のみ再実行
- job history 画面
- job status dashboard

そのため:
- ScrapingJob を DB に保存する
- ScrapingJobEvent を DB に保存する
- job 一覧 API を作る
- source_ids / selected_statuses / target_category を job に保存する

==================================================
13. エラーハンドリング
==================================================

以下を event として terminal に流してください。

- robots disallowed
- minimum interval
- timeout
- HTTP 403 / 404 / 500
- parse failed
- duplicate URL
- no candidate created
- candidate created
- unknown error

minimum interval / duplicate / no candidate は error ではなく warn または info としてください。

==================================================
14. 完了条件
==================================================

実装完了後、以下ができることを確認してください。

1. Scraping Modal で複数 source を選択できる
2. 一括Scrapingを押すと POST /scraping-jobs が呼ばれる
3. job_id が返る
4. Frontend が SSE に接続する
5. Backend の進行 event が terminal に表示される
6. sourceごとの start / done / skip / error が見える
7. job完了後に product_candidates が再取得される
8. source_logs も再取得される
9. 既存の product registration flow が壊れていない
10. 既存の source CRUD が壊れていない
11. 既存の keyword CRUD が壊れていない
12. 自動購入やCAPTCHA回避は実装されていない

==================================================
15. 実装後に出してほしい内容
==================================================

実装後、以下をまとめてください。

- 変更したファイル一覧
- 追加した DB model
- 追加した API endpoint
- SSE の使い方
- Frontend の動作確認手順
- curl で job 作成する例
- ブラウザで SSE を確認する方法
- 今後 scheduler を入れる場合の拡張ポイント