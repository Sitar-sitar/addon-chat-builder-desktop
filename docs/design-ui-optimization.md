# 設計書A（確定版）: UIリデザイン — 草原テーマ × 対話UX「チャット＋ライブ設計図」

- 作成日: 2026-06-17
- 対象アプリ: addon-chat-builder-desktop（適用先 `apps/web`）
- 種別: 実装設計書
- 対象バージョン: 未採番（UIリデザイン反映先）
- 前提コミット: 091b8e2（レビュー前提コミット）
- ステータス: 実装済み（ブランチ `codex-migrate-web-monorepo`・コード反映済み／WebView2実機の見た目確認は残）
- 関連: レビュー [レビュー_UIリデザイン設計_2026-06-17.md](レビュー_UIリデザイン設計_2026-06-17.md) を反映 / 後続前提 [design-consolidation.md](design-consolidation.md) / 索引 [設計書インデックス.md](設計書インデックス.md)

> 本書は旧ドラフト「UI最適化6項目」を統合・置換（同一ファイル内で supersede）。レビュー(2026-06-17) の P1〜P3 を反映済み。
> 実装メモ: フォントは実装時に DotGothic16 を `@import` 方式へ変更（§3.1）。`vitest` 10件／`tsc --noEmit`／`next build` グリーンを確認。`@tabler/icons-react` を依存追加。

## 0. 採用決定事項

- ビジュアル: **草原 / Overworld（Minecraft風・明るい昼）** を採用。
- 対話UX: **パターンB「チャット＋ライブ設計図」**（左=会話、右=回答ごとに埋まる設計図、上=3ステップ表示）。
- **トークン認証は変更しない**（`lib/desktop-auth.ts` の `verifyDesktopRequest` / `DESKTOP_API_TOKEN`、各APIの呼び出し経路・ヘッダ、WebView2ブリッジは現状維持）。
- 既存機能（recipe / item / script の対話整理 → `.mcpack` 生成）は維持。会話の進め方と見た目のみ変更。
- **完了判定の単一源**: `validateSpec` を唯一の判定源とし、ライブ設計図の完了表示・ステッパー・生成CTA はすべてこれに一致させる（現機能維持。`description`/`displayName`/`summary` の生成必須要件は変更しない）。【レビューP1-1】
- **テスト**: `vitest` を devDependency として導入し純粋関数を最小テスト。【レビューP1-2】
- **フォント/アイコン**: 体裁重視。`next/font/google`＋`@tabler/icons-react` を使用し、**ビルド/開発時のネットワーク前提を許容・明記**。【レビューP2】
- **「フォルダを開く」はMVP非対象**（クロージャは「続けて作る」のみ）。【レビューP2/確認】
- 適用先は正本 `apps/web/` のみ。**設計書B（旧 `addon-chat-builder` 撤去）を先に実施**してから本書を適用すること。

## 1. 変更対象ファイル

| ファイル | 区分 | 変更概要 |
|---|---|---|
| `apps/web/src/app/page.tsx` | 改修(大) | レイアウト刷新、ステッパー/チップ/ライブ設計図、state追加、挙動追加 |
| `apps/web/src/app/styles.css` | 置換(大) | 草原テーマtokens＋ブロックUIクラス、2カラム、レスポンシブ |
| `apps/web/src/app/layout.tsx` | 改修(小) | フォント読込（next/font/google）追加。`lang="ja"` 維持 |
| `apps/web/src/lib/openai.ts` | 改修(中) | レスポンスへ `suggestedReplies`/`recommendedReply` 追加（スキーマ・型・正規化・systemプロンプト） |
| `apps/web/src/lib/spec.ts` | 改修(小) | 行レベル述語の切り出し（`validateSpec` の合否挙動は不変）。`blueprintRows` と共有【P1-1】 |
| `apps/web/src/utils/addon-view.ts` | 新規(小) | 純粋関数 `kindLabel` / `stepState` / `blueprintRows` |
| `apps/web/tests/unit/addon-view.test.ts` | 新規(小) | 上記純粋関数の最小テスト |
| `apps/web/package.json` | 改修(小) | devDep `vitest` 追加＋ `"test": "vitest run"`、dep `@tabler/icons-react` 追加【P1-2/P2】 |

