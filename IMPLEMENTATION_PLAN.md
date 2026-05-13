# Addon Chat Builder Desktop 実装仕様書

## 1. 目的

`addon-chat-builder-desktop` は、既存の `Minecraft_Addon/addon-chat-builder/` を家族や別Windowsユーザーが迷わず使えるようにする専用デスクトップアプリである。

既存のWebアプリはそのまま維持し、デスクトップアプリ側は以下を担当する。

- アプリ起動時にWebアプリを非表示で起動する
- WebView2でWebアプリ画面を表示する
- アプリ画面を閉じたらWebアプリのサーバーを停止する
- 5分間操作がなければWebアプリのサーバーを停止する
- 停止後にユーザーが操作しようとしたら自動で再起動する
- Windows標準のフォルダ選択画面を提供する
- ターミナルや開発サーバーの存在を一般ユーザーに見せない

この仕様書は、新規プロジェクトとして .NET + WebView2 アプリを実装するための実装単位まで記述する。

## 2. 前提

### 2.1 既存Webアプリ

- 既存プロジェクト: `D:\my-app2\Minecraft_Addon\addon-chat-builder`
- 技術: Next.js 16 + TypeScript
- 既定ポート: `3031`
- 起動対象: `node_modules\next\dist\bin\next`
- APIキー設定: 既存Webアプリの `.env`
- 既定出力先: `D:\my-app2\Minecraft_Addon\mcpackファイル`

### 2.2 デスクトップアプリ

- 新規プロジェクト: `D:\my-app2\Minecraft_Addon\addon-chat-builder-desktop`
- 技術: .NET 8 または .NET 9 + WPF + WebView2
- 対象OS: Windows
- 主利用者: 家族など、開発者ではない別Windowsユーザー
- UI方針: 普通のWindowsアプリとして見えること
- ターミナル表示: しない

### 2.3 別Windowsユーザー利用の扱い

別ユーザーで使う場合、以下を前提とする。

- 各Windowsユーザーが自分のログインセッションでアプリを起動する
- APIキーは当面、既存Webアプリの `.env` を共有する
- 将来、ユーザー別APIキーが必要になったら、デスクトップアプリ側のユーザー別設定へ移行する
- 複数ユーザーが同時ログインで同時起動する可能性は低いが、ポート競合時の扱いを実装する

## 3. 採用方針

### 3.1 採用技術

WPF + WebView2 を採用する。

理由:

- Windows標準アプリに近い操作感にできる
- ウィンドウの終了イベントを確実に扱いやすい
- Windows標準フォルダ選択ダイアログを自然に使える
- Node / Next.js の子プロセスをアプリ側で管理できる
- Electronより軽く、Windows専用運用に向いている

### 3.2 既存Webアプリを残す理由

既存の `addon-chat-builder` はそのまま利用する。

理由:

- すでにチャットUI、OpenAI API連携、`.mcpack`生成が実装済み
- UI改善をWeb側で続けられる
- デスクトップ側は起動管理とOS連携に責務を絞れる
- 既存資産を捨てず、段階的に移行できる

### 3.3 専用アプリ側でやらないこと

初期版では以下を行わない。

- OpenAI API呼び出しをC#へ移す
- Minecraftアドオン生成ロジックをC#へ移す
- Web UIをWPFネイティブUIへ作り直す
- インストーラーや自動更新を作る
- Windowsサービス化する
- 常駐タスク化する

## 4. 全体構成

```text
addon-chat-builder-desktop/
├── AddonChatBuilder.Desktop.sln
├── src/
│   └── AddonChatBuilder.Desktop/
│       ├── App.xaml
│       ├── App.xaml.cs
│       ├── MainWindow.xaml
│       ├── MainWindow.xaml.cs
│       ├── Services/
│       │   ├── WebAppProcessService.cs
│       │   ├── PortService.cs
│       │   ├── ActivityMonitorService.cs
│       │   ├── FolderDialogService.cs
│       │   └── AppSettingsService.cs
│       ├── Models/
│       │   ├── DesktopAppSettings.cs
│       │   ├── WebAppStatus.cs
│       │   └── ServerState.cs
│       └── appsettings.json
├── docs/
│   └── operations.md
├── .gitignore
├── README.md
└── IMPLEMENTATION_PLAN.md
```

## 5. 実行時構成

