# addon-chat-builder-desktop

Minecraft Bedrock アドオン作成支援アプリ `addon-chat-builder` を、家族・別Windowsユーザーが扱いやすい専用デスクトップアプリとして起動するための .NET + WebView2 プロジェクト。

Next.js アプリ本体は `apps/web` で管理し、デスクトップ版は起動・停止・WebView表示・Windows標準UI連携を担当する。

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

ユーザー別設定が旧 `..\addon-chat-builder` を指していても、`apps/web` が実行可能なら起動時に自動で `apps/web` へ移行する。`apps/web` に依存関係が未導入の場合は、移行期間中の互換性として隣接する旧 `..\addon-chat-builder` も探索対象にする。

## Web アプリの依存関係

```powershell
cd apps\web
npm install
npm run lint
npm run build
```

`.env` はGit管理しない。必要なキーは `D:\my-app2\Minecraft_Addon\addon-chat-builder-desktop\.env` に置く。デスクトップアプリ経由では起動時に環境変数として渡し、`apps\web` を直接起動した場合も同じ `.env` を参照する。

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

まずは [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) を仕様書として実装する。