**変更しないファイル**: `lib/desktop-auth.ts`（認証）、`lib/addon-generator.ts`、`lib/paths.ts`、`lib/env.ts`、`api/chat/route.ts`（`result` をそのまま返すため追加フィールドは自動で透過）、`api/build/route.ts`、`api/select-folder/route.ts`、`src/AddonChatBuilder.Desktop/MainWindow.xaml.cs`（WebView2ブリッジ＝open-folder非対象のため不変）。

## 2. 画面レイアウト仕様（パターンB）

縦構成（上→下）:

1. **トップバー（草地ブロック）**: 左に eyebrow `MINECRAFT BEDROCK` ＋ h1 `ADDON CHAT BUILDER`、右に装飾ハート3つ＋「リセット」ボタン。
2. **ステッパー（全幅・ホットバー風スロット3つ）**: `① 種類 / ② 詳細 / ③ 生成`。状態で done/current/todo を切替（§7 `stepState`）。
3. **本体2カラム**（`grid-template-columns: 1.5fr 1fr`）:
   - **左=チャットパネル**: メッセージ一覧（自動スクロール）＋ 直近AIメッセージ下の**クイック返信チップ**＋ 入力フォーム（textarea＋送信）。会話開始前はスターター例3つを表示。
   - **右=ライブ設計図パネル（BLUEPRINT）**: 見出し＋現タイトル、`blueprintRows` による各項目の状態行（✓/編集中/未定/情報）、残数ノート、`canBuild` 時のみ出力先UI＋「.mcpack を生成」、生成結果（result）。
4. 生成可能になったら、チャット末尾に**生成CTA**（保存されたメッセージではなく派生表示）を出す（3-1）。生成後はクロージャ表示（3-2）。

レスポンシブは §9。

## 3. ビジュアルテーマ仕様（草原 / Overworld）

角丸は原則 0（ブロック感）。ハードシャドウのベベルで立体を表現。

### 3.1 フォント・アイコン（体裁重視・ネットワーク前提）【P2】

- 日本語・本文: **DotGothic16**。ラテンのアクセント（eyebrow / h1）: **Press Start 2P**。
- 読込（実装実態）:
  - `Press Start 2P` は `layout.tsx` で `next/font/google`（`subsets:["latin"]`, `display:"swap"`, CSS変数 `--font-press`）。
  - `DotGothic16` は **`styles.css` の `@import`**（`https://fonts.googleapis.com/css2?family=DotGothic16`）で読み込む。`next/font/google` の DotGothic16 は `cyrillic/latin/latin-ext` サブセットのみで**日本語を配信しない**ため、`@import`（Google の unicode-range 配信）を用いる。`body` 既定フォントは `"DotGothic16", "Yu Gothic", Meiryo, sans-serif`。
- **ネットワーク前提（許容・明記）**: `next/font/google`（ビルド/開発時取得）と `@import`（実行時取得）のいずれも Google Fonts を前提とする。ローカルアプリだが本構成では**ネットワーク前提**とする。将来オフライン再現が必要なら両フォントを `next/font/local`＋同梱へ切替（OFLライセンスで同梱可）。
- アイコンは **`@tabler/icons-react`（dep追加）** の outline コンポーネントを使用: `IconCheck`(完了) / `IconPencil`(編集中) / `IconLock`(未着手) / `IconPlayerPlay`(生成) / `IconRefresh`(続けて作る) / `IconHeart`(装飾)。初回ビルド時に取得（ネットワーク前提）。
- 最小サイズ: 本文 16–20px、補助 14px以上、ステッパー番号等の Press Start 2P は 12px以上。

### 3.2 カラートークン（`styles.css` の `:root`）