```text
User
  ↓ 起動
.NET WPF Desktop App
  ├─ WebAppProcessService
  │   └─ node.exe next dev/start --hostname 127.0.0.1 --port <selectedPort>
  ├─ WebView2
  │   └─ http://127.0.0.1:<selectedPort>
  ├─ ActivityMonitorService
  │   ├─ 画面操作検知
  │   ├─ 5分無操作判定
  │   └─ WebApp停止/再起動
  └─ FolderDialogService
      └─ Windows標準フォルダ選択
```

## 6. ポート設計

### 6.1 基本

既定ポートは既存Webアプリと同じ `3031` とする。

ただし、別ユーザーや別プロセスで `3031` が使用中の場合に備え、デスクトップアプリ側で起動前にポートを確認する。

### 6.2 ポート選択ルール

1. `3031` が空いていれば `3031` を使う
2. `3031` が使用中で、そのプロセスが自分の起動したWebアプリであれば再利用する
3. `3031` が使用中で別プロセスなら `3032` から `3040` まで順に空きを探す
4. 空きがなければ、ユーザー向けエラーを表示して起動を中断する

### 6.3 Webアプリ側へのポート反映

Webアプリ起動時は、Next.jsへ明示的にポートを渡す。

```text
node.exe node_modules\next\dist\bin\next dev --hostname 127.0.0.1 --port <selectedPort>
```

本番ビルド後に `next start` 運用へ移行する場合も、同じく `--port <selectedPort>` を渡す。

## 7. 起動仕様

### 7.1 アプリ起動時

1. 設定を読み込む
2. 既存Webアプリのパスを検証する
3. `node.exe` のパスを検出する
4. 使用ポートを決定する
5. Webアプリを非表示プロセスとして起動する
6. `/api/health` が成功するまで待機する
7. WebView2でURLを開く
8. 状態表示を「準備できました」にする

### 7.2 起動中表示

WebView2のロード前に、WPF側で以下の簡易表示を出す。

```text
Addon Chat Builder を起動しています...
```

起動に失敗した場合:

```text
起動できませんでした
Node.js または addon-chat-builder の構成を確認してください。
[再試行] [ログを開く]
```

### 7.3 起動タイムアウト

Webアプリの起動待ちは最大45秒。

タイムアウト時はWebアプリプロセスを停止し、エラーを表示する。

## 8. 停止仕様

### 8.1 ウィンドウを閉じた場合

WPFの `Window.Closing` / `Window.Closed` で以下を行う。

1. 自分が起動したWebアプリプロセスを停止する
2. 子プロセスが残っていれば終了する
3. 最大5秒待つ
4. 残っている場合のみ強制終了する

既に起動していた外部プロセスは停止しない。

### 8.2 5分無操作停止

`ActivityMonitorService` が最後の操作時刻を保持する。

操作とみなすイベント:

- WPFウィンドウのマウス操作
- キーボード操作
- WebView2のナビゲーション
- WebView2から送られる操作通知
- Webアプリ内のチャット送信
- `.mcpack`生成
- フォルダ選択

最後の操作から5分経過した場合:

1. Webアプリプロセスを停止する
2. WebView2には停止中画面を表示する
3. 状態を `StoppedByIdle` にする

表示文言:

```text
しばらく操作がなかったため、アプリの処理を一時停止しました。
入力またはクリックすると再開します。
```

### 8.3 停止対象

停止してよいのは、デスクトップアプリ自身が起動したWebアプリプロセスのみ。

以下は停止しない。

- 他ユーザーが起動したプロセス
- 既に起動していた `3031` のプロセス
- Codexや他アプリのNode.jsプロセス

## 9. 再起動仕様

### 9.1 停止中にユーザーが操作した場合

停止中画面で以下の操作を検知したら再起動する。

- 画面クリック
- キー入力
- 「再開」ボタン押下

再起動中表示:

```text
アプリを再開しています...
```

再起動完了後:

```text
準備できました。続けて入力できます。
```

### 9.2 WebView2表示

再起動後、WebView2で同じURLを再読み込みする。

初期版では、停止前の未送信入力内容は保持しない。

将来対応:

- WebView2側の入力内容を停止前に保存
- 再起動後に復元

## 10. Webアプリ側に必要な追加API

既存 `addon-chat-builder` 側には最小限のAPIだけ追加する。

### 10.1 `GET /api/health`

用途:

- DesktopアプリがWebアプリの起動完了を判定する

レスポンス:

