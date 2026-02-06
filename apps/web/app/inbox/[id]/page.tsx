"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { API_KEY, apiFetch, apiFetchBlob, buildEventSourceUrl } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { CaptureItemDTO, ActionSuggestion } from "@capture-ai/shared";

export default function CaptureDetailPage() {
  const params = useParams();
  const router = useRouter();
  const captureId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [item, setItem] = useState<CaptureItemDTO | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [showOcr, setShowOcr] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  const loadItem = useCallback(async () => {
    if (!captureId) return;
    setError(null);
    try {
      const response = await apiFetch<{ data: CaptureItemDTO }>(`/v1/captures/${captureId}`);
      setItem(response.data);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [captureId]);

  useEffect(() => {
    loadItem();
  }, [loadItem]);

  useEffect(() => {
    if (!captureId || !API_KEY) return;
    const source = new EventSource(buildEventSourceUrl("/v1/captures/stream", { captureId }));
    const onUpdate = (event: MessageEvent) => {
      const payload = JSON.parse(event.data) as CaptureItemDTO[];
      if (Array.isArray(payload) && payload[0]) {
        setItem(payload[0]);
      }
    };
    source.addEventListener("update", onUpdate);
    source.addEventListener("error", () => source.close());
    return () => source.close();
  }, [captureId]);

  useEffect(() => {
    if (API_KEY) return;
    if (!item) return;
    if (item.status !== "UPLOADED" && item.status !== "PROCESSING") return;
    const timer = window.setInterval(() => {
      loadItem();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [item, loadItem]);

  useEffect(() => {
    if (!captureId) return;
    let url: string | null = null;
    const loadImage = async () => {
      try {
        const blob = await apiFetchBlob(`/v1/captures/${captureId}/file`);
        url = URL.createObjectURL(blob);
        setImageUrl(url);
      } catch {
        setImageUrl(null);
      }
    };
    loadImage();
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [captureId]);

  const actions = useMemo(() => item?.actionSuggestions ?? [], [item]);

  const handleAction = async (action: ActionSuggestion) => {
    if (!item) return;
    setSaving(true);
    try {
      await apiFetch("/v1/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: action.title,
          sourceCaptureId: item.id
        })
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const retryCapture = async () => {
    if (!captureId) return;
    setActionBusy(true);
    setError(null);
    try {
      await apiFetch(`/v1/captures/${captureId}/retry`, { method: "POST" });
      await loadItem();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActionBusy(false);
    }
  };

  const deleteCapture = async () => {
    if (!captureId) return;
    if (!window.confirm("이 캡처를 삭제할까요?")) return;
    setActionBusy(true);
    setError(null);
    try {
      await apiFetch(`/v1/captures/${captureId}`, { method: "DELETE" });
      router.push("/inbox");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActionBusy(false);
    }
  };

  if (!captureId) {
    return <p>캡처를 불러오는 중입니다.</p>;
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <h2>캡처 상세</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link className="button" href={`/chat?captureId=${captureId}`}>
            이 캡처로 대화
          </Link>
          {item?.status === "FAILED" && (
            <button className="button secondary" onClick={retryCapture} disabled={actionBusy}>
              재처리
            </button>
          )}
          <button className="button secondary" onClick={deleteCapture} disabled={actionBusy}>
            삭제
          </button>
        </div>
      </div>
      {error && (
        <p>
          <strong>에러:</strong> {error}
        </p>
      )}
      {!item ? (
        <p>불러오는 중...</p>
      ) : (
        <div className="detail-grid">
          <div>
            {imageUrl ? (
              <img className="image-preview" src={imageUrl} alt={item.originalFilename} />
            ) : (
              <div className="image-preview" style={{ padding: 24 }}>
                이미지 로딩 실패
              </div>
            )}
          </div>
          <div>
            <h3>{item.originalFilename}</h3>
            <p className="eyebrow">{formatDateTime(item.createdAt)}</p>
            <p>
              <span className="status-badge">{item.status}</span>
            </p>
            {item.status === "FAILED" && item.failureReason && (
              <p>
                <strong>실패 사유:</strong> {item.failureReason}
              </p>
            )}
            <p>
              <strong>카테고리:</strong> {item.category ?? "분류 대기"}
            </p>
            <p>
              <strong>요약:</strong> {item.summary ?? "요약 대기"}
            </p>
            {item.purposeSummary && (
              <p>
                <strong>목적 정리:</strong> {item.purposeSummary}
              </p>
            )}
            {!!item.purposeChecklist?.length && (
              <div>
                <strong>목적 체크리스트</strong>
                <ul>
                  {item.purposeChecklist.map((entry) => (
                    <li key={entry}>{entry}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="tags">
              {item.tags?.map((tag) => (
                <span className="tag" key={tag}>
                  #{tag}
                </span>
              ))}
            </div>
            <button className="button secondary" onClick={() => setShowOcr((prev) => !prev)}>
              {showOcr ? "OCR 텍스트 숨기기" : "OCR 텍스트 보기"}
            </button>
            {showOcr && <pre style={{ whiteSpace: "pre-wrap" }}>{item.ocrText ?? "OCR 대기"}</pre>}
            <div style={{ marginTop: 16 }}>
              <h4>다음 행동 추천</h4>
              <div className="panel-grid">
                {actions.map((action) => (
                  <button
                    key={action.title}
                    className="button"
                    onClick={() => handleAction(action)}
                    disabled={saving}
                    title={action.reason}
                  >
                    {action.title}
                  </button>
                ))}
                {!actions.length && <p>추천 생성 대기 중입니다.</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