| 用途 | 変数 | 値 |
|---|---|---|
| 背景(空) | `--bg` | `#8cb4ff` |
| 文字 | `--ink` / `--muted` | `#262626` / `#5a5a5a` |
| 仕切り線 | `--line` | `#3a3a3a` |
| 草地トップ | `--top` | `linear-gradient(#7cb441 0 54%,#5f8f31 54% 60%,#7a5a3a 60% 100%)` |
| 草地下端 | `--top-edge` | `#3c5a1e` |
| パネル面/光/影 | `--panel`/`--panel-light`/`--panel-dark` | `#cfcfcf` / `#ececec` / `#8f8f8f` |
| パネル枠 | `--panel-edge` | `#2c2c2c` |
| ボタン面/光/影 | `--btn`/`--btn-light`/`--btn-dark` | `#bcbcbc` / `#e4e4e4` / `#7d7d7d` |
| アクセント(生成/推奨) | `--accent`/`--accent-light`/`--accent-dark`/`--accent-edge` | `#5aa83f` / `#7cc85f` / `#3a6f28` / `#244d16` |
| AI吹き出し/ユーザー吹き出し | `--bub-ai` / `--bub-user` | `#dadada` / `#b9d2ff` |
| 入力面 | `--input-bg` / `--input-fg` | `#f4f4f4` / `#777777` |
| チップ面/枠/字 | `--chip` / `--chip-edge` / `--chip-ink` | `#eaf4e2` / `#3a6f28` / `#2f6b1c` |
| ステップ現在(選択) | `--cur-bg` / `--cur-ink` | `#fff5cf` / `#7a5a10` |
| ステップ完了 | `--done-bg` / `--done-ink` | `#cfe3c2` / `#2f6b1c` |
| ハート | `--heart` | `#e0524d` |

固定テーマ（claude.ai/OSのライト・ダーク切替には追従しない）。個人利用専用のため許容。

### 3.3 ブロックUI 共通スタイル（ベベル式）

| 要素 | 枠 | box-shadow（ベベル） | 補足 |
|---|---|---|---|
| パネル `.panel` | `3px solid var(--panel-edge)` | `inset 4px 4px 0 var(--panel-light), inset -4px -4px 0 var(--panel-dark)` | 凸（光=左上） |
| ボタン `.btn` | `3px solid var(--panel-edge)` | `inset 3px 3px 0 var(--btn-light), inset -3px -3px 0 var(--btn-dark)` | 凸 |
| 主ボタン `.btn.pri` | `3px solid var(--accent-edge)` | `inset 3px 3px 0 var(--accent-light), inset -3px -3px 0 var(--accent-dark)` | 文字 `#fff` |
| チップ `.chip` | `3px solid var(--chip-edge)` | `inset 3px 3px 0 #fbfff7, inset -3px -3px 0 #b9d6a6` | 凸・淡緑 |
| 推奨チップ `.chip.rec` | 同上 | `inset 3px 3px 0 var(--accent-light), inset -3px -3px 0 var(--accent-dark)` | `--accent`地・白字 |
| 入力 `.ta` | `3px solid var(--panel-edge)` | `inset 3px 3px 0 var(--panel-dark)` | 凹（沈み） |
| ステップ `.step` | `3px solid var(--panel-edge)` | `inset 3px 3px 0 #6f6f6f, inset -3px -3px 0 #c4c4c4` | 凹（スロット） |

- `.step.done` → 背景 `--done-bg`／字 `--done-ink`。
- `.step.cur` → 背景 `--cur-bg`／字 `--cur-ink`／`outline:4px solid #fff; outline-offset:-2px;`（選択中スロット）。
- `.step.todo` → `opacity:.55`（南京錠アイコン）。
- ホバー（`:hover:not(:disabled)`）: ボタン/チップは枠を `#fff` で強調 or わずかに明るく。`button:disabled{opacity:.55;cursor:not-allowed;}`。
- アイコンは §3.1 の `@tabler/icons-react` コンポーネントを使用。

### 3.4 主要クラス寸法（目安）

