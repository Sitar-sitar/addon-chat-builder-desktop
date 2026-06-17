# 設計書B: コード重複の一本化（旧アプリ撤去）

作成日: 2026-06-17 / 状態: 着手前（正本）/ 実装は未着手

## 1. 目的と前提

対話型アドオン生成アプリが2か所にほぼ同一コピーで存在しており、二重メンテのリスク源になっている。
**正本を `addon-chat-builder-desktop/apps/web/` に一本化し、旧 `addon-chat-builder/` を撤去**する。

- 撤去対象: `D:\my-app2\Minecraft_Addon\addon-chat-builder\`（独立したGitリポジトリ）
- 正本: `D:\my-app2\Minecraft_Addon\addon-chat-builder-desktop\apps\web\`

## 2. 正本が上位互換であることの確認（移行不要の根拠）

`src` ツリーを比較した結果、正本は旧アプリの厳密な上位互換であり、**旧側にしか無い固有機能・固有実装は存在しない**。

| 項目 | 旧 `addon-chat-builder` | 正本 `apps/web` | 判定 |
|---|---|---|---|
| UI（`page.tsx` / `styles.css`） | あり | 完全一致 | 同一 |
| `lib/`（spec/openai/addon-generator/paths/desktop-auth） | あり | 完全一致 | 同一 |
| `api/chat` `api/build` `api/select-folder` | あり | 同一＋ `api/health` `api/lifecycle` を追加保有 | 正本が優位 |
| `lib/env.ts` | `API.env`（cwd）のみ読込 | `%LOCALAPPDATA%\AddonChatBuilderDesktop\.env` → `..\..\.env` → `API.env` を順に読込 | 正本が上位互換 |

→ 旧→正本への**コード移行作業は不要**。撤去とポインタ整理のみで完結する。

## 3. 撤去対象一覧

### 3-1. ディレクトリ本体（独立Gitリポジトリ）

- `Minecraft_Addon/addon-chat-builder/`（`.git` を持つ独立リポジトリ）
  - ソース: `src/`、`package.json`、`tsconfig*`、`next.config.ts`
  - 生成物/ログ: `.next/`、`node_modules/`、`tsconfig.tsbuildinfo`、`*.log`
  - 起動補助: `start.bat`、`launcher.ps1`、`Addon Chat Builder.lnk`、`.launcher/`
  - 機密: `.env`（撤去前に内容が正本側 `.env`／`%LOCALAPPDATA%` に存在するか要確認。OPENAI_API_KEY等を失わないこと）

### 3-2. 撤去方法の選択（要判断）

- 案1（推奨）: フォルダごと削除。GitHub リポジトリ `Sitar-sitar/addon-chat-builder` はアーカイブ化（読み取り専用）。
- 案2: ローカルは削除、GitHubは残置（履歴保全のみ）。
- いずれもローカル削除前に、最終コミットがリモートへ push 済みであることを確認する。

## 4. 影響範囲と対応（参照の付け替え）

撤去に伴い、旧パスを指す参照を正本へ更新する。**コード上の実害がある参照（C#）を最優先**で対応する。

### 4-1. デスクトップ本体C#（実害あり・必須）

`src/AddonChatBuilder.Desktop/Services/AppSettingsService.cs`

- `FindWebAppPath()`（L248〜268）: 探索候補から
  `Path.Combine(root, "addon-chat-builder")` と `Path.Combine(root, "..", "addon-chat-builder")`（L255〜256）を**削除**。`apps/web`（L254）のみ残す。
- `IsKnownLegacyWebAppPath()`（L281〜301）: 旧パス検出ロジック全体の扱いを決める。
  - 撤去後も「旧パスを指す古いユーザー設定を `apps/web` へ自動矯正する」効果は残しておく方が安全なため、**当面は残置（旧パスを legacy として検出し正本へ移行）でも可**。完全撤去するなら本メソッドと呼び出し（L175）を削除。
  - 設計判断: 既存ユーザーの `appsettings.json` / `%LOCALAPPDATA%` 設定が旧パスを保持している可能性を考慮し、**1リリースは残置→次リリースで削除**の二段階を推奨。

`src/AddonChatBuilder.Desktop/MainWindow.xaml.cs`

- L82 のエラーメッセージ `"Node.js または addon-chat-builder の構成を確認してください。"` の文言を、正本前提の表現（例: 「Node.js または apps/web の構成を確認してください。」）へ更新。

### 4-2. プロジェクトドキュメント（必須）

- `addon-chat-builder-desktop/README.md`
  - L3: 「`addon-chat-builder` を…起動するための」→ 同梱 `apps/web` を起動する旨へ修正。
  - L19: 旧 `..\addon-chat-builder` への移行/フォールバック記述を、撤去後の実態（`apps/web` のみ）に合わせて修正または削除。

### 4-3. 上位ドキュメント（必須・正本管理）

`D:\my-app2\PROJECT_OVERVIEW.md`

- L22 一覧表の `Minecraft_Addon/addon-chat-builder/` 行: パスを `addon-chat-builder-desktop/apps/web/` 系に集約、または「desktop に同梱」と明記。
- L55 GitHub リンク（`addon-chat-builder`）: アーカイブ済みである旨を注記、または削除。
- L662 リファクタ対象列挙の `addon-chat-builder/`: 実態に合わせ更新。
- L673〜731 の「12. addon-chat-builder」節と desktop 節（L731〜756）: 旧アプリ撤去・desktop一本化を反映して統合。

`D:\my-app2\PORTS.md` / `D:\my-app2\ports.json`

- ポート3031の行（`PORTS.md` L34、`ports.json` L52〜53）: `project`/`directory` を `addon-chat-builder-desktop/apps/web/` へ更新。**ポート番号3031・bind `127.0.0.1` は変更しない**（実害回避）。

### 4-4. Obsidian（CLAUDE.md §8に従い作業後に更新）

- `D:\Obsidian\MyVault\Projects\D-my-app2.md`、`my-app2 プロジェクト一覧.md`、`my-app2 ポート台帳.md` の `addon-chat-builder` 記述を、撤去・一本化の結果に合わせて更新。
- 転記範囲は概要・判断理由・代表コマンド・重要パス・検証結果・注意点に限定（ソース/鍵/ログ本文は転記しない）。

### 4-5. 履歴文書（更新不要・任意注記）

- `addon-chat-builder-desktop/IMPLEMENTATION_PLAN.md` は実装当時の記録（L23/64/181/276/289/362/440/579 等で旧パス言及）。**歴史的記録として原則そのまま**。誤読防止の追記をするなら冒頭に「旧 addon-chat-builder は2026-06に撤去・apps/web へ一本化済み」の一文を足す程度に留める。

## 5. 撤去手順（段階的・検証付き）

1. **バックアップ/退避確認**
   - 旧 `.env` のキーが正本側（`addon-chat-builder-desktop\.env` または `%LOCALAPPDATA%\AddonChatBuilderDesktop\.env`）に存在することを確認。無ければ先に退避。
   - 旧リポジトリの未push変更が無いこと（`git status` / `git log` で確認）。
2. **正本の単独起動を確認（撤去前のグリーン）**
   - `cd apps\web && npm install && npm run lint && npm run build`
   - `npm run dev` で `http://127.0.0.1:3031` が起動し、対話→`.mcpack`生成まで通ること。
