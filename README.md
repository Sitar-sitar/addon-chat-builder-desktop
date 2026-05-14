# addon-chat-builder-desktop

Minecraft Bedrock アドオン作成支援アプリ `addon-chat-builder` を、家族・別Windowsユーザーが扱いやすい専用デスクトップアプリとして起動するための .NET + WebView2 プロジェクト。

現行の Next.js アプリ本体は変更せず、デスクトップ版は起動・停止・WebView表示・Windows標準UI連携を担当する。

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