- `.step`: `flex:1; padding:12px 14px; gap:10px;` 番号=Press Start 2P 13px、ラベル=19px。
- `.chip`: `font-size:18px; padding:8px 13px;`、`.chips{display:flex;flex-wrap:wrap;gap:9px;}`。
- `.msg`: `border:3px solid var(--panel-edge); padding:11px 14px; max-width:88%;` 役割ラベル15px、本文20px、`white-space:pre-wrap`。`.msg.ai{align-self:flex-start;}` `.msg.user{align-self:flex-end;}`。
- `.bp-row`: `display:flex;align-items:center;gap:10px; padding:11px 0; border-bottom:2px solid var(--panel-dark);` ラベル幅 84–96px。`.bp-row.cur` は `--cur-bg` 反転。情報行 `.bp-row.info` はステータスアイコンなし（淡色表示）。

## 4. 状態設計（`page.tsx` / すべて `useState`）

```ts
type Message = { role: "user" | "assistant"; content: string };
type BuildResult = { mcpackPath: string; files: string[] };

const [messages, setMessages]               // 初期: [{role:"assistant", content: initialMessage}]
const [input, setInput]                      // ""
const [spec, setSpec]                        // emptySpec
const [outputDir, setOutputDir]              // ""
const [isChatting, setIsChatting]            // false
const [isBuilding, setIsBuilding]            // false
const [isSelectingOutput, setIsSelectingOutput] // false
const [buildResult, setBuildResult]          // null
const [suggestedReplies, setSuggestedReplies] // string[]  ← 新規・初期 []
const [recommendedReply, setRecommendedReply] // string    ← 新規・初期 ""
```

- **削除**: 旧 `showSpec`（設計図は2カラムで常時表示。狭幅はCSSで縦積み）。

派生値（`useMemo` または素の計算）:

| 名前 | 算出 |
|---|---|
| `specErrors` | `validateSpec(spec)` |
| `canBuild` | `specErrors.length === 0`（**唯一の完了判定源**） |
| `hasStarted` | `messages.some(m => m.role === "user")` |
| `step` | `stepState({ hasStarted, canBuild, built: !!buildResult })`（§7.2） |
| `rows` | `blueprintRows(spec)`（§7.3。`current`+`pending` 件数 = `specErrors.length`） |
| `showReadyCta` | `canBuild && !isChatting && !buildResult` |
| `showChips` | `!showReadyCta && !isChatting && suggestedReplies.length > 0 && messages.at(-1)?.role === "assistant"` |

- **排他**【P2】: `showReadyCta` を優先し、生成CTA表示時はクイック返信チップを出さない（`showChips` に `!showReadyCta` を含める）。生成できる状態では「.mcpack を生成」「内容を直す」のみを提示し、利用者の迷いを防ぐ。

## 5. API仕様変更（`/api/chat` レスポンス拡張）— 認証不変

### 5.1 JSONスキーマ（`openai.ts` の `schema`）

トップレベル（strict）に2項目を追加。`required` にも追加すること。

```jsonc
properties: {
  assistantMessage: { type: "string" },
  spec: { /* 既存のまま */ },
  // 0〜4個。短い日本語（目安12文字以内）。0件=自由記述質問
  suggestedReplies: { type: "array", maxItems: 4, items: { type: "string" } },
  recommendedReply: { type: "string" } // suggestedReplies のいずれか。無ければ ""
}
required: ["assistantMessage","spec","suggestedReplies","recommendedReply"]
```

### 5.2 型定義と正規化（`openai.ts`）【P2】

- `RawChatResult` に `suggestedReplies: string[]; recommendedReply: string;` を追加。
- `ChatResult`（戻り値型）に同2項目を追加。
- `refineAddonSpec` は返却前に**正規化**する（モデル出力のぶれをUIに持ち込まない）:
  1. `suggestedReplies`: 各要素 `trim` → 空文字除去 → 重複除去 → 先頭4件に切り詰め。
  2. `recommendedReply`: `trim`。正規化後の `suggestedReplies` に含まれなければ `""`。
- 旧レスポンス互換のためクライアントでも `?? []` / `?? ""` で防御（§6）。

### 5.3 systemプロンプト追記（`refineAddonSpec` の system テキスト）

既存指示に次を追加:

- 「assistantMessage の冒頭で、ユーザーの希望を一度だけ短く言い換えて確認してください（おうむ返し）。冗長な繰り返しはしない。」（案2-2）
- 「ユーザーが次に答える質問について、選びやすい回答候補を suggestedReplies に2〜4個・各12文字以内で入れてください。最も無難な既定値があれば recommendedReply にその文字列を入れ、無ければ空文字に。自由記述が適切な質問では suggestedReplies を空配列にしてください。」（案1-2/1-3）

