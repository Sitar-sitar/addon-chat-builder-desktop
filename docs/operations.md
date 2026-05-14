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

アプリは起動時に `D:\my-app2\Minecraft_Addon\addon-chat-builder-desktop\.env` を読み込み、既存Webアプリの子プロセスへ環境変数として渡す。

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
