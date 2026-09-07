# Repo 訊號（Signals）

雷達上每個 repo 顯示的訊號。這些值由 `ai-assistant` routines 在歸檔時計算、寫進
Notion；本 app 是純讀者，只負責渲染。寫入端的規則住在 `ai-assistant` 的 skills
（`github-trending`、`loot-radar`）；讀取與渲染端是 `lib/data.ts` + `components/ui.tsx`。
唯一例外是 **Verdict** —— 那欄由 triage（`loot-radar-triage` skill）寫，不是 routine 寫。

兩種顯示哲學：

- **只標例外（flag-exceptions）**：Momentum、Maintained、Risk、Verdict 徽章 —— 健康／正常狀態
  *不顯示*，只有真的有事才跳徽章，所以乾淨的 repo 維持乾淨，有徽章就代表有意義。
- **全部顯示（always-show）**：License —— 每個 repo 都有授權、每個都不同、每個都重要，
  沒有「正常值」可藏；顏色本身就是訊號。

---

## Momentum（`竄升中`）

相對星速的加速度。不是儲存的欄位，而是本 app 算出來的（`repoMomentum`，`lib/data.ts`），
從每週的 `Stars/wk` 序列：

```
動能 = 最新一週的 stars/wk ÷ 前面所有週的平均
```

驅動 trending 列表的 **竄升中** 排序，以及每列的徽章。

| 值 | 意義 | 徽章 |
| --- | --- | --- |
| `null` | 資料不到兩週 —— 沒得比 | 排序沉底，無徽章 |
| `< 1` | 降溫（比自己過去慢） | — |
| `≈ 1` | 穩定 | — |
| `≥ 1.5` | 比自己的基準加速 ≥ 50%（`MOMENTUM_HOT`） | **竄升中** |

是相對而非絕對：小 repo 暴衝會贏過大 repo 穩定（ROSS-Index 精神 —— 把新秀抬到
老牌冠軍前面）。

---

## Maintained（Notion SELECT）

「還活著嗎」。**兩個 routine 都寫這欄，但新鮮度的取樣點不同**：`github-trending` 取
ecosyste.ms 的 `pushed_at`；`loot-radar` 取最新一筆**非 bot commit** 的日期（`pushed_at`
會被沒帶 commit 的 push 和 metadata churn 灌水，而 loot 列引用的是某個具體資產的新鮮度；
列上指名檔案／目錄時還會加 `&path=` 只算那條路徑）。之後的判定兩邊相同：`archived` →
archived；那個日期超過 90 天 → stale；否則 active。本 app 不算任何日期，只把 Notion 的
SELECT 值對到徽章文字（`components/ui.tsx` 的 `MAINTAINED_BADGE`）。

| 值 | 意義 | UI |
| --- | --- | --- |
| `active` | 90 天內有新動作（trending 看 push、loot 看 commit）、未封存 | 不顯示（健康預設） |
| `stale` | 超過 90 天沒新動作 | **停更** |
| `archived` | GitHub 上已封存（唯讀／死） | **封存** |

---

## Risk（Notion SELECT —— 僅 trending）

短命／刪除風險，看年齡。規則：`archived` 或 `created_at` < 30 天 → high；
`created_at` 30–180 天 或 Maintained = stale → watch；否則 none。徽章定義在
`components/ui.tsx` 的 `RISK_BADGE`。

| 值 | 意義 | UI |
| --- | --- | --- |
| `none` | 沒事 | 不顯示 |
| `watch` | 30–180 天 或 停更 | **刻意藏掉** —— `watch` 對 trending 是常態（repo 天生年輕），每列都標就是壁紙不是訊號 |
| `high` | 已封存，或 < 30 天（快閃刪除風險） | **高風險** |

---

## License（Notion SELECT —— 值是原始 SPDX id）

