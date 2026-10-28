# Notion → Neon Postgres 遷移計畫

狀態：**Phase 0 已完成（2026-10-29），Phase 1 尚未開工**。這份計畫橫跨三個 repo（github-radar-ui、ai-assistant、radar-rag）和一個本機 skill（loot-radar-triage）。

## 1. 為什麼搬，搬完算成功

要解決的三個痛點：

- **Notion SQL 配額**：整個 workspace 共用一個 Query Data Source 配額，實測大約 8 次就用完。trending 的 🆕/🔁 判斷、loot 的去重讀取、triage 都在搶這份配額，搶輸的那個 routine 只能跳過寫入（`⚠️ archive skipped`）。
- **3 req/s 限速**：`lib/notion.ts` 為了它寫了 429 重試和 `Retry-After` 上限，Notion 一慢，頁面渲染就被拖住。
- **`assertProps` 很脆**：schema 由寫入端擁有，讀取端只能事後檢查。新增一個欄位要照「routine 先、UI 後」的順序部署，順序一反，整個 trending 頁就空白。

完成的定義（每一條都要有實際打過的結果，不是測試通過）：

1. 網站所有頁面都從 Neon 讀資料，prod 上的 `NOTION_TOKEN` 已經移除，頁面照常 200。
2. 六個 radar 寫入 routine（trending、blog、4 個 loot target）各自完整跑過一輪，而且全部寫進 Neon；跑的過程中沒有呼叫任何 Notion 工具。
3. 遷移前任選 5 個 trending 的 Notion page id 和 5 個 blog 的 page id，`curl -i /trending/<id>` 和 `/blog/<id>` 都是 200。
4. `/api/latest-week` 在切換前後回傳的 JSON 逐字相同，以同一週為準。
5. radar-rag 改從 Neon sync 之後，CI 的 golden eval 數字（hit@5 / P@5）和切換前一樣。
6. loot 的 Status 在 UI 上切換一次，下一次讀取馬上反映，不用等 cache 過期。

## 2. 範圍

**要搬**：Trending Archive、Blog Archive、四張 Loot Ledger。它們的寫入端、讀取端和守門員全部一起搬：

| 角色 | 是誰 | 現在怎麼碰 Notion |
|---|---|---|
| 寫入 | `github-trending` routine | SQL 讀 `Repo`+`Week` 做 🆕/🔁 判斷 → create／update page |
| 寫入 | `loot-radar` × 4 routine | SQL 讀去重鍵；用 saved view 讀 Trending（heat sweep）→ create／update |
| 寫入 | `blog-radar` routine | 只 create（去重靠 Slack 歷史，不靠 Notion） |
| 寫入 | `loot-radar-triage`（本機 skill） | 用 view 讀 → 寫 `Status`+`Verdict`，並為 heat 候選 create 新列 |
| 寫入 | UI 的 loot Status Server Action | PATCH 一個 select |
| 讀取 | github-radar-ui | `queryAll` 讀全表 + `unstable_cache` 600 s |
| 讀取 | radar-rag `/sync` | `NotionClient` 讀 trending + blog，每週一次全量刷新 |
| 守門 | `contract-guard` routine | 拿 Notion schema 對照 UI 原始碼 + 檢查各寫入端有沒有在跑 |

**不搬**：
- `Daily Archive` 和 `Topics`（archive-memory 用的）：UI 不讀它們，沒有痛點
- Slack digest
- `/api/latest-week` 的回應格式
- `unstable_cache` → `use cache` 的遷移：Next 16 已經標成被取代，但它是另一件事，混進這次只會讓回滾更難

## 3. 核心決定