```json
{
  "ok": true,
  "app": "addon-chat-builder",
  "timestamp": "2026-05-14T00:00:00.000Z"
}
```

### 10.2 `POST /api/desktop/activity`

用途:

- Webアプリ内の操作をDesktopアプリへ通知する

初期版では必須ではない。WPF側の入力イベントだけで5分停止を実装し、必要になったら追加する。

### 10.3 `POST /api/desktop/select-folder`

初期版ではDesktop側のWebView2メッセージ機能で置き換える。

既存Webアプリの `api/select-folder` は残してよいが、Desktop版では .NET 側のフォルダ選択を優先する。

## 11. WebView2 と Webアプリの連携

### 11.1 フォルダ選択

Webアプリ側で「フォルダを選択」ボタンを押したとき、Desktop版ではWebView2のメッセージを使って .NET 側へ依頼する。

想定メッセージ:

```json
{
  "type": "selectOutputFolder",
  "currentPath": "D:\\my-app2\\Minecraft_Addon\\mcpackファイル"
}
```

.NET側は `FolderBrowserDialog` または `CommonOpenFileDialog` 相当でフォルダ選択を開き、選択結果をWebView2へ返す。

返却メッセージ:

```json
{
  "type": "outputFolderSelected",
  "path": "D:\\my-app2\\Minecraft_Addon\\mcpackファイル"
}
```

### 11.2 状態通知

Desktop側からWebViewへ以下の状態を通知できるようにする。

```json
{
  "type": "desktopServerState",
  "state": "starting | running | stopped | restarting | error",
  "message": "表示用メッセージ"
}
```

初期版ではWPF側のオーバーレイ表示だけでもよい。

## 12. 設定管理

### 12.1 設定ファイル

Desktopアプリ側の設定は、Windowsユーザー別のAppDataへ保存する。

```text
%APPDATA%\AddonChatBuilderDesktop\settings.json
```

初期設定:

```json
{
  "webAppPath": "D:\\my-app2\\Minecraft_Addon\\addon-chat-builder",
  "preferredPort": 3031,
  "idleStopMinutes": 5,
  "defaultOutputDir": "D:\\my-app2\\Minecraft_Addon\\mcpackファイル",
  "nodePath": "C:\\Program Files\\nodejs\\node.exe"
}
```

### 12.2 APIキー

初期版:

- 既存Webアプリの `.env` を使う
- Desktopアプリ側ではAPIキーを扱わない

将来版:

- Desktopアプリの設定画面でAPIキーを登録
- Windows Credential Managerへ保存
- 起動時にWebアプリへ環境変数として渡す

### 12.3 出力先

出力先はユーザー別設定に保存する。

家族ごとに出力先を変えられるようにする。

## 13. ログ設計

### 13.1 保存先

```text
%APPDATA%\AddonChatBuilderDesktop\logs\
```

### 13.2 ログファイル

```text
desktop-yyyy-MM-dd.log
webapp-yyyy-MM-dd.log
```

### 13.3 ログ内容

記録する:

- アプリ起動
- Webアプリ起動コマンド
- 選択ポート
- 起動成功/失敗
- 停止理由
- 5分無操作停止
- 再起動
- フォルダ選択結果
- 例外メッセージ

記録しない:

- APIキー
- チャット本文
- 生成されたアドオン本文
- 個人情報

## 14. エラー表示方針

一般ユーザー向けの短い表示にする。

### 14.1 Node.js未検出

```text
必要な部品が見つかりません。
Node.js がインストールされているか確認してください。
```

### 14.2 Webアプリ未検出

```text
アプリ本体が見つかりません。
addon-chat-builder フォルダの場所を確認してください。
```

### 14.3 ポート競合

```text
起動に必要な空き番号が見つかりません。
他のアプリを閉じてから、もう一度起動してください。
```

### 14.4 OpenAI APIエラー

Webアプリ側に表示させる。

Desktopアプリ側では通信内容に踏み込まない。

## 15. セキュリティ方針

- WebView2は `http://127.0.0.1:<port>` のみ開く
- 外部URLへのナビゲーションは既定ブラウザで開くか、ブロックする
- Desktop側のメッセージ受信は許可した `type` のみ処理する
- 任意コマンド実行は実装しない
- 停止対象プロセスは自分が起動したプロセスIDだけに限定する
- APIキーはログへ出さない

## 16. 実装ステップ

### Step 1: .NETプロジェクト作成

