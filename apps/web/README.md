# addon-chat-builder

ChatGPT API と対話しながら、Minecraft Bedrock Edition 用の小さなアドオンを作るローカルWebアプリです。

## 採用方針

- UI は Next.js の単一画面に集約し、会話と現在の仕様を並べて表示します。
- OpenAI API キーはサーバー側の `.env` に置き、ブラウザへ露出させません。
- 対話による仕様整理は通常モデル、アドオンのファイル実装は Codex モデルを使います。
- アドオン実装時の reasoning effort は `low` 固定です。
- Codex が生成したファイルは、許可パスと拡張子を検証してから `.mcpack` 化します。

## 代替案との比較

- Electron や VS Code 拡張は使わず、ローカルWebアプリに留めます。
- ChatGPT のブラウザログイン情報を自動操作せず、OpenAI API を使います。
- 初期版ではDBを持たず、構成を軽くします。

## トレードオフ

- 初期対応はレシピ追加、簡単なアイテム追加、Script API の単純イベント処理に絞っています。
- 複雑なモデル、テクスチャ、リソースパック生成は後から追加する前提です。
- 出力先は画面で変更できますが、PC上の既存フォルダを指定してください。

## セットアップ

```powershell
copy .env.example .env
npm install
npm run dev
```

`API.env` または `.env` の `OPENAI_API_KEY` に、現在のOpenAIアカウントで作成したAPIキーを設定してください。
チャット上に貼ったキーは使わず、OpenAI Platformで無効化してから新しいキーを入れてください。

## ショートカット起動

通常利用は `start.bat` をダブルクリックします。

- `launcher.ps1` が `npm run dev` を起動します。
- 既定ブラウザで `http://127.0.0.1:3031` を開きます。
- 使い終わったらランチャー画面で Enter を押すと、このランチャーが起動したサーバーも停止します。
- 既に `3031` でサーバーが動いていた場合は、ランチャー終了時にその既存サーバーは停止しません。

## 既定ポート

- `http://127.0.0.1:3031`

## 既定出力先

- `D:\my-app2\Minecraft_Addon\mcpackファイル`