儲存的值就是 SPDX id 本身（`MIT`、`Apache-2.0`、`AGPL-3.0-only`…）—— 不是固定列舉，
新 id 會隨時間自動長成 Notion 選項。`licenseTone`（`components/ui.tsx`）用 pattern
把 id 對到顏色；**顏色才是訊號**，徽章文字是原始 id。全部顯示 —— 每個 repo 都有授權，
而授權類別是實打實的採用門檻。

| 類別 | 比對 | 顏色（token） | 採用意義 |
| --- | --- | --- | --- |
| permissive | MIT / Apache / BSD / MPL / ISC / CC0 / Unlicense / 0BSD / Zlib / Artistic / Python / PostgreSQL | 綠（`pos`） | 隨便用，含商用 |
| copyleft | 含 GPL（GPL / AGPL / LGPL） | 紅（`danger`） | 傳染性 —— 採用可能逼你自己的 code 也開源（AGPL 連網路使用都算） |
| source-available | Elastic / BSL / BUSL | 赭橙（`accent`） | 看得到源碼但使用受限 |
| share-alike | CC-BY-SA | 藍（`info`） | 需署名 + 以相同授權再散布 |
| unknown | 以上都不中 | 灰（`muted`） | 不認得 —— 中性顯示，絕不亂猜 |

顏色 mirror Notion SELECT 的配色，但對到的是*本 app 自己*的語意 token，所以 license
的綠／紅跟 ▲▼ delta 是同一個綠同一個紅 —— 一套連貫的 palette，而不是把 Notion 的
確切色值也一起搬進來。

---

## Verdict（Notion rich text，僅 loot）

triage 過後留下的裁決，格式固定 `<bucket> — <理由>`，bucket 只有四個：
`adopt` / `trial` / `skip` / `already-have`。`trial` 尾巴再掛 `; flip when <條件>`，
講明什麼情況下才值得回頭裝。`parseVerdict`（`lib/config.ts`）把 bucket 跟理由拆開；
不符格式的值（例如手打的）整串當理由渲染，不掉字。

`Status` 只有四個狀態，把 `adopt` 跟 `already-have` 一起壓成 `adopted`。所以：

| bucket | 對應 Status | 徽章 | 為何 |
| --- | --- | --- | --- |
| `adopt` | 已採用 | 不顯示 | 狀態徽章已經講完了 |
| `trial` | 觀望 | 不顯示 | 同上；資訊在 `flip when` 那句 |
| `skip` | 已略過 | 不顯示 | 同上 |
| `already-have` | 已採用 | **早就有** | `Status` 表達不了的那個 —— 板子推的東西其實早就在用 |

理由本身則是 always-show：board 卡片一行（clamp 兩行）、詳情頁擺在「我的評估」區塊
最上面，跟評分與狀態同一段（都是使用者自己的判斷，不是 routine 生的推銷詞）。
board 的搜尋框也吃這欄，所以 `already-have` 可以直接當關鍵字查。

未 triage 的列這欄是空的，UI 就整段不渲染；`loot-radar` 不會回填它。

---

## 資料從哪來

| 訊號 | 寫入者（ai-assistant） | Notion 欄位 | 本 app 讀取於 |
| --- | --- | --- | --- |
| Momentum | —（本地算出） | —（來自 `Stars/wk` 序列） | `repoMomentum`，`lib/data.ts` |
| Maintained | `github-trending` + `loot-radar` | `Maintained` | `fetchTrending` / `fetchLoot` |
| Risk | `github-trending` | `Risk` | `fetchTrending` |
| License | `github-trending` + `loot-radar` | `License` | `fetchTrending` / `fetchLoot` |
| Verdict | `loot-radar-triage`（**不是 routine**） | `Verdict` | `fetchLoot` |

Maintained / Risk / License 渲染於 trending 列表 + 詳情、loot board + 詳情（不含
dashboard —— 它的 Front-Page 方言維持精簡，這三個訊號留在 Tape）。Momentum 例外：除了
trending，也渲染於 dashboard 的 本週竄升 區。loot 的 `Maintained` / `License` 會空白，
直到 `loot-radar` 跑一次回填。Verdict 只活在 loot（board + 詳情），dashboard 不聚合它。