| # | 決定 | 打敗了誰，為什麼 |
|---|---|---|
| D1 | 開一個**獨立的 Neon project** `radar-archive` | 輸家是和 radar-rag 共用 project。Free plan 的 100 CU-hours 是**每個 project** 各算，共用等於兩邊搶同一份；而且對外公開的 `/ask` 服務不該跟寫入憑證放在同一個 project。Free plan 有 100 個 project 的額度，這點不心疼。 |
| D2 | **所有寫入都走 UI 新開的 ingest API**，用 bearer token 並按表限定範圍 | 輸家一：Neon 官方 MCP。它有 `run_sql`，權限是整個帳號；blog-radar 每天讀不可信的部落格內容，被 prompt injection 一次就可能 `DROP TABLE`。輸家二：在 routine 裡直接跑 `psql`。LLM 寫 SQL 時要處理中文和引號跳脫，壞掉時往往是靜默的；寫入也不會觸發 cache 失效；DB 密碼還得放進 sandbox。 |
| D3 | 四張 loot 表合併成**一張 `loot` 表**，加一個 `target` 欄 | 輸家是維持四張表：每次改 schema 都要改四份 migration。當初拆四張只是因為 Notion 裡每個 target 各自是一份 archive。 |
| D4 | **主鍵沿用 Notion page id**，新列用 `gen_random_uuid()` | 沒有替代方案。radar-rag 的引用連結和 document id 都是 page id，`/trending/[id]` 必須能解析任何一週的 id（見 AGENTS.md 的 route contract）。 |
| D5 | driver 用 `@neondatabase/serverless`（HTTP 模式）；migration 用純 SQL 檔加一支小 runner | 輸家是 Drizzle／Prisma：為三張表引進一整個 ORM 和 codegen。HTTP driver 一個 request 一個 query，不用連線池，適合 Vercel function。 |
| D6 | `revalidate` 從 600 s 拉長到 3600 s，**每一次 ingest 寫入都呼叫 `updateTag`** | 輸家是維持 600 s。寫入現在經過 UI，所以新資料會即時可見，靠的是寫入時主動失效，不是靠 TTL。TTL 只用來兜住「有人直接在 Neon console 改資料」的情況，上限 1 小時。算 CU：最壞情況每表每小時喚醒一次 × 5 分鐘 × 0.25 CU，約 15 CU-h／月，遠低於 100。 |
| D7 | **function 和 DB 都放 Singapore**：Neon AWS ap-southeast-1，Vercel function region `sin1` | 輸家是 function 留在預設的 `iad1`、DB 開 us-east-1。function 留在美國只是為了遷就 Notion，搬完之後它只跟 DB 講話，而讀者大多在台灣。另一個輸家是只把 DB 搬到亞洲：function 每次 query 都要跨一次太平洋，是最糟的組合。Hobby plan 可以自選單一 region。 |

## 4. Schema 草稿

```sql
CREATE TABLE trending (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repo           text NOT NULL,
  week           date NOT NULL,
  stars_per_week integer,
  total_stars    integer,
  language       text NOT NULL DEFAULT '',
  category       text CHECK (category IN ('agents','models','infra','tooling','apps','other')),
  link           text,
  description    text NOT NULL DEFAULT '',
  comment        text NOT NULL DEFAULT '',
  weeks_on_chart integer,
  maintained     text CHECK (maintained IN ('active','stale','archived')),
  risk           text CHECK (risk IN ('none','watch','high')),
  license        text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX trending_repo_week ON trending (lower(repo), week);

CREATE TABLE loot (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target         text NOT NULL CHECK (target IN ('claude','copilot','opencode','codex')),
  repo           text NOT NULL,
  intro          text NOT NULL DEFAULT '',
  asset          text NOT NULL DEFAULT '',
  -- 各 target 的值域不同（opencode 用 agent/command/plugin，codex 多了 plugin），這裡放聯集
  type           text CHECK (type IN ('skill','hook','slash-command','mcp','prompt','convention','pattern','agent','command','plugin')),
  week           date NOT NULL,
  link           text,
  why            text NOT NULL DEFAULT '',
  how            text NOT NULL DEFAULT '',
  status         text NOT NULL DEFAULT 'new' CHECK (status IN ('new','deferred','adopted','skipped')),
  recommendation smallint CHECK (recommendation BETWEEN 1 AND 5),
  verdict        text NOT NULL DEFAULT '',
  maintained     text CHECK (maintained IN ('active','stale','archived')),
  license        text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
-- 同一 target、同一 repo、同一週只能有一列；follow-up 列的週不同，所以不受影響
CREATE UNIQUE INDEX loot_target_repo_week ON loot (target, lower(repo), week);

CREATE TABLE blog (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text NOT NULL,
  url        text NOT NULL,
  source     text NOT NULL DEFAULT '',
  type       text CHECK (type IN ('official','individual')),
  author     text NOT NULL DEFAULT '',
  published  date,
  archived   date NOT NULL DEFAULT current_date,
  brief      text NOT NULL DEFAULT '',
  summary    text NOT NULL DEFAULT '',
  comment    text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX blog_url ON blog (url);
```