### 5.4 route・認証

- `api/chat/route.ts` は `NextResponse.json(result)` のまま（新フィールドは自動で透過）。変更不要。
- `verifyDesktopRequest` の呼び出し・トークン検証・WebView2ブリッジは一切変更しない。

## 6. （クライアント）チャット処理の更新（`page.tsx`）

- `sendText` 開始時に `setSuggestedReplies([])`（前問の候補を即時クリア）。
- 成功時: `setSpec(data.spec)`、`setMessages([...nextMessages, {role:"assistant", content:data.assistantMessage}])`、`setSuggestedReplies(data.suggestedReplies ?? [])`、`setRecommendedReply(data.recommendedReply ?? "")`。
  - 旧 `setShowSpec(...)` は削除。
- エラー時: 候補は出さない（`suggestedReplies` 空のまま）。エラーは従来どおりチャットへ assistant メッセージとして積む（方式維持）。

## 7. 純粋ロジック（新規 `utils/addon-view.ts`）

副作用なし・テスト対象。

### 7.1 `kindLabel(kind: AddonKind): string`
`recipe→"レシピ" / item→"アイテム" / script→"スクリプト"`。

### 7.2 `stepState(input): StepView`
```ts
type StepStatus = "done" | "current" | "todo";
type StepView = { kind: StepStatus; detail: StepStatus; build: StepStatus };
```
判定:
| 条件 | 種類 | 詳細 | 生成 |
|---|---|---|---|
| `!hasStarted` | current | todo | todo |
| `hasStarted && !canBuild` | done | current | todo |
| `canBuild && !built` | done | done | current |
| `built` | done | done | done |

### 7.3 `blueprintRows(spec: AddonSpec): Row[]`【P1-1: 単一判定源】
```ts
type Row = { label: string; value: string; status: "done" | "current" | "pending" | "info" };
```
- **単一の判定源**: ブロッキング項目の `done/current/pending` は `validateSpec` と**同一の述語**で判定する。重複防止のため行レベル述語を `spec.ts` に切り出し（例: `specChecks(spec): { label: string; value: string; ok: boolean }[]`）、`validateSpec` と本関数で共有する。**`validateSpec` の合否挙動は変更しない**（現機能維持）。
- ブロッキング行（= `validateSpec` が見る項目、固定順）:
  - 共通: `種類`(`kindLabel`・常に done表示) / `名前`(`title` 非空) / `説明`(`description` 非空)。 ← **説明行を追加**（`validateSpec` が必須にしているため）。
  - recipe: `完成品`(`:` 含む) / `個数`(1〜64) / `形`(行数1〜3) / `素材`(key数≥1)。
  - item: `ID`(`:` 含む) / `最大スタック`(1〜64)。
  - script: `イベント`(itemUse/blockBreak/interval)。
  - 末尾共通: `namespace`(`/^[a-z][a-z0-9_]*$/`) / `出力名`(`/^[a-z0-9][a-z0-9_-]*$/`)。
- **情報行**（非ブロッキング, `status:"info"`）: item の `表示名`(`displayName`)、script の `概要`(`summary`)。値があれば表示、無ければ「未設定」。**生成可否には影響しない**。
- status 付与: ブロッキング行で妥当=`done`。**最初の不正/未定の行のみ `current`**、それ以降の不正行は `pending`。情報行は常に `info`。値が空のものは表示 `"未定"`。
- **完了の同値性**: 「`current`+`pending` の件数 = 0」 ⇔ `specErrors.length === 0`（= `canBuild`）。共有述語によりこれを保証。残数ノート・ステッパー③・生成CTA はすべて `canBuild` と一致する。

## 8. インタラクション仕様（要素別）

