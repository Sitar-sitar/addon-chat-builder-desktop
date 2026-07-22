"use client";

import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  IconCheck,
  IconHeart,
  IconLock,
  IconPencil,
  IconPlayerPlay,
  IconRefresh,
} from "@tabler/icons-react";
import {
  AddonSpec,
  createEmptySpec,
  type Edition,
  validateSpec,
} from "@/lib/spec";
import { blueprintRows, stepState, type StepStatus } from "@/utils/addon-view";
import {
  starterPromptsForCapabilities,
  type JavaCapabilityId,
} from "@/lib/pattern-catalog";
import type { JavaVersionRule } from "@/lib/pack-rules";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type BuildResult = {
  packPath: string;
  files: string[];
  description: string;
};

const bedrockStarterPrompts = [
  "雷を出せる槍を作りたい",
  "新しいアイテムを追加したい",
  "特定の行動をしたらチャットに通知したい",
];

function initialMessage(edition: Edition): string {
  return edition === "java"
    ? "Java版で作りたいデータパックやリソースパックを1文で教えてください。"
    : "作りたいアドオンを1文で教えてください。まだ曖昧でも大丈夫です。";
}

export default function Home() {
  const [edition, setEdition] = useState<Edition>("bedrock");
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: initialMessage("bedrock") },
  ]);
  const [input, setInput] = useState("");
  const [spec, setSpec] = useState<AddonSpec>(() => createEmptySpec("bedrock"));
  const [outputDir, setOutputDir] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [isSelectingOutput, setIsSelectingOutput] = useState(false);
  const [buildResult, setBuildResult] = useState<BuildResult | null>(null);
  const [suggestedReplies, setSuggestedReplies] = useState<string[]>([]);
  const [recommendedReply, setRecommendedReply] = useState("");
  const [javaTargetVersion, setJavaTargetVersion] = useState("");
  const [javaCapabilities, setJavaCapabilities] = useState<JavaCapabilityId[]>(
    [],
  );
  const [javaVersionRule, setJavaVersionRule] = useState<JavaVersionRule>();
  const [configError, setConfigError] = useState("");

  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const generationRef = useRef(0);

  const specErrors = useMemo(
    () => validateSpec(spec, javaCapabilities, javaVersionRule),
    [spec, javaCapabilities, javaVersionRule],
  );
  const javaGateOpen =
    spec.edition !== "java" ||
    (!!javaTargetVersion &&
      !!javaVersionRule &&
      spec.unresolvedQuestions.length === 0 &&
      spec.unsupportedRequests.length === 0);
  const canBuild = specErrors.length === 0 && javaGateOpen;
  const hasStarted = messages.some((message) => message.role === "user");
  const step = stepState({ hasStarted, canBuild, built: !!buildResult });
  const rows = useMemo(
    () =>
      blueprintRows(spec, javaTargetVersion, javaCapabilities, javaVersionRule),
    [spec, javaTargetVersion, javaCapabilities, javaVersionRule],
  );
  const starterPrompts = useMemo(
    () =>
      edition === "java"
        ? starterPromptsForCapabilities(javaCapabilities)
        : bedrockStarterPrompts,
    [edition, javaCapabilities],
  );
  const remaining = rows.filter(
    (row) => row.status === "current" || row.status === "pending",
  ).length;
  const isBusy = isChatting || isBuilding || isSelectingOutput;

  const lastIsAssistant = messages[messages.length - 1]?.role === "assistant";
  const showReadyCta = canBuild && !isChatting && !buildResult;
  const showChips =
    !showReadyCta &&
    !isChatting &&
    suggestedReplies.length > 0 &&
    lastIsAssistant;
  const buildLabel = getBuildLabel(spec);

  useEffect(() => {
    let active = true;
    void fetch("/api/config")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error ?? "Java版設定の取得に失敗しました。");
        if (active) {
          setJavaTargetVersion(data.javaTargetVersion);
          setJavaCapabilities(data.javaCapabilities ?? []);
          setJavaVersionRule(data.javaVersionRule);
        }
      })
      .catch((caught) => {
        if (!active) return;
        const message =
          caught instanceof Error
            ? caught.message
            : "Java版設定の取得に失敗しました。";
        setConfigError(message);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, isChatting]);

  async function sendText(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isChatting) return;

    const generation = generationRef.current;
    const requestEdition = edition;
    const nextMessages: Message[] = [
      ...messages,
      { role: "user", content: trimmed },
    ];
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
        body: JSON.stringify({
          messages: nextMessages,
          currentSpec: spec,
          edition: requestEdition,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? "AI応答の取得に失敗しました。");
      if (generation !== generationRef.current) return;

      setSpec(data.spec);
      setMessages([
        ...nextMessages,
        { role: "assistant", content: data.assistantMessage },
      ]);
      setSuggestedReplies(data.suggestedReplies ?? []);
      setRecommendedReply(data.recommendedReply ?? "");
    } catch (caught) {
      if (generation !== generationRef.current) return;
      const message =
        caught instanceof Error
          ? caught.message
          : "AI応答の取得に失敗しました。";
      setMessages([
        ...nextMessages,
        { role: "assistant", content: `エラーが発生しました。\n${message}` },
      ]);
    } finally {
      if (generation === generationRef.current) setIsChatting(false);
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendText(input);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      void sendText(input);
    }
  }

  async function buildPack() {
    const generation = generationRef.current;
    setBuildResult(null);
    setIsBuilding(true);

    try {
      const response = await fetch("/api/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spec, outputDir }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? "パック生成に失敗しました。");
      if (generation !== generationRef.current) return;

      setBuildResult(data);
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: `完成！ ${getPackName(spec)}を生成しました。\n${data.packPath}`,
        },
      ]);
    } catch (caught) {
      if (generation !== generationRef.current) return;
      const message =
        caught instanceof Error ? caught.message : "パック生成に失敗しました。";
      setMessages((current) => [
        ...current,
        { role: "assistant", content: `生成に失敗しました。\n${message}` },
      ]);
    } finally {
      if (generation === generationRef.current) setIsBuilding(false);
    }
  }

  async function selectOutputDir() {
    const generation = generationRef.current;
    setIsSelectingOutput(true);

    try {
      const response = await fetch("/api/select-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPath: outputDir }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? "フォルダ選択に失敗しました。");
      if (generation !== generationRef.current) return;
      if (!data.canceled && data.path) setOutputDir(data.path);
    } catch (caught) {
      if (generation !== generationRef.current) return;
      const message =
        caught instanceof Error
          ? caught.message
          : "フォルダ選択に失敗しました。";
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: `フォルダ選択に失敗しました。\n${message}`,
        },
      ]);
    } finally {
      if (generation === generationRef.current) setIsSelectingOutput(false);
    }
  }

  function switchEdition(nextEdition: Edition) {
    if (nextEdition === edition || isBusy) return;
    if (
      hasStarted &&
      !window.confirm(
        "エディションを切り替えると現在の会話と仕様がリセットされます。続けますか？",
      )
    ) {
      return;
    }
    resetWorkspace(nextEdition);
  }

  function resetWorkspace(nextEdition: Edition) {
    generationRef.current += 1;
    setEdition(nextEdition);
    setMessages([{ role: "assistant", content: initialMessage(nextEdition) }]);
    setInput("");
    setSpec(createEmptySpec(nextEdition));
    setOutputDir("");
    setBuildResult(null);
    setSuggestedReplies([]);
    setRecommendedReply("");
    setIsChatting(false);
    setIsBuilding(false);
    setIsSelectingOutput(false);
  }

  return (
    <main className="app-shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">
            {edition === "java"
              ? "MINECRAFT JAVA EDITION"
              : "MINECRAFT BEDROCK"}
          </p>
          <h1>ADDON CHAT BUILDER</h1>
        </div>
        <div className="topbar-right">
          <div
            className="edition-switch"
            role="group"
            aria-label="Minecraftエディション"
          >
            <button
              className={edition === "bedrock" ? "active" : ""}
              type="button"
              aria-pressed={edition === "bedrock"}
              onClick={() => switchEdition("bedrock")}
              disabled={isBusy}
            >
              統合版
            </button>
            <button
              className={edition === "java" ? "active" : ""}
              type="button"
              aria-pressed={edition === "java"}
              onClick={() => switchEdition("java")}
              disabled={isBusy || !!configError}
              title={configError || undefined}
            >
              Java版
            </button>
          </div>
          <span className="hearts" aria-hidden="true">
            <IconHeart size={20} />
            <IconHeart size={20} />
            <IconHeart size={20} />
          </span>
          <button
            className="btn"
            type="button"
            onClick={() => resetWorkspace(edition)}
          >
            リセット
          </button>
        </div>
      </section>

      {configError && (
        <div className="warning-box config-warning">
          Java版設定エラー: {configError}
        </div>
      )}
      <Stepper step={step} />

      <section className="focus-layout">
        <div className="card chat-card">
          {!hasStarted && (
            <div className="chat-hero">
              <p className="kicker">START HERE</p>
              <h2>
                {edition === "java"
                  ? "Java版で何を作りたいですか？"
                  : "どんなアドオンを作りたいですか？"}
              </h2>
              <p>まずは一文で。足りない情報はAIが順番に聞きます。</p>
              <div className="starter-grid" aria-label="作成例">
                {starterPrompts.map((prompt) => (
                  <button
                    className="btn starter-button"
                    type="button"
                    key={prompt}
                    onClick={() => sendText(prompt)}
                    disabled={
                      isChatting || (edition === "java" && !javaTargetVersion)
                    }
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div
            className="message-list"
            role="log"
            aria-live="polite"
            aria-atomic="false"
          >
            {messages.map((message, index) => (
              <div
                className={`message ${message.role}`}
                key={`${message.role}-${index}`}
              >
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
                <button
                  className="btn pri"
                  type="button"
                  onClick={buildPack}
                  disabled={isBuilding}
                >
                  <IconPlayerPlay size={18} aria-hidden="true" />
                  {isBuilding ? "生成中..." : buildLabel}
                </button>
                <button
                  className="btn"
                  type="button"
                  onClick={() => inputRef.current?.focus()}
                >
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
              placeholder={
                edition === "java"
                  ? "例: 60秒ごとに『休憩しよう』と表示したい（Enterで送信 / Shift+Enterで改行）"
                  : "例: 鉄インゴットと棒で、雷を出せる槍を作りたい（Enterで送信 / Shift+Enterで改行）"
              }
              rows={3}
            />
            <button
              className="btn pri"
              type="submit"
              disabled={isChatting || !input.trim()}
            >
              送信
            </button>
          </form>
        </div>

        <section className="card blueprint" aria-label="設計図">
          <p className="kicker">BLUEPRINT / 設計図</p>
          <h2>{spec.title || "まだ作成内容は未確定です"}</h2>

          {rows.map((row, index) => (
            <div
              className={`bp-row ${row.status}`}
              key={`${row.label}-${index}`}
            >
              <span className="bl">{row.label}</span>
              <span className="bv">{row.value}</span>
              {row.status === "done" && (
                <IconCheck className="bs ok" size={18} aria-hidden="true" />
              )}
              {row.status === "current" && (
                <IconPencil className="bs cur" size={18} aria-hidden="true" />
              )}
            </div>
          ))}

          <p className="bp-note">
            <IconCheck size={18} aria-hidden="true" />
            {remaining > 0 ? `あと${remaining}個できまる` : "準備OK！"}
          </p>

          {canBuild && (
            <div className="output-box">
              <label htmlFor="outputDir">
                出力先フォルダ{edition === "java" ? "（Java版 専用）" : ""}
              </label>
              <input
                id="outputDir"
                value={outputDir}
                onChange={(event) => setOutputDir(event.target.value)}
              />
              <div className="output-actions">
                <button
                  className="btn"
                  type="button"
                  onClick={selectOutputDir}
                  disabled={isSelectingOutput}
                >
                  {isSelectingOutput ? "選択中..." : "フォルダを選択"}
                </button>
                <button
                  className="btn"
                  type="button"
                  onClick={() => setOutputDir("")}
                >
                  既定に戻す
                </button>
              </div>
              <button
                className="btn pri wide"
                type="button"
                onClick={buildPack}
                disabled={isBuilding}
              >
                <IconPlayerPlay size={18} aria-hidden="true" />
                {isBuilding ? "生成中..." : buildLabel}
              </button>
            </div>
          )}

          {buildResult && (
            <div className="result-box">
              <h3>生成完了</h3>
              <p>{buildResult.description}</p>
              <p>{buildResult.packPath}</p>
              <ul>
                {buildResult.files.map((file) => (
                  <li key={file}>{file}</li>
                ))}
              </ul>
              <button
                className="btn"
                type="button"
                onClick={() => resetWorkspace(edition)}
              >
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

function getBuildLabel(spec: AddonSpec): string {
  if (spec.edition === "bedrock") return ".mcpack を生成";
  return spec.kind === "resourcepack"
    ? "リソースパック(.zip) を生成"
    : "データパック(.zip) を生成";
}

function getPackName(spec: AddonSpec): string {
  if (spec.edition === "bedrock") return ".mcpack";
  return spec.kind === "resourcepack"
    ? "リソースパック(.zip)"
    : "データパック(.zip)";
}

function Stepper({
  step,
}: {
  step: { kind: StepStatus; detail: StepStatus; build: StepStatus };
}) {
  return (
    <div className="stepper">
      <Step n="01" label="種類" status={step.kind} />
      <Step n="02" label="詳細" status={step.detail} />
      <Step n="03" label="生成" status={step.build} />
    </div>
  );
}

function Step({
  n,
  label,
  status,
}: {
  n: string;
  label: string;
  status: StepStatus;
}) {
  const Icon =
    status === "done"
      ? IconCheck
      : status === "current"
        ? IconPencil
        : IconLock;
  return (
    <div className={`step ${status}`}>
      <span className="sn">{n}</span>
      <span className="sl">{label}</span>
      <Icon className="si" size={18} aria-hidden="true" />
    </div>
  );
}