- **CHECK 的值域已經用 Phase 0 dry-run 的實際資料核對過**（2026-10-29）：Category、Maintained、Risk、Status、blog Type 都落在草稿的值域內；loot `Type` 原本的草稿錯了，已改成聯集。
- **`license` 刻意不加 CHECK**：Notion 裡 `AGPL-3.0` 和 `AGPL-3.0-only` 兩種寫法並存，而且 SPDX 清單本來就是開放的。
- **unique index 直接放在 init migration**：dry-run 查到三種去重鍵都是 0 重複、0 空值。backfill 如果真的撞到重複，會直接報錯失敗，不會悄悄寫進去。
- **`normalizeCJKPunct` 留在讀取端**：手術式改動，不在這次順手搬家。

## 5. Ingest API 契約

所有路徑都放在 `/api/ingest/` 底下。認證用 `Authorization: Bearer <token>`，比對沿用 `lib/auth.ts` 的 `safeEqual`。

| 方法 | 路徑 | token 範圍 | 行為 |
|---|---|---|---|
| `POST` | `/api/ingest/trending` | trending | 用 `(lower(repo), week)` upsert；回傳每列結果；寫完 `updateTag("db:trending")` |
| `GET` | `/api/ingest/trending/keys` | trending, loot, triage | 全部 `repo`+`week`，供 🆕/🔁 判斷和 `Weeks on chart` 計算 |
| `GET` | `/api/ingest/trending/recent?weeks=2` | loot, triage | 最近 N 週的列，取代 heat sweep 讀 saved view |
| `POST` | `/api/ingest/loot/{target}` | loot, triage | upsert（規則見下）；寫完 `updateTag` 該 target 的 tag |
| `GET` | `/api/ingest/loot/{target}/keys` | loot, triage | `repo`+`week`+`status`，供去重 |
| `PATCH` | `/api/ingest/loot/{target}/{id}` | triage | 只能改 `status`+`verdict` |
| `POST` | `/api/ingest/blog` | blog | `ON CONFLICT (url) DO NOTHING`（blog 本來就不更新）；回傳哪些是新的 |
| `GET` | `/api/ingest/health` | guard | 每張表（loot 按 target 分開）最新的 `created_at` 和 `week`，供活性檢查 |

**原本寫在 prompt 裡的規則，改由伺服器強制執行**（這是 Notion 版本做不到的）：
- loot upsert：`ON CONFLICT … DO UPDATE … WHERE loot.status = 'new'`。人已經裁決過的列不會被同週重跑覆蓋，被跳過的列在回應裡列成 `dedup escape`。
- `status` 和 `recommendation` 只在 create 時寫入。`loot` token 不能把 `status` 設成 `new` 以外的值，只有 `triage` token 可以。
- 先前週已有的 repo，只有 `asset` 以 `follow-up:` 開頭才能新增一列，否則拒絕。
- **邊界驗證**：body 大小上限、每次最多 N 列、每個文字欄位有長度上限、日期格式、值域。值域靠 DB 的 CHECK 兜底，API 驗證負責回傳看得懂的 400。loot `type` 在 DB 裡是聯集，每個 target 各自合法的值由 API 依 target 驗證。
- token 的範圍限制要真的生效，前提見 §8 第 1 條（目前所有 routine 共用同一個 environment）。