| 要素 | トリガー | 挙動 | 由来 |
|---|---|---|---|
| メッセージ一覧 | `messages`/`isChatting` 変化 | 末尾へ自動スクロール（`ref`＋`useEffect`で `scrollIntoView({block:"end"})`、`behavior:"smooth"`） | A-1 |
| 入力textarea | `Enter`（`!shiftKey` かつ `!e.nativeEvent.isComposing`） | 送信（`Shift+Enter`は改行）。IME変換確定Enterは送信しない | A-2 |
| 送信ボタン | click | 従来どおり送信（`disabled = isChatting || !input.trim()`） | 現行 |
| スターター例 | click（開始前のみ表示） | `sendText(prompt)` | 現行 |
| クイック返信チップ | click | `sendText(label)`。`disabled = isChatting`。`label === recommendedReply` の1つに `.rec`。**`showReadyCta` 時は非表示** | 1-2/1-3, P2 |
| ステッパー | 表示のみ（非操作） | `step` に応じ done/current/todo を描画 | 2-1 |
| ライブ設計図 行 | 表示のみ | `rows` を描画、`current` 行を強調、`info` 行はステータスなし | B, P1-1 |
| 残数ノート | 表示のみ | `current+pending` 件数>0 で「あとN個できまる」、0で「準備OK！」（= `canBuild`） | B |
| 生成CTA（チャット末尾） | `showReadyCta` で表示 | 「.mcpack を生成」チップ→ `buildPack()`。横に「内容を直す」=入力にフォーカス | 3-1 |
| 出力先（設計図内） | 入力/「フォルダを選択」/「既定に戻す」 | 現行 `selectOutputDir` / 手入力 / `setOutputDir("")` を維持 | 現行 |
| 生成ボタン（設計図内） | click | `buildPack()`。`disabled = isBuilding || !canBuild` | 現行 |
| 検証警告 | `specErrors.length>0` | warning-box 表示（テーマ配色で） | 現行 |
| 生成結果 | `buildResult` | result-box にパス＋ファイル一覧 | 現行 |
| クロージャ | `buildResult` 設定後 | 完了メッセージ（現行の assistant 追記を維持）＋ チップ「続けて作る」=`resetAll()` | 3-2 |
| リセット | click | `resetAll()`（`suggestedReplies`/`recommendedReply` も初期化。`showSpec` は廃止） | 現行 |

`resetAll` 更新点: 既存初期化に加え `setSuggestedReplies([])`・`setRecommendedReply("")` を追加。`setShowSpec` 行は削除。

### 8.1 「フォルダを開く」— 本MVPは非対象【P2/確認】

- 本リデザインでは**実装しない**。クロージャは「続けて作る」(`resetAll`) のみ（フロント完結・認証/.NET変更なし）。
- 将来実装する場合の注意（記録のみ）: 新規 `api/open-folder` を `build`/`chat` と同様に `verifyDesktopRequest` 付きで作る場合、WebView2ブリッジ（`MainWindow.xaml.cs:158` の `withDesktopToken` 対象が `/api/chat` と `/api/build` のみ）に `/api/open-folder` を追加しないと 401 になる。HTTP API ではなく WebView2 message 経由（.NET 側の `selectOutputFolder` と同様）で `explorer.exe` を依頼する方法もある。

## 9. レスポンシブ（FHD前提＋縮小耐性）

- 主対象: **1920×1080（FHD）デスクトップ**。本体は `max-width` を設けず横幅を活用、2カラム `1.5fr / 1fr`。WebView2 既定ウィンドウでの表示を実機確認。
- `@media (max-width: 1024px)`: 2カラムを1カラムに（設計図はチャットの下へ）。ステッパーは横幅維持で縮小、必要に応じ番号のみ。
- `@media (max-width: 640px)`: スターター/チップ/出力操作を縦並び、ステッパーはラベル短縮。
- 画像/ベベルは `image-rendering: pixelated` を適用（拡大時のにじみ防止）。

## 10. アクセシビリティ

- メッセージ一覧コンテナに `aria-live="polite"`・`role="log"`・`aria-atomic="false"`（AI返答/「整理中」を読み上げ）。（A-6）
- 装飾アイコン/ハートは `aria-hidden="true"`、アイコンのみのボタンは `aria-label`。
- チップ/ボタンはネイティブ `<button>`、`disabled` を適切に。`lang="ja"` 維持。
- 色のみに依存しない: ステップ・設計図の状態はアイコン（IconCheck/IconPencil/IconLock）でも表現。