```powershell
cd D:\my-app2\Minecraft_Addon\addon-chat-builder-desktop
dotnet new sln -n AddonChatBuilder.Desktop
dotnet new wpf -n AddonChatBuilder.Desktop -o src\AddonChatBuilder.Desktop
dotnet sln add src\AddonChatBuilder.Desktop\AddonChatBuilder.Desktop.csproj
```

追加パッケージ:

```powershell
dotnet add src\AddonChatBuilder.Desktop package Microsoft.Web.WebView2
```

### Step 2: MainWindow作成

初期画面:

- 起動中オーバーレイ
- WebView2
- エラー表示パネル

### Step 3: WebAppProcessService作成

責務:

- Node.jsパス確認
- Next.jsコマンド確認
- プロセス起動
- `/api/health` 待機
- プロセス停止
- プロセス状態確認

主要メソッド:

```csharp
Task StartAsync(int port, CancellationToken cancellationToken);
Task StopAsync();
bool IsRunning { get; }
int? ProcessId { get; }
```

### Step 4: PortService作成

責務:

- `3031` から `3040` の空き確認
- 使用中ポートの判定

主要メソッド:

```csharp
int FindAvailablePort(int preferredPort, int maxPort);
bool IsPortAvailable(int port);
```

### Step 5: ActivityMonitorService作成

責務:

- 最終操作時刻の保持
- 5分無操作判定
- 停止要求イベント発火

主要メソッド:

```csharp
void MarkActivity();
void Start();
void Stop();
event EventHandler IdleTimeoutReached;
```

### Step 6: WebView2表示

- 起動完了後に `webView.Source = new Uri(url)`
- WebView2の `NavigationStarting` で外部URLを制御
- `CoreWebView2.WebMessageReceived` でWeb側からの依頼を受信

### Step 7: フォルダ選択

WPF側で `FolderBrowserDialog` を開く。

WebView2へ選択結果を返す。

### Step 8: 停止・再起動

- Window closing: `WebAppProcessService.StopAsync()`
- Idle timeout: Webアプリ停止 + 停止中画面表示
- 停止中画面クリック: Webアプリ再起動

### Step 9: ログ実装

標準ライブラリで日付別ログを出す。

外部ログライブラリは初期版では入れない。

### Step 10: 動作確認

確認項目:

- 起動するとWebViewに画面が出る
- ウィンドウを閉じるとNodeプロセスが残らない
- 5分無操作で停止する
- 停止後クリックで再起動する
- 出力先フォルダ選択がWindows標準ダイアログで開く
- 別ユーザーで起動しても設定がユーザー別に保存される
- APIキーがログへ出ない

## 17. 既存Webアプリ側の最小変更案

Desktop版実装時に、既存 `addon-chat-builder` へ以下だけ追加する。

1. `GET /api/health`
2. WebView2メッセージ対応用の小さなフック
3. Desktop環境では `api/select-folder` よりWebView2メッセージを優先

ただし、現行ブラウザ版の利用を壊さないこと。

## 18. 完了条件

初期版は以下を満たせば完了。

- `AddonChatBuilder.Desktop.exe` を起動すると画面が表示される
- ターミナルが表示されない
- WebアプリがWebView2内に表示される
- ウィンドウ終了で自分が起動したWebアプリプロセスが停止する
- 5分無操作でWebアプリプロセスが停止する
- 停止後のクリックでWebアプリが再起動する
- フォルダ選択がWindows標準ダイアログで動く
- ログがAppDataに出る
- APIキーがログやGitに入らない

## 19. 将来拡張

- アプリ内設定画面
- ユーザー別APIキー管理
- Windows Credential Manager保存
- リリース用publishスクリプト
- デスクトップショートカット作成スクリプト
- 自動アップデート
- 生成履歴
- `.mcpack` をMinecraftへ直接インポートする補助

## 20. 判断メモ

家族が別Windowsユーザーで使う前提では、ブラウザ版のまま起動停止を完全に制御するより、.NET + WebView2でアプリのライフサイクルに閉じ込めるほうが安全で分かりやすい。

一方で、Webアプリ本体のUIや生成ロジックはすでにNext.js側へ存在するため、初期版では作り直さず、デスクトップアプリは薄いラッパーとして始める。

これにより、利用者には「普通のWindowsアプリ」、保守者には「既存Webアプリ + 小さな起動管理アプリ」という見通しのよい構成になる。