3. **C#参照の付け替え（4-1）** → `dotnet build` 成功、デスクトップ起動で `apps/web` を解決して起動できること。
4. **旧フォルダ削除（3-2の選択に従う）**。
5. **デスクトップ再起動で回帰確認**: 旧パスが無くても `apps/web` で正常起動・生成完了すること。
6. **ドキュメント更新（4-2〜4-4）**。
7. **コミット**（ユーザー指示後）。`addon-chat-builder-desktop` リポジトリ側にまとめてコミット。

## 6. ロールバックとリスク

- ロールバック: 旧リポジトリは削除前に push 済み／GitHub残置のため、復元はクローンで可能。C#変更は1コミットに分離しておき revert 可能にする。
- リスクと緩和:
  - 既存ユーザー設定が旧パスを保持 → `IsKnownLegacyWebAppPath` を当面残置し自動矯正（4-1）。
  - 旧 `.env` のキー消失 → 手順1で事前確認。
  - 3031以外を期待する外部参照 → ポート番号は不変に保つ（4-3）。

## 7. 完了の定義（DoD）

- 旧 `addon-chat-builder/` が存在しなくても、デスクトップ起動・`npm run dev` 単独起動の双方で全機能が動く。
- C#・README・PROJECT_OVERVIEW・PORTS・ports.json・Obsidian から、撤去済み旧パスへの「現役」参照が無い（履歴記録を除く）。
- `npm run lint` / `dotnet build` がエラーなし。
