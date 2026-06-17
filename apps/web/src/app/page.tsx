"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  IconCheck,
  IconHeart,
  IconLock,
  IconPencil,
  IconPlayerPlay,
  IconRefresh
} from "@tabler/icons-react";
import { AddonSpec, emptySpec, validateSpec } from "@/lib/spec";
import { blueprintRows, stepState, type StepStatus } from "@/utils/addon-view";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type BuildResult = {
  mcpackPath: string;
  files: string[];
};

const starterPrompts = ["雷を出せる槍を作りたい", "新しいアイテムを追加したい", "特定の行動をしたらチャットに通知したい"];

const initialMessage = "作りたいアドオンを1文で教えてください。まだ曖昧でも大丈夫です。";

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", content: initialMessage }]);
  const [input, setInput] = useState("");
  const [spec, setSpec] = useState<AddonSpec>(emptySpec);
  const [outputDir, setOutputDir] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [isSelectingOutput, setIsSelectingOutput] = useState(false);
  const [buildResult, setBuildResult] = useState<BuildResult | null>(null);
  const [suggestedReplies, setSuggestedReplies] = useState<string[]>([]);
  const [recommendedReply, setRecommendedReply] = useState("");

  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const specErrors = useMemo(() => validateSpec(spec), [spec]);
  const canBuild = specErrors.length === 0;
  const hasStarted = messages.some((message) => message.role === "user");
  const step = stepState({ hasStarted, canBuild, built: !!buildResult });
  const rows = useMemo(() => blueprintRows(spec), [spec]);
  const remaining = rows.filter((row) => row.status === "current" || row.status === "pending").length;

  const lastIsAssistant = messages[messages.length - 1]?.role === "assistant";
  const showReadyCta = canBuild && !isChatting && !buildResult;
  const showChips = !showReadyCta && !isChatting && suggestedReplies.length > 0 && lastIsAssistant;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, isChatting]);

  async function sendText(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isChatting) return;

    const nextMessages: Message[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setBuildResult(null);
    setSuggestedReplies([]);
    setRecommendedReply("");
    setIsChatting(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages, currentSpec: spec })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "AI応答の取得に失敗しました。");

      setSpec(data.spec);
      setMessages([...nextMessages, { role: "assistant", content: data.assistantMessage }]);
      setSuggestedReplies(data.suggestedReplies ?? []);
      setRecommendedReply(data.recommendedReply ?? "");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "AI応答の取得に失敗しました。";
      setMessages([...nextMessages, { role: "assistant", content: `エラーが発生しました。\n${message}` }]);
    } finally {
      setIsChatting(false);
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendText(input);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void sendText(input);
    }
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
        { role: "assistant", content: `完成！ .mcpackを生成しました。\n${data.mcpackPath}` }
      ]);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "mcpack生成に失敗しました。";
      setMessages((current) => [...current, { role: "assistant", content: `生成に失敗しました。\n${message}` }]);
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
      setMessages((current) => [...current, { role: "assistant", content: `フォルダ選択に失敗しました。\n${message}` }]);
    } finally {
      setIsSelectingOutput(false);
    }
  }

  function resetAll() {
    setMessages([{ role: "assistant", content: initialMessage }]);
    setInput("");
    setSpec(emptySpec);
    setOutputDir("");
    setBuildResult(null);
    setSuggestedReplies([]);
    setRecommendedReply("");
  }

  return (
    <main className="app-shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">MINECRAFT BEDROCK</p>
          <h1>ADDON CHAT BUILDER</h1>
        </div>
        <div className="topbar-right">
          <span className="hearts" aria-hidden="true">
            <IconHeart size={20} />
            <IconHeart size={20} />
            <IconHeart size={20} />
          </span>
          <button className="btn" type="button" onClick={resetAll}>
            リセット
          </button>
        </div>
      </section>

      <Stepper step={step} />

      <section className="focus-layout">
        <div className="card chat-card">
          {!hasStarted && (
            <div className="chat-hero">
              <p className="kicker">START HERE</p>
              <h2>どんなアドオンを作りたいですか？</h2>
              <p>まずは一文で。足りない情報はAIが順番に聞きます。</p>
              <div className="starter-grid" aria-label="作成例">
                {starterPrompts.map((prompt) => (
                  <button
                    className="btn starter-button"
                    type="button"
                    key={prompt}
                    onClick={() => sendText(prompt)}
                    disabled={isChatting}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="message-list" role="log" aria-live="polite" aria-atomic="false">
            {messages.map((message, index) => (
              <div className={`message ${message.role}`} key={`${message.role}-${index}`}>
                <span>{message.role === "user" ? "ユーザー" : "AI"}</span>
                <p>{message.content}</p>
              </div>
            ))}
            {isChatting && (
              <div className="message assistant typing">
                <span>AI</span>
                <p>作成内容を整理しています...</p>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {showChips && (
            <div className="chips" aria-label="返信候補">
              {suggestedReplies.map((reply) => (
                <button
                  className={`chip ${reply === recommendedReply ? "rec" : ""}`}
                  type="button"
                  key={reply}
                  onClick={() => sendText(reply)}
                  disabled={isChatting}
                >
                  {reply}
                </button>
              ))}
            </div>
          )}

          {showReadyCta && (
            <div className="ready-cta">
              <p>準備OK！ この内容で作れます。</p>
              <div className="ready-actions">
                <button className="btn pri" type="button" onClick={buildPack} disabled={isBuilding}>
                  <IconPlayerPlay size={18} aria-hidden="true" />
                  {isBuilding ? "生成中..." : ".mcpack を生成"}
                </button>
                <button className="btn" type="button" onClick={() => inputRef.current?.focus()}>
                  内容を直す
                </button>
              </div>
            </div>
          )}

          <form className="chat-form" onSubmit={sendMessage}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="例: 鉄インゴットと棒で、雷を出せる槍を作りたい（Enterで送信 / Shift+Enterで改行）"
              rows={3}
            />
            <button className="btn pri" type="submit" disabled={isChatting || !input.trim()}>
              送信
            </button>
          </form>
        </div>

        <section className="card blueprint" aria-label="設計図">
          <p className="kicker">BLUEPRINT / 設計図</p>
          <h2>{spec.title || "まだ作成内容は未確定です"}</h2>

          {rows.map((row) => (
            <div className={`bp-row ${row.status}`} key={row.label}>
              <span className="bl">{row.label}</span>
              <span className="bv">{row.value}</span>
              {row.status === "done" && <IconCheck className="bs ok" size={18} aria-hidden="true" />}
              {row.status === "current" && <IconPencil className="bs cur" size={18} aria-hidden="true" />}
            </div>
          ))}

          <p className="bp-note">
            <IconCheck size={18} aria-hidden="true" />
            {remaining > 0 ? `あと${remaining}個できまる` : "準備OK！"}
          </p>

          {canBuild && (
            <div className="output-box">
              <label htmlFor="outputDir">出力先フォルダ</label>
              <input id="outputDir" value={outputDir} onChange={(event) => setOutputDir(event.target.value)} />
              <div className="output-actions">
                <button className="btn" type="button" onClick={selectOutputDir} disabled={isSelectingOutput}>
                  {isSelectingOutput ? "選択中..." : "フォルダを選択"}
                </button>
                <button className="btn" type="button" onClick={() => setOutputDir("")}>
                  既定に戻す
                </button>
              </div>
              <button className="btn pri wide" type="button" onClick={buildPack} disabled={isBuilding}>
                <IconPlayerPlay size={18} aria-hidden="true" />
                {isBuilding ? "生成中..." : ".mcpack を生成"}
              </button>
            </div>
          )}

          {buildResult && (
            <div className="result-box">
              <h3>生成完了</h3>
              <p>{buildResult.mcpackPath}</p>
              <ul>
                {buildResult.files.map((file) => (
                  <li key={file}>{file}</li>
                ))}
              </ul>
              <button className="btn" type="button" onClick={resetAll}>
                <IconRefresh size={18} aria-hidden="true" />
                続けて作る
              </button>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function Stepper({ step }: { step: { kind: StepStatus; detail: StepStatus; build: StepStatus } }) {
  return (
    <div className="stepper">
      <Step n="01" label="種類" status={step.kind} />
      <Step n="02" label="詳細" status={step.detail} />
      <Step n="03" label="生成" status={step.build} />
    </div>
  );
}

function Step({ n, label, status }: { n: string; label: string; status: StepStatus }) {
  const Icon = status === "done" ? IconCheck : status === "current" ? IconPencil : IconLock;
  return (
    <div className={`step ${status}`}>
      <span className="sn">{n}</span>
      <span className="sl">{label}</span>
      <Icon className="si" size={18} aria-hidden="true" />
    </div>
  );
}
