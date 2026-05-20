# 運用メモ

## 起動

このプロジェクトでは、共通方針どおり `C:\Program Files\dotnet\sdk` に入れた .NET SDK を使う。プロジェクト専用の `.dotnet` フォルダは作らない。

一回だけ実行する場合は、プロジェクト直下で以下を実行する。

```powershell
dotnet run --project src\AddonChatBuilder.Desktop
.\dotnet.cmd run --project src\AddonChatBuilder.Desktop
```

`dotnet` が別の SDK を指している場合は、同じ PowerShell セッション内で以下を実行して `C:\Program Files\dotnet` を優先する。

```powershell
. .\scripts\Use-LocalDotNet.ps1
dotnet run --project src\AddonChatBuilder.Desktop
```

`Use-LocalDotNet.ps1` は現在の PowerShell セッションだけに `DOTNET_ROOT` と `PATH` を設定する。Windows全体の環境変数は変更しない。

SDK バージョンは `global.json` で `8.0.421` に固定している。

通常は以下だけで起動できる。

```powershell
dotnet run --project src\AddonChatBuilder.Desktop
```

アプリは起動時に `D:\my-app2\Minecraft_Addon\addon-chat-builder-desktop\.env` を読み込み、Webアプリの子プロセスへ環境変数として渡す。

## Webアプリ

Next.js Webアプリは、このリポジトリ内の `apps\web` で管理する。

初回セットアップまたは依存関係を更新した場合は、以下を実行する。

```powershell
cd D:\my-app2\Minecraft_Addon\addon-chat-builder-desktop\apps\web
npm install
npm run lint
npm run build
```

`.env` は `apps\web` へコピーしない。APIキーなどの値は `D:\my-app2\Minecraft_Addon\addon-chat-builder-desktop\.env` に置く。デスクトップアプリ経由では起動時に環境変数として渡し、`apps\web` を直接起動した場合も同じ `.env` を参照する。

ユーザー別設定が旧 `D:\my-app2\Minecraft_Addon\addon-chat-builder` を指していても、`apps\web\node_modules\next\dist\bin\next` が存在する場合は、起動時に `D:\my-app2\Minecraft_Addon\addon-chat-builder-desktop\apps\web` へ自動移行される。

移行期間中は、`apps\web\node_modules\next\dist\bin\next` が存在しない場合、隣接する旧 `D:\my-app2\Minecraft_Addon\addon-chat-builder` も探索対象になる。

## デスクトップショートカット

各Windowsユーザーは、デスクトップの `Addon Chat Builder` ショートカットから起動する。

通常はパブリック デスクトップに1つ作成する。これにより、同じPCの各ユーザーのデスクトップに共通ショートカットとして表示される。

```powershell
powershell -ExecutionPolicy Bypass -File scripts\Create-PublicShortcut.ps1
```

ユーザーごとのデスクトップへ個別にショートカットを作成する場合は、以下を実行する。

```powershell
powershell -ExecutionPolicy Bypass -File scripts\Create-PublicShortcut.ps1 -Scope AllUsers
```

`-Scope AllUsers` は、各ユーザープロファイルの通常デスクトップに加えて、OneDrive配下の `Desktop` / `デスクトップ` も候補として確認する。

現在ログイン中のユーザーだけへ作成する場合は、以下を実行する。

```powershell
powershell -ExecutionPolicy Bypass -File scripts\Create-PublicShortcut.ps1 -Scope CurrentUser
```

既存ショートカットを上書きする場合は `-Force` を付ける。

## publish

家族や別Windowsユーザーが .NET Runtime を個別に入れなくても起動できるよう、配布用 publish は self-contained 形式で作成する。

```powershell
.\dotnet.cmd publish src\AddonChatBuilder.Desktop\AddonChatBuilder.Desktop.csproj -c Release -r win-x64 --self-contained true -o publish\win-x64
```

既存ショートカットは `publish\win-x64\AddonChatBuilder.Desktop.exe` を参照する。

## 設定

初回起動時に以下へユーザー別設定を作成する。

```text
%LOCALAPPDATA%\AddonChatBuilderDesktop\settings.json
```

出力先フォルダを選択した場合、この設定ファイルへ保存される。

## ログ

ログは以下へ出力する。

```text
%LOCALAPPDATA%\AddonChatBuilderDesktop\logs\
```

APIキーを含む値はログに出さない。
