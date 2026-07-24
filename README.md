# addon-chat-builder-desktop

Minecraft Bedrock アドオン／JavaパックをAIとの対話で作成する、.NET + WebView2 のWindowsデスクトップアプリ。

**2026-07-22以降、本リポジトリの `main` ブランチがプロジェクト全体の現行正本である。** Next.js アプリ本体は同梱の `apps/web` で管理し、デスクトップ本体は起動・停止・WebView表示・Windows標準UI連携を担当する。

旧単体リポジトリ `Sitar-sitar/addon-chat-builder` / `..\addon-chat-builder` は履歴・退避用の legacy であり、新規開発、不具合修正、設計書更新の反映先にしない。

## 構成

```text
addon-chat-builder-desktop/
├── apps/
│   └── web/                          # Next.js Webアプリ
├── src/
│   └── AddonChatBuilder.Desktop/     # WPF + WebView2 デスクトップアプリ
├── docs/
└── scripts/
```

ユーザー別設定が旧 `..\addon-chat-builder` を指していても、`apps/web` が実行可能なら起動時に自動で正本へ移行する。現行実装に残る旧パス探索は移行・ロールバック用の互換機能であり、旧リポジトリを現行正本とするものではない。

## Git運用

- 既定ブランチは `main`。リリース可能な現行状態は `main` で管理する。
- Webアプリの変更も `apps/web` へ行い、旧単体リポジトリへは反映しない。
- 設計・レビュー・実装記録は本リポジトリの `docs/` に集約する。

## Web アプリの依存関係

```powershell
cd apps\web
npm install
npm run lint
npm run build
```

`.env` はGit管理しない。必要なキーは `D:\my-app2\Minecraft_Addon\addon-chat-builder-desktop\.env` に置く。デスクトップアプリ経由では起動時に環境変数として渡し、`apps\web` を直接起動した場合も同じ `.env` を参照する。

Java版 apps/web v0.7.1 では、レシピ8種、定期・イベント駆動スクリプト、条件付きアクション、ブロックドロップ差し替え、lang／アイテムモデル差し替えを決定論的に生成する。対象バージョンは `JAVA_TARGET_VERSION` で厳密に指定し、`1.21`、`1.21.4`、`1.21.5`、`1.21.7`、`26.2` に対応する。このPCの実機確認用設定は `1.21.5`、未設定時の既定値は `1.21.7`。

既定出力先は次のとおり。

- Bedrock: `D:\my-app2\Minecraft_Addon\mcpackファイル`
- Java: `D:\my-app2\Minecraft_Addon\javaパックファイル`

## .NET SDK

このプロジェクトでは、共通方針どおり `C:\Program Files\dotnet\sdk` に入れた .NET SDK を使う。プロジェクト専用の `.dotnet` フォルダは作らない。

```powershell
dotnet --info
dotnet run --project src\AddonChatBuilder.Desktop
.\dotnet.cmd --info
.\dotnet.cmd run --project src\AddonChatBuilder.Desktop
```

PowerShell セッション全体で `dotnet` コマンドとして使いたい場合は、以下を実行する。

```powershell
. .\scripts\Use-LocalDotNet.ps1
dotnet --info
```

`global.json` で SDK `8.0.421` を固定しているため、別PCでも同じ SDK を入れれば挙動を揃えやすい。

Java多パターン対応の正本は [機能設計書_Java多パターン対応_2026-07-19.md](docs/機能設計書_Java多パターン対応_2026-07-19.md)。
リリース後の修正は [修正設計書_Java多パターン実装精査対応_2026-07-20.md](docs/修正設計書_Java多パターン実装精査対応_2026-07-20.md)（v0.7.1）、
[修正設計書_Java多パターン現行再評価対応_2026-07-23.md](docs/修正設計書_Java多パターン現行再評価対応_2026-07-23.md)（v0.7.2）、
[修正設計書_Java時刻天候アクション設定化_2026-07-24.md](docs/修正設計書_Java時刻天候アクション設定化_2026-07-24.md)（v0.7.3。setTime/setWeather を全トリガー許容・「設定」/one-shot へ）で追補する。
capability の網羅契約は「ID 登録漏れ＝`JAVA_CAPABILITY_VALIDATORS`／`JAVA_GENERATOR_CAPABILITY_COVERAGE` の `Record<JavaCapabilityId, true>`」と
「生成内容の網羅＝版×capability テスト（`tests/unit/pattern-catalog.test.ts`）」の二本立てが現行の正本であり、
機能設計書に残る `Record<JavaCapabilityId, GeneratorFn>` の完全マップ記述は v0.7.2 修正設計書が supersede する。
