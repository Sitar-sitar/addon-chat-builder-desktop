# addon-chat-builder

ChatGPT API と対話しながらMinecraft Bedrock Edition用アドオンの仕様を整理・生成し、Minecraft Java Edition用の小さなデータパック／リソースパックも作れるローカルWebアプリです。

## 採用方針

- UI は Next.js の単一画面に集約し、会話と現在の仕様を並べて表示します。
- OpenAI API キーはサーバー側の `.env` に置き、ブラウザへ露出させません。
- 対話による仕様整理は通常モデル、アドオンのファイル実装は Codex モデルを使います。
- アドオン実装時の reasoning effort は `low` 固定です。
- Codex が生成したファイルは、許可パスと拡張子を検証してから `.mcpack` 化します。
- Java版は固定テンプレートで決定論的に生成し、`JAVA_TARGET_VERSION` の対応表にない版は拒否します。

## 代替案との比較

- Electron や VS Code 拡張は使わず、ローカルWebアプリに留めます。
- ChatGPT のブラウザログイン情報を自動操作せず、OpenAI API を使います。
- 初期版ではDBを持たず、構成を軽くします。

## トレードオフ

- Bedrock版はレシピ追加、簡単なアイテム追加、Script API の単純イベント処理に対応します。
- Java版は作業台レシピ、一定間隔のチャット通知、バニラアイテム／ブロックの表示名変更に対応します。Modを必要とする独自アイテム追加には対応しません。
- 出力先は画面で変更できますが、PC上の既存フォルダを指定してください。

## セットアップ

```powershell
copy .env.example .env
npm install
npm run dev
```

`API.env` または `.env` の `OPENAI_API_KEY` に、現在のOpenAIアカウントで作成したAPIキーを設定してください。
チャット上に貼ったキーは使わず、OpenAI Platformで無効化してから新しいキーを入れてください。

Java版の設定例:

```dotenv
DEFAULT_OUTPUT_DIR_JAVA=D:\my-app2\Minecraft_Addon\javaパックファイル
JAVA_TARGET_VERSION=1.21.7
```

対応バージョンは `1.21`、`1.21.4`、`1.21.5`、`1.21.7`。このPCの導入済みJava 1.21.5で確認する場合は `JAVA_TARGET_VERSION=1.21.5` とする。

## ショートカット起動

通常利用は `start.bat` をダブルクリックします。

- `launcher.ps1` が `npm run dev` を起動します。
- 既定ブラウザで `http://127.0.0.1:3031` を開きます。
- 使い終わったらランチャー画面で Enter を押すと、このランチャーが起動したサーバーも停止します。
- 既に `3031` でサーバーが動いていた場合は、ランチャー終了時にその既存サーバーは停止しません。

## 既定ポート

- `http://127.0.0.1:3031`

## 既定出力先

- Bedrock: `D:\my-app2\Minecraft_Addon\mcpackファイル`（`*.mcpack`）
- Javaデータパック／リソースパック: `D:\my-app2\Minecraft_Addon\javaパックファイル`（`*-datapack.zip` / `*-resourcepack.zip`）