**proxy.ts**：`/api/ingest/*` 不能被登入閘門重導向，因為 routine 沒有 cookie。

## 6. 分階段執行

### Phase 0 — 先驗證假設（不合併任何程式碼）

1. ✅ **routine 的 network secret 會不會被附上**（2026-10-29 通過）
   - **環境**：§8 第 1 條的三個 environment 已建好，都只設 Network access = Full；原本共用的那個也只有這一項，沒有 setup script 和 env var
   - **做法**：在 `radar-blog` 放一把假的 network secret（host `httpbin.org`），讓綁 `radar-blog` 的測試 routine 跑 `curl -s https://httpbin.org/headers` 和 `env | grep -c <假值>`
   - **結果**：httpbin 回傳的 header 裡有 `Authorization: Bearer <假值>`，`grep -c` 回 `0`。代表 routine session 也會被附上 network secret，而且值不在 VM 裡。測試 routine 和假 secret 都已刪除
   - **附帶發現**：routines 的 UI 改不了 trigger 綁的 environment，要用 RemoteTrigger API 改 `job_config.ccr.environment_id`
2. ✅ **Vercel function region**（2026-10-29）：prod deployment 目前跑在預設的 `iad1`（Washington, D.C.）。決定見 D7：Neon 開在 **AWS ap-southeast-1**，function 跟 UI PR #2 一起改成 `sin1`。radar-rag 在 asia-east1，讀 Singapore 也比讀美國近。
3. ✅ **Neon console 的 Tables 頁能不能直接改列**（2026-10-29，owner 在 `radar-archive` 的拋棄式表上實測）：可以直接改儲存格、刪列，能取代「在 Notion 裡手改 `Verdict`、刪列」。注意兩件事：
   - 從 console 改資料不經過 ingest API，不會觸發 `updateTag`，網站最多晚 3600 s 才看到（D6）
   - 會跳過 API 的驗證，只剩 DB 的 CHECK 兜底
4. ✅ **Backfill dry-run**（2026-10-29，直接打 Notion REST API 唯讀，沒用到 SQL 配額）：

   | 表 | 列數 | 重複鍵 | 空鍵 |
   |---|---|---|---|
   | trending | 253 | 0 | 0 |
   | loot claude / copilot / opencode / codex | 125 / 69 / 99 / 86 | 0 | 0 |
   | blog | 729 | 0 | 0 |

   - 數字欄位全部是整數，`Total stars` 最大值 322,515，`integer` 放得下
   - 日期欄位全部只有日期、沒有時間，用 `date` 沒問題
   - 文字欄位最長是 blog `Summary` 的 3,514 字
   - 總共約 1,400 列，離 Free plan 的 1 GB 差了好幾個數量級

### Phase 1 — UI PR #1：schema、ingest API、backfill（讀取端仍然是 Notion）

- `db/migrations/0001_init.sql` 加一支 migration runner（記錄在 `schema_migrations` 表）
- `lib/db.ts`（`server-only`）和 `/api/ingest/*` 路由，附單元測試；expected value 用手寫的 literal
- `scripts/backfill-from-notion.ts`：用 page id 當主鍵做 upsert，**冪等**，重跑也安全
- ✅ owner 建 Neon project `radar-archive`（AWS ap-southeast-1，D1／D7；建好之後 region 不能改）：2026-10-29 已建好
- 這個階段 function 還在 `iad1`，ingest API 寫 Singapore 會跨海；但這段期間只有 backfill 和 QA 在寫，慢一點無所謂
- 開 Neon `preview` branch，Vercel Preview scope 設 `DATABASE_URL` 指向它；`INGEST_TOKEN_*` 正式值只設 Production scope，Preview scope 另設一組測試值（§8 第 4 條）
- QA 跑在 Neon 的 `preview` branch 上（真實介面，不是測試）：
  - 沒帶 token → 401
  - token 範圍不對 → 403
  - 正常 upsert → 200
  - 已裁決的 loot 列重送 → 內容不變，回應列出 escape
  - blog 重送 → 不會重複新增