## 11. 非対象（やらないこと）

- 対応アドオン種類の追加（recipe/item/script のまま）。
- 生成必須要件の厳格化（`displayName`/`summary` は必須化しない＝現機能維持）。【P1-1】
- API I/F の経路・認証・WebView2ブリッジ変更（追加するのは `/api/chat` レスポンスの任意2フィールドのみ）。
- 「フォルダを開く」エンドポイント（MVP非対象）。【P2】
- 状態管理ライブラリ導入（`useState` 維持）。
- AI応答のストリーミング表示（案5-1）・値タップ修正（案4-1）・ひとつ戻る（案4-2）は将来拡張。
- ライト/ダーク自動切替（テーマ固定）。

## 12. 受け入れ基準・テスト

### 12.1 手動（`cd apps/web && npm run dev` → `http://127.0.0.1:3031`）
1. 開始前: ステップ①がcurrent、設計図は「未定」、スターター例が表示。
2. スターター/入力で送信→ AIがおうむ返し＋質問、チップが2〜4個表示、推奨に `.rec`。
3. チップ click で即送信、送信中はチップ非活性・前問チップが消える。
4. 回答ごとに設計図の行が ✓ になり、current 行が次へ移動、残数ノートが減る。情報行（表示名/概要）は生成可否に影響しない。
5. 末尾自動スクロール、Enter送信／Shift+Enter改行／IME変換確定Enterで誤送信しない。
6. 揃うとステップ③current＋チャット末尾に生成CTA（このときクイック返信チップは出ない＝排他）。出力先選択→生成→ result 表示→ 完了メッセージ＋「続けて作る」。
7. 「続けて作る」で初期状態へ。リセットも同様。
8. 生成/チャット失敗時はエラーメッセージがチャットに出る（従来挙動）。
9. ウィンドウ幅を狭めると1カラム化（設計図が下）。
10. 全機能回帰: 既存の生成物（`.mcpack`）が従来どおり生成される。「準備OK」表示と生成ボタン活性が常に一致する（P1-1の同値性）。

### 12.2 型/Lint/テスト
- `npm run lint`（= `tsc --noEmit`）エラーなし。
- `npm run test`（= `vitest run`）グリーン。

### 12.3 ユニット（`tests/unit/addon-view.test.ts` / vitest）
- `kindLabel`: 3種の戻り。
- `stepState`: §7.2 の4条件で期待どおり。
- `blueprintRows`: recipe/item/script それぞれで、(a) 未入力→`current` が先頭不正行に1つだけ、(b) 妥当化で `done`、(c) 行順が固定、(d) 情報行は常に `info`、(e) **`current+pending` 件数 = `validateSpec(spec).length`** の同値性。

### 12.4 WebView2 実機
- デスクトップアプリ起動で表示崩れ・フォント適用・2カラムを確認。

## 13. 推奨実装順序（1ファイル単位）

1. `lib/spec.ts`（行レベル述語の切り出し・`validateSpec` 合否は不変）＋ `utils/addon-view.ts`＋ `package.json`(vitest) ＋ `tests/unit/addon-view.test.ts`。
2. `lib/openai.ts`（スキーマ・型・正規化・プロンプト・戻り値）。
3. `app/layout.tsx`（フォント）＋ `package.json`(`@tabler/icons-react`)。
4. `app/styles.css`（テーマtokens＋クラス）。
5. `app/page.tsx`（state・派生値・レイアウト・挙動）。
6. `npm run lint` → `npm run test` → 手動確認（§12.1）→ WebView2確認。

CLAUDE.md方針に従い「設計提示済み → 1ファイル単位で生成」「正常系優先・主要ロジックのみテスト」で進める。実装着手後、Obsidian関連ノート（D-my-app2 / ポート台帳など）と `PROJECT_OVERVIEW.md` の該当箇所、`docs/設計書インデックス.md` の状態を更新する（設計書B側の付け替えと合わせて実施）。
```
