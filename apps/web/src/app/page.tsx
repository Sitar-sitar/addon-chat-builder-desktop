"use client";

import { FormEvent, useMemo, useState } from "react";
import { AddonSpec, emptySpec, validateSpec } from "@/lib/spec";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type BuildResult = {
  mcpackPath: string;
  files: string[];
};

const defaultOutputDir = "";

const starterPrompts = [
  "新しい武器レシピを作りたい",
  "新しいアイテムを追加したい",
  "特定の行動をしたらチャットに通知したい"
];

export default function Home() {
  const initialMessage = "作りたいアドオンを1文で教えてください。まだ曖昧でも大丈夫です。";
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: initialMessage
    }
  ]);
  const [input, setInput] = useState("");
  const [spec, setSpec] = useState<AddonSpec>(emptySpec);
  const [outputDir, setOutputDir] = useState(defaultOutputDir);
  const [isChatting, setIsChatting] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [isSelectingOutput, setIsSelectingOutput] = useState(false);
  const [showSpec, setShowSpec] = useState(false);
  const [buildResult, setBuildResult] = useState<BuildResult | null>(null);

  const specErrors = useMemo(() => validateSpec(spec), [spec]);
  const canBuild = specErrors.length === 0;
  const hasStarted = messages.some((message) => message.role === "user");

  async function sendText(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isChatting) return;

    const nextMessages: Message[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setBuildResult(null);
    setIsChatting(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages,
          currentSpec: spec
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "AI応答の取得に失敗しました。");

      setSpec(data.spec);
      setMessages([...nextMessages, { role: "assistant", content: data.assistantMessage }]);
      setShowSpec(data.spec.unresolvedQuestions.length === 0);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "AI応答の取得に失敗しました。";
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: `エラーが発生しました。\n${message}`
        }
      ]);
    } finally {
      setIsChatting(false);
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendText(input);
  }

  async function buildPack() {
    setBuildResult(null);
    setIsBuilding(true);

    try {
      const response = await fetch("/api/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spec, outputDir })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "mcpack生成に失敗しました。");
      setBuildResult(data);
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: `.mcpackを生成しました。\n${data.mcpackPath}`
        }
      ]);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "mcpack生成に失敗しました。";
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: `生成に失敗しました。\n${message}`
        }
      ]);
    } finally {
      setIsBuilding(false);
    }
  }

  async function selectOutputDir() {
    setIsSelectingOutput(true);

    try {
      const response = await fetch("/api/select-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPath: outputDir })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "フォルダ選択に失敗しました。");
      if (!data.canceled && data.path) {
        setOutputDir(data.path);
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "フォルダ選択に失敗しました。";
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: `フォルダ選択に失敗しました。\n${message}`
        }
      ]);
    } finally {
      setIsSelectingOutput(false);
    }
  }

  function resetAll() {
    setMessages([{ role: "assistant", content: initialMessage }]);
    setInput("");
    setSpec(emptySpec);
    setOutputDir(defaultOutputDir);
    setBuildResult(null);
    setShowSpec(false);
  }

  return (
    <main className="app-shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">Minecraft Bedrock</p>
          <h1>Addon Chat Builder</h1>
        </div>
        <button className="secondary-button" type="button" onClick={resetAll}>
          リセット
        </button>
      </section>

      <section className="focus-layout">
        <div className="chat-card">
          <div className="chat-hero">
            <p className="eyebrow">Start Here</p>
            <h2>どんなアドオンを作りたいですか？</h2>
            <p>まずは一文で入力してください。足りない情報はAIが順番に聞きます。</p>
          </div>

          {!hasStarted && (
            <div className="starter-grid" aria-label="作成例">
              {starterPrompts.map((prompt) => (
                <button
                  className="starter-button"
                  type="button"
                  key={prompt}
                  onClick={() => sendText(prompt)}
                  disabled={isChatting}
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          <div className="message-list">
            {messages.map((message, index) => (
              <div className={`message ${message.role}`} key={`${message.role}-${index}`}>
                <span>{message.role === "user" ? "ユーザー" : "AI"}</span>
                <p>{message.content}</p>
              </div>
            ))}
            {isChatting && (
              <div className="message assistant">
                <span>AI</span>
                <p>作成内容を整理しています...</p>
              </div>
            )}
          </div>

          <form className="chat-form" onSubmit={sendMessage}>
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="例: 鉄インゴットと棒で、雷を出せる槍を作りたい"
              rows={3}
            />
            <button className="primary-button" type="submit" disabled={isChatting || !input.trim()}>
              送信
            </button>
          </form>
        </div>

        <section className="progress-panel" aria-label="作成状況">
          <div>
            <p className="eyebrow">Progress</p>
            <h2>{spec.title || "まだ作成内容は未確定です"}</h2>
            <p>{spec.description || "チャットに入力すると、ここに整理状況が表示されます。"}</p>
          </div>
          <div className="progress-actions">
            <span className="kind-badge">{spec.kind}</span>
            <button className="secondary-button" type="button" onClick={() => setShowSpec((value) => !value)}>
              {showSpec ? "仕様を閉じる" : "作成内容を確認"}
            </button>
          </div>
        </section>

        {showSpec && (
          <section className="spec-panel" aria-label="現在の仕様">
            <SpecSummary spec={spec} />

            <div className="questions">
              <h3>次に決めること</h3>
              {spec.unresolvedQuestions.length > 0 ? (
                <ul>
                  {spec.unresolvedQuestions.map((question) => (
                    <li key={question}>{question}</li>
                  ))}
                </ul>
              ) : (
                <p>必要な情報はそろっています。</p>
              )}
            </div>

            <div className="output-box">
              <label htmlFor="outputDir">出力先フォルダ</label>
              <input
                id="outputDir"
                value={outputDir}
                onChange={(event) => setOutputDir(event.target.value)}
              />
              <div className="output-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={selectOutputDir}
                  disabled={isSelectingOutput}
                >
                  {isSelectingOutput ? "選択中..." : "フォルダを選択"}
                </button>
                <button className="secondary-button" type="button" onClick={() => setOutputDir(defaultOutputDir)}>
                  既定に戻す
                </button>
              </div>
            </div>

            {specErrors.length > 0 && (
              <div className="warning-box">
                {specErrors.map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </div>
            )}

            <button
              className="primary-button wide"
              type="button"
              onClick={buildPack}
              disabled={isBuilding || !canBuild}
            >
              {isBuilding ? "生成中..." : ".mcpackを生成"}
            </button>

            {buildResult && (
              <div className="result-box">
                <h3>生成完了</h3>
                <p>{buildResult.mcpackPath}</p>
                <ul>
                  {buildResult.files.map((file) => (
                    <li key={file}>{file}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
      </section>
    </main>
  );
}

function SpecSummary({ spec }: { spec: AddonSpec }) {
  return (
    <div className="spec-summary">
      <div>
        <p className="eyebrow">Current Spec</p>
        <h2>{spec.title || "未設定"}</h2>
      </div>
      <dl className="spec-list">
        <div>
          <dt>説明</dt>
          <dd>{spec.description || "未設定"}</dd>
        </div>
        <div>
          <dt>namespace</dt>
          <dd>{spec.namespace}</dd>
        </div>
        <div>
          <dt>出力名</dt>
          <dd>{spec.outputName}</dd>
        </div>
      </dl>
      <SpecDetails spec={spec} />
    </div>
  );
}

function SpecDetails({ spec }: { spec: AddonSpec }) {
  if (spec.kind === "recipe" && spec.recipe) {
    return (
      <div className="detail-box">
        <h3>レシピ</h3>
        <p>
          完成: {spec.recipe.resultItem} x {spec.recipe.resultCount}
        </p>
        <p>形: {spec.recipe.pattern.join(" / ")}</p>
      </div>
    );
  }

  if (spec.kind === "item" && spec.item) {
    return (
      <div className="detail-box">
        <h3>アイテム</h3>
        <p>ID: {spec.item.identifier}</p>
        <p>表示名: {spec.item.displayName}</p>
        <p>最大スタック: {spec.item.maxStackSize}</p>
      </div>
    );
  }

  if (spec.kind === "script" && spec.script) {
    return (
      <div className="detail-box">
        <h3>Script API</h3>
        <p>イベント: {spec.script.event}</p>
        <p>{spec.script.summary}</p>
      </div>
    );
  }

  return (
    <div className="detail-box">
      <h3>詳細</h3>
      <p>会話を進めると、ここに生成内容が表示されます。</p>
    </div>
  );
}