### Phase 2 — prod DB 和 backfill

- 對 prod 套用 migration，跑 backfill
- 列數和 Notion 逐表對齊（unique index 已經在 init migration 裡，重複列會讓 backfill 直接失敗）
- 這個階段 DB 還沒有人讀寫，是**雙向門**

### Phase 3 — 切換（選一個安靜的時段）

時段：**週二或週三 UTC 02:30 之後的 24 小時內**。理由：blog 每天 02:00 UTC 跑，trending、guard、radar-rag sync 都在週一，loot 在週五，這段時間沒有其他 routine 會寫入。

1. 重跑 backfill
2. 把 trending、blog、4 個 loot trigger 的 environment 改綁 `radar-trending`／`radar-blog`／`radar-loot`（每個 environment 的 network secret 已放好正式 token），接著合併 ai-assistant PR：三個寫入 skill 改打 ingest API，例如 trending 第 8 步改讀 `/keys`，第 11 步改 `POST`；routine prompt 只引用 skill，不重複寫規則
3. 合併 UI PR #2：讀取層換成 SQL，Status Server Action 改成 `UPDATE`，刪掉 `resolveDataSourceId`、`assertProps`、`lib/notion.ts`；同一個 PR 新增 `vercel.json` 的 `"regions": ["sin1"]`（D7）。不能提早改：function 先搬到 Singapore 卻還在讀美國的 Notion，會比現在更慢
4. 再跑一次 backfill，補上兩個 PR 合併之間寫進 Notion 的列（以 page id upsert，不會和 API 寫入的新 uuid 撞號）
5. 驗證完成定義的第 3、4、6 條，並手動 `Run now` 一次 blog-radar；用 Vercel 的 deployment 資訊確認 prod 的 `regions` 是 `["sin1"]`

### Phase 4 — 下游

- **loot-radar-triage**：改用 API（triage token 放在本機 env），view 讀取改成 `/keys` 和 `/recent`
- **radar-rag**：先發訊息給 radar-rag session，說明引用連結的契約不變，只換資料來源；再改 `NotionClient` → 唯讀 role 的 JDBC 第二個 datasource；最後跑 eval 驗證完成定義第 5 條
- **contract-guard**：刪掉 Notion schema 比對（schema 現在就在 UI repo 的 migration 裡，同一個 PR 內一致），保留寫入端活性檢查（改讀 `/api/ingest/health`）和 live-site oracle

### Phase 5 — 觀察和退役

- 兩個完整週期（每個 trigger 都至少寫過兩次）全部綠燈，才退役 Notion
- 撤掉 Notion integration 對這六張表的分享（integration 是**逐表分享**的）。這樣即使哪個 routine 還誤用 Notion 工具，也會直接失敗，而不是悄悄寫進一張沒人讀的表
- 移除 Vercel 的 `NOTION_TOKEN`，以及 radar-rag 的 `notion-token` secret
- Notion 表本身保留凍結，不丟進垃圾桶（owner 2026-10-29 決定）

## 7. 單向門和回滾

- **Phase 0–2**：雙向門。DB 沒人用，丟掉就好。
- **Phase 3 第 2 步之後就是單向門**：之後新寫入的列只存在 DB。回滾等於 revert 兩個 PR，而回滾前寫進 DB 的列會從網站上消失，只能手動搬回 Notion。沒有做 DB → Notion 的反向同步，這是刻意的（YAGNI）；代價是切換後幾天內要決定好，不要拖。
- **影響範圍**：網站所有頁面、六個寫入 routine、radar-rag 的 sync、profile README 的每日更新（它讀 `/api/latest-week`）。

