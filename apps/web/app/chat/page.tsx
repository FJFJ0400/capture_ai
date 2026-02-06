"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { CaptureItemDTO } from "@capture-ai/shared";

type ChatReference = {
  id: string;
  originalFilename: string;
  createdAt: string;
  summary: string | null;
  purposeSummary: string | null;
  tags: string[];
  score: number;
};

type ChatPayload = {
  answer: string;
  references: ChatReference[];
  followUps: string[];
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  references?: ChatReference[];
  followUps?: string[];
};

const INTRO_TEXT =
  "저장된 스크린샷을 기준으로 질문에 답합니다. 예: '최근 영수증에서 환불 가능한 건 뭐야?'";

export default function ChatPage() {
  const [captures, setCaptures] = useState<CaptureItemDTO[]>([]);
  const [selectedCaptureId, setSelectedCaptureId] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: INTRO_TEXT
    }
  ]);

  const captureMap = useMemo(() => new Map(captures.map((item) => [item.id, item])), [captures]);

  useEffect(() => {
    const preferredCaptureId =
      typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("captureId") ?? "" : "";
    apiFetch<{ data: CaptureItemDTO[] }>("/v1/captures?status=DONE")
      .then((response) => {
        setCaptures(response.data);
        if (preferredCaptureId && response.data.some((item) => item.id === preferredCaptureId)) {
          setSelectedCaptureId(preferredCaptureId);
        }
      })
      .catch((err) => setError((err as Error).message));
  }, []);

  const runQuery = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    const userMessage: ChatMessage = { role: "user", content: trimmed };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const response = await apiFetch<{ data: ChatPayload }>("/v1/chat/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          captureId: selectedCaptureId || undefined,
          history: nextMessages.slice(-8).map((item) => ({
            role: item.role,
            content: item.content
          }))
        })
      });

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: response.data.answer,
          references: response.data.references,
          followUps: response.data.followUps
        }
      ]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await runQuery(input);
  };

  return (
    <section className="chat-layout">
      <div className="card">
        <h2>스크린샷 대화</h2>
        <p style={{ marginTop: 0 }}>
          저장한 스크린샷 내용으로 질문에 답합니다. 필요하면 특정 스크린샷 하나만 지정해 물어보세요.
        </p>
        <select
          className="select"
          value={selectedCaptureId}
          onChange={(event) => setSelectedCaptureId(event.target.value)}
          style={{ marginBottom: 10 }}
        >
          <option value="">최근 전체 스크린샷 기준</option>
          {captures.map((item) => (
            <option key={item.id} value={item.id}>
              {item.originalFilename}
            </option>
          ))}
        </select>
        {selectedCaptureId && captureMap.get(selectedCaptureId) && (
          <p className="eyebrow" style={{ marginBottom: 0 }}>
            선택됨: {captureMap.get(selectedCaptureId)?.originalFilename}
          </p>
        )}
        {error && (
          <p>
            <strong>에러:</strong> {error}
          </p>
        )}
      </div>

      <div className="card">
        <div className="chat-thread">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`chat-bubble ${message.role === "user" ? "user" : "assistant"}`}
            >
              <strong>{message.role === "user" ? "나" : "에이전트"}</strong>
              <pre>{message.content}</pre>

              {!!message.references?.length && (
                <div className="chat-ref-list">
                  {message.references.map((ref) => (
                    <Link key={ref.id} href={`/inbox/${ref.id}`} className="chat-ref-item">
                      <strong>{ref.originalFilename}</strong>
                      <span>{formatDateTime(ref.createdAt)}</span>
                    </Link>
                  ))}
                </div>
              )}

              {!!message.followUps?.length && (
                <div className="chat-followups">
                  {message.followUps.map((followUp) => (
                    <button key={followUp} className="button secondary" onClick={() => runQuery(followUp)}>
                      {followUp}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          {loading && <p>응답 생성 중...</p>}
        </div>

        <form className="chat-input-row" onSubmit={submit}>
          <input
            className="input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="질문 입력 (예: 이 스크린샷에서 오늘 처리할 일만 정리해줘)"
            disabled={loading}
          />
          <button className="button" type="submit" disabled={loading || !input.trim()}>
            질문하기
          </button>
        </form>
      </div>
    </section>
  );
}
