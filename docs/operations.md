# 運用メモ

## 起動

`.NET 8 SDK` が入っている環境で以下を実行する。

```powershell
dotnet run --project src\AddonChatBuilder.Desktop
```

アプリは起動時に `D:\my-app2\Minecraft_Addon\addon-chat-builder-desktop\.env` を読み込み、既存Webアプリの子プロセスへ環境変数として渡す。

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