## 8. 風險

1. **所有 radar routine 共用同一個 cloud environment**（`env_01PuHZ…`，2026-10-29 查到的）。env var 是 environment 層級的設定，所以每個 routine 都看得到所有 token，§5 的範圍限制形同虛設。**已決定（2026-10-29）：拆成三個 environment**：`radar-trending`（github-trending）、`radar-blog`（blog-radar）、`radar-loot`（4 個 loot），每個只放自己那把 token；contract-guard 留在原本的 environment，只放 guard token。代價是網路 Full 和 setup 要設三份。
   **token 放在 environment 的 Network secrets，不放 env var**：env var 在 session 裡任何指令都讀得到；network secret 則是 Anthropic 的 agent proxy 在請求離開 VM 之後，才替指定 host（`whyisthistrending.vercel.app`）的請求加上 `Authorization: Bearer …`。token 從頭到尾不進 sandbox，被 prompt injection 也偷不走；最多只能拿它去打那個 host，而那把 token 的權限只限自己那張表。routine 打 API 時不用帶 token。
2. **Neon Free 的 CU-hours 用完 → compute 停機到下個月**，網站和寫入一起掛掉。D6 估每月約 15 CU-h，但爬蟲流量沒算進去。要開 Neon 的用量通知，Phase 5 觀察期內每週看一次實際用量。
3. **冷啟動**：閒置 5 分鐘後 compute 會休眠（Free plan 關不掉），第一次讀取多大約 1 s。被 `unstable_cache` 吸收，但 cache 剛過期的那一次 render 會比較慢。
4. **Preview 不能寫到 prod 的 DB**：每個 PR 都有自己的 Preview deployment，裡面一樣有 ingest API 和 Status 寫入；指到 prod，QA 的測試資料就會混進正式資料，沒驗證過的 migration 也會直接打在 prod 上。**已決定（2026-10-29）：Preview 的 `DATABASE_URL` 指向 Neon `preview` branch**，只設在 Vercel 的 Preview scope；branch 資料變舊時從 parent reset。migration 一律先在這個 branch 上跑過，再套到 prod。
   **`INGEST_TOKEN_*` 只設在 Vercel 的 Production scope**，Preview scope 用另一組測試值。Preview 會跑還沒 merge 的程式碼（包括升級進來的第三方套件）；它要是拿得到正式 token，就能繞過 `preview` branch，直接打 prod 的 ingest API 寫正式資料。Preview 上的 QA 只打 `preview` branch，用測試值就夠了。
5. **Notion connector 還會留在 routine 裡**（archive-memory 需要它）。靠 Phase 5 撤銷分享來強制擋住，而不是靠 prompt。

## 9. 會變成過時、要一起更新的文件

- github-radar-ui `AGENTS.md`：「server talks to Notion only」、`assertProps` 的 gotcha、`.next` cache 的說明（TTL 改了）、ingest API 契約
- `docs/signals.md`：「Notion SELECT」的用詞
- ai-assistant `AGENTS.md`：wiring 表的 Notion target 欄、column contract 那一節
- radar-rag `AGENTS.md`：資料來源
- `README`（如果有提到 Notion）
- 相關的 memory 檔

## 10. 工作量估計

| 部分 | 估計 |
|---|---|
| Phase 0 | 半天 |
| UI（兩個 PR） | 2–3 天 |
| ai-assistant 寫入端 | 1 天 |
| triage + radar-rag + guard | 1 天 |
| 觀察期 | 2 週（日曆時間，不是工時） |

## 11. 待 owner 拍板

1. ~~token 範圍~~：**已決定，拆成三個 environment**（§8 第 1 條，2026-10-29）
2. ~~Preview 的 DB~~：**已決定，指向 Neon `preview` branch**（§8 第 4 條，2026-10-29）
3. ~~Notion 舊表的去向~~：**已決定，凍結保留**（2026-10-29）
