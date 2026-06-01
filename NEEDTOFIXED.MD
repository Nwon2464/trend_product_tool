목적
실제 사용 가능한 상품 리서치 앱으로 개선하기 위한 수정 혹은 개선 목록입니다.
Codex는 이 문서를 먼저 읽고, 한 번에 모든 항목을 수정하지 말고 우선순위 순서대로 작업してください。


## Priority 1
Scraping Modal 오른쪽 terminal 텍스트 UI가 깨지고 있습니다.

문제:
- 글자가 너무 큼
- time / level / message가 겹침
- 긴 URL이 줄바꿈되지 않음
- 로그 줄 간격이 좁음

수정:
1. terminal font-size를 11px 정도로 줄여주세요.
2. terminal line을 grid로 정리해주세요.

예:
.terminal-line {
  display: grid;
  grid-template-columns: 64px 72px minmax(0, 1fr);
  gap: 8px;
  align-items: start;
  font-size: 11px;
  line-height: 1.6;
  padding: 2px 0;
}

.terminal-time {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.terminal-level {
  min-width: 56px;
  font-size: 10px;
  white-space: nowrap;
}

.terminal-message {
  min-width: 0;
  word-break: break-all;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

3. terminal-body는 overflow-y: auto; overflow-x: hidden; 으로 해주세요.
4. 오른쪽 terminal 영역을 조금 더 넓혀주세요.
5. 기존 SSE 수신, auto scroll, 로그 클리어 기능은 깨지지 않게 해주세요.

---

## Priority 2

スクレイピング準備モーダルの「情報源名」入力欄が現在フィルターとして機能していません。

修正してください。

目的:
情報源名に文字を入力すると、対象URL一覧を source_name 기준으로絞り込めるようにしたいです。

修正内容:
1. scrapingUrls の useMemo 内で scrapingPrep.sourceName を使って filtering してください。
2. source.source_name に scrapingPrep.sourceName が含まれるものだけ表示してください。
3. 大文字小文字は区別しないでください。
4. 前後の空白は trim してください。
5. 入力が空の場合はすべて表示してください。

例:
const sourceNameQuery = scrapingPrep.sourceName.trim().toLowerCase();

.filter((source) => {
  const matchesCategory =
    scrapingPrep.category === "すべて" ||
    source.target_category === scrapingPrep.category;

  const matchesSourceName =
    sourceNameQuery === "" ||
    source.source_name.toLowerCase().includes(sourceNameQuery);

  return matchesCategory && matchesSourceName;
})

6. placeholder を分かりやすくしてください。
例:
「例: 公式, 入荷Now, サンリオ」

---

## Priority 3
商品登録フォームを常時表示するのではなく、商品一覧画面の「商品登録」ボタンからモーダルで開く方式に変更してください。

目的:
商品一覧画面を見やすくし、商品登録は必要なときだけモーダルで行えるようにしたいです。

修正内容:
1. 商品登録フォームを通常画面から削除します。
2. 商品一覧 / 商品を見る セクションの上部に「＋ 商品登録」ボタンを追加する。
3. ボタンをクリックすると ProductFormModal を開く。
4. モーダル内に既存の商品登録フォームを表示する。
5. 登録成功後はモーダルを閉じ、商品一覧を再取得する。
6. キャンセル時はモーダルを閉じる。
7. 既存の編集機能がある場合は、編集時も同じモーダルを使えるようにする。
8. 商品候補の「商品登録へ」ボタンを押した場合も、同じ商品登録モーダルを開き、候補情報を初期値として入れる。
9. 既存の Product CRUD API は変更しない。
10. Source登録やScraping機能とは混同しないように、ラベルは「商品情報を登録」にしてください。


---

## Priority 4

情報源管理画面の「新規情報源」フォームを、通常画面に常時表示する構成からモーダル表示に変更してください。

目的:
情報源管理画面を見やすくし、情報源URLの登録は必要なときだけモーダルで行えるようにしたいです。

修正内容:
1. 情報源管理画面に常時表示されている新規情報源フォームを、通常画面のレイアウトから取り除いてください。
2. 情報源管理画面の上部に「＋ 情報源URLを登録」ボタンを追加してください。
3. ボタンをクリックすると SourceFormModal を開いてください。
4. モーダル内に既存の情報源登録フォームを表示してください。
5. 入力項目は既存のものを維持してください。
   - 情報源名
   - URL
   - 対象カテゴリ
   - source_type
   - priority
   - is_active
6. 登録成功後はモーダルを閉じ、情報源一覧を再取得してください。
7. キャンセル時はモーダルを閉じてください。
8. 既存の情報源編集機能がある場合は、編集時も同じモーダルを使えるようにしてください。
9. Product登録フォームとは混同しないように、ラベルは「情報源URLを登録」にしてください。
10. 既存の Source CRUD API は変更しないでください。
11. Scraping Modal で使っている sources 一覧取得処理を壊さないでください。

注意:
- CSSで display:none にするだけではなく、通常画面からフォームを取り除いてください。
- フォーム機能自体は削除しないでください。
- 既存の登録・編集・削除処理は維持してください。

---

## Priority ５
現在のキーワード管理機能を、実際のスクレイピング判定に使える形へ改善してください。

目的:
現在の Keyword API は CRUD としては存在していますが、商品候補判定は candidate_detector.py 内の固定ルール中心です。
今後はキーワード管理画面で登録したキーワードを、スクレイピング時の商品候補判定・希少性判定・スコアリングに反映したいです。

また、キーワード管理画面の「新規キーワード登録」は常時表示ではなく、ボタンを押したときにモーダルで開く方式にしてください。
登録完了後は UI 上に「登録完了」メッセージを表示してください。

==================================================
1. Backend: DBキーワードを candidate_detector に反映
==================================================

修正内容:

1. スクレイピング時、DBの keywords テーブルから is_active = true のキーワードのみ取得してください。

2. is_active = false のキーワードは、スクレイピング判定・商品候補判定・スコアリング・detected_keywords・detected_reason のすべてから完全に除外してください。

重要:
無効化されたキーワードは DB には残しますが、スクレイピング判定には一切使わないでください。

3. 取得した active keywords を candidate_detector の判定に使ってください。

4. keyword.category は商品カテゴリ判定に使ってください。

例:
category = "ポケモンカード"
keyword = "ポケカ 再販"
is_active = true

この場合、raw_text に "ポケカ 再販" が含まれていたら、
そのページは ポケモンカード 関連の候補として扱いやすくしてください。

逆に:

category = "ポケモンカード"
keyword = "ポケカ 再販"
is_active = false

この場合、raw_text に "ポケカ 再販" が含まれていても、
DBキーワード由来の検出としては扱わないでください。

5. priority をスコアに反映してください。

例:
priority = 1 → +15
priority = 2 → +10
priority = 3 → +5

ただし priority 反映も is_active = true のキーワードだけにしてください。

6. DBキーワードは既存の固定ルールを完全に置き換えるのではなく、追加ルールとして扱ってください。

つまり:
- candidate_detector.py の既存ルールは維持
- DB keywords も追加で判定
- 両方の結果を combined score に反映

7. detected_keywords に DB由来の keyword も含めてください。

ただし、is_active = false の keyword は detected_keywords に含めないでください。

8. detected_reason に以下のような理由を追加してください。

例:
- 登録キーワード「ポケカ 再販」を検出
- 優先度1のキーワードを検出
- カテゴリ「ポケモンカード」の登録キーワードに一致

ただし、is_active = false の keyword については detected_reason にも表示しないでください。

==================================================
2. Backend: 実装方針
==================================================

大きく壊さず、段階的に実装してください。

案:
1. crud.py に active keywords 取得関数を追加してください。
   例:
   list_active_keywords(db)

2. list_active_keywords(db) は is_active = true のキーワードのみ返してください。

3. collectors.py または scraping_jobs.py から candidate_detector を呼ぶ前に active keywords を取得してください。

4. candidate_detector の関数に db_keywords を渡せるようにしてください。

例:
detect_product_candidate(
    text=raw_text,
    category=source.target_category,
    source_type=source.source_type,
    db_keywords=active_keywords,
)

5. db_keywords は optional にしてください。
既存処理が壊れないようにしてください。

6. /keywords の有効化・無効化ボタンで変更された is_active の値が、次回 scraping 判定に反映されるようにしてください。

確認例:
- キーワードAを有効化
- scraping実行
- detected_keywords / detected_reason に反映される

- キーワードAを無効化
- scraping実行
- detected_keywords / detected_reason に出ない
- scoreにも加算されない

==================================================
3. Frontend: キーワード登録をモーダル化
==================================================

現在のキーワード登録フォームが通常画面に常時表示されている場合、
通常画面から取り除いてください。

注意:
- CSSで display:none にするだけではなく、通常画面のレイアウトからフォームを取り除いてください。
- キーワード登録機能自体は削除しないでください。
- モーダル内で登録フォームを表示してください。

修正内容:
1. キーワード管理画面の上部に「＋ キーワードを追加」ボタンを追加してください。

2. ボタンを押すと KeywordFormModal を開いてください。

3. モーダル内に既存のキーワード登録フォームを表示してください。

入力項目:
- category
- keyword
- priority
- is_active
- memo

4. 登録完了後はモーダルを閉じてください。

5. 登録完了後、キーワード一覧を再取得してください。

6. 登録完了後、UIに完了メッセージを表示してください。

表示例:
「キーワードを登録しました」

7. 完了メッセージは数秒後に自動で消えてよいです。

8. キャンセルボタンを押した場合はモーダルを閉じてください。

9. 既存の編集機能がある場合は、編集時も同じ KeywordFormModal を使えるようにしてください。

==================================================
4. Frontend: 有効化 / 無効化 の説明改善
==================================================

キーワード一覧の「有効化 / 無効化」が何を意味するか分かりやすくしてください。

説明文を追加してください。

例:
「有効なキーワードだけがスクレイピング時の商品候補判定に使われます。
無効化したキーワードは削除されませんが、判定・スコアリングには使用されません。」

可能であればボタン文言を以下のように変更してください。

現在:
- 有効化
- 無効化

候補:
- 検出に使う
- 検出から外す

ただし既存UIの雰囲気に合わせてください。

==================================================
5. Frontend: ラベル改善
==================================================

ユーザーが「キーワード」の意味を理解しやすいように、ラベルを少し分かりやすくしてください。

変更候補:
- 「キーワード」
  → 「検出キーワード管理」

説明文を追加してください。

例:
「スクレイピング結果から商品候補を判定するためのキーワードを管理します。
登録したキーワードは商品カテゴリ、希少性、予約・再販などの検出に使われます。」

==================================================
6. 既存機能を壊さない
==================================================

以下は維持してください。

- Keyword CRUD API
- Keyword 有効化 / 無効化 API
- Product CRUD
- Source CRUD
- Scraping Job
- SSE terminal
- ProductCandidate 生成
- Evidence Modal
- Scraping Modal
- 既存の candidate_detector 固定ルール

==================================================
7. 安全方針
==================================================

以下は実装しないでください。

- 自動購入
- CAPTCHA回避
- ログイン突破
- 購入制限回避
- 過度な高頻度 scraping

==================================================
8. 動作確認
==================================================

実装後、以下を確認してください。

1. 「＋ キーワードを追加」ボタンでモーダルが開く
2. キーワードを登録できる
3. 登録後に「キーワードを登録しました」と表示される
4. キーワード一覧が更新される
5. is_active=true のキーワードだけがスクレイピング判定に使われる
6. is_active=false のキーワードはスクレイピング判定に一切使われない
7. is_active=false のキーワードは score に加算されない
8. is_active=false のキーワードは detected_keywords に表示されない
9. is_active=false のキーワードは detected_reason に表示されない
10. priority が candidate score に反映される
11. detected_keywords に有効な登録キーワードが含まれる
12. detected_reason に有効な登録キーワード検出理由が表示される
13. 既存の固定ルールによる候補判定も壊れていない
14. キーワードを無効化した後、次回 scraping でそのキーワードが判定に使われない
15. キーワードを再度有効化した後、次回 scraping でそのキーワードが判定に使われる

---

## Priority 6

商品一覧の「通知ログ作成」処理を改善してください。

現在の問題:
商品一覧で「通知ログ作成」ボタンを繰り返し押すと、
同じ商品・同じ内容の通知ログが何度も作成されてしまいます。

目的:
完全に同じ通知ログがすでに存在する場合は、新しく作成せず、
UI上に「同じ通知ログがすでに存在します」と表示したいです。

修正内容:

1. 通知ログ作成時に重複チェックを追加してください。

重複判定の基準:
以下がすべて同じ場合は同一通知ログとみなしてください。

- product_id
- title
- message
- notification_type

もし現在 notification_type がない場合は、
既存の NotificationLog model にある項目に合わせて、
product_id / title / message など、完全一致できる項目で判定してください。

2. Backend 側で重複チェックしてください。

Frontend だけで判定すると漏れが出るため、
POST /notification-logs または通知ログ作成API側で、
作成前に同じログが存在するか確認してください。

同じログが存在する場合:
- 新規作成しない
- 既存ログを返してもよい
- response に duplicated: true を含めてください

例:
{
  "duplicated": true,
  "message": "同じ通知ログがすでに存在します",
  "notification_log": {...}
}

新規作成した場合:
{
  "duplicated": false,
  "message": "通知ログを作成しました",
  "notification_log": {...}
}

3. Frontend 側で duplicated を見て UI 表示を変えてください。

duplicated === true の場合:
「同じ通知ログがすでに存在します」と表示してください。

duplicated === false の場合:
「通知ログを作成しました」と表示してください。

4. 表示メッセージは toast / inline alert / status message のどれでも構いません。
数秒後に自動で消えるようにしてください。

5. 通知ログ一覧は作成処理後に再取得してください。
ただし duplicated === true の場合は、新しいログは増えていないことが分かるようにしてください。

6. 可能であれば DB レベルでも重複を防いでください。

例:
product_id + title + message + notification_type に unique constraint を検討してください。

ただし既存データとの互換性が壊れる場合は、
まずはAPI側の存在チェックだけで構いません。

7. 既存機能を壊さないでください。

維持するもの:
- 商品一覧
- 通知ログ一覧
- 通知ログ作成ボタン
- Product CRUD
- NotificationLog CRUD
- Scraping / SSE / ProductCandidate 機能

8. 動作確認してください。

確認内容:
- 同じ商品で1回目に「通知ログ作成」を押す
  → 通知ログが作成される
  → 「通知ログを作成しました」と表示される

- 同じ商品で2回目に「通知ログ作成」を押す
  → 新しい通知ログは作成されない
  → 「同じ通知ログがすでに存在します」と表示される

- 別の商品では通知ログを作成できる

- 内容が異なる通知ログは作成できる


---


## Priority 7

アプリ全体で使える Toast Notification UI を追加してください。

目的:
「通知ログを作成しました」「同じ通知ログがすでに存在します」「Scraping Job が完了しました」などの完了・警告・エラー通知を、画面下部に一時的に表示したいです。

仕様:
1. 画面下部に toast notification を表示してください。
2. 複数の通知が連続で発生した場合、最新通知が一番上に来るように積み上げてください。
3. 各通知は数秒後に自動で消えるようにしてください。
4. 通知タイプを用意してください。
   - success
   - info
   - warning
   - error

表示例:
- success: 通知ログを作成しました
- warning: 同じ通知ログがすでに存在します
- success: Scraping Job が完了しました
- error: Scraping Job に失敗しました

実装方針:
1. frontend 側に toast 用 state を追加してください。

例:
type ToastType = "success" | "info" | "warning" | "error";

type ToastMessage = {
  id: string;
  type: ToastType;
  message: string;
  createdAt: number;
};

2. addToast(type, message) 関数を作成してください。
3. addToast 実行時、最新 toast が上に来るように state の先頭に追加してください。
4. setTimeout で 3〜5秒後に自動削除してください。
5. ToastContainer component を作成してください。
6. ToastContainer は画面下部に fixed 表示してください。

CSSイメージ:
.toast-container {
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 9999;
  width: min(520px, calc(100vw - 32px));
  pointer-events: none;
}

.toast {
  border-radius: 10px;
  padding: 12px 14px;
  font-size: 13px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.18);
  background: white;
  border: 1px solid #e5e7eb;
  pointer-events: auto;
}

7. 通知ログ作成時に addToast を使ってください。
   - 新規作成: success「通知ログを作成しました」
   - 重複: warning「同じ通知ログがすでに存在します」

8. Scraping Job 完了時にも addToast を使ってください。
   - completed: success「Scraping Job が完了しました」
   - failed: error「Scraping Job に失敗しました」
   - skipped が多い場合: warning「一部の情報源がスキップされました」

9. 既存の inline message がある場合、不要なら toast に置き換えてください。
10. 既存の SSE terminal、Scraping Modal、通知ログ一覧、ProductCandidate 表示は壊さないでください。