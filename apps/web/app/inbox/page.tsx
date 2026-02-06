"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { API_KEY, apiFetch, buildEventSourceUrl } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import {
  CAPTURE_CATEGORIES,
  CAPTURE_STATUSES,
  type CaptureItemDTO,
  type CapturePurposeDTO
} from "@capture-ai/shared";

const DEFAULT_FILTERS = {
  query: "",
  category: "",
  status: "",
  purposeId: "",
  from: "",
  to: ""
};

export default function InboxPage() {
  const [items, setItems] = useState<CaptureItemDTO[]>([]);
  const [purposes, setPurposes] = useState<CapturePurposeDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [quickSaving, setQuickSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [uploadPurposeId, setUploadPurposeId] = useState("");
  const [quickFiles, setQuickFiles] = useState<File[]>([]);
  const [actionId, setActionId] = useState<string | null>(null);
  const quickInputRef = useRef<HTMLInputElement | null>(null);

  const hasFilters = useMemo(() => Object.values(filters).some(Boolean), [filters]);
  const purposeMap = useMemo(() => new Map(purposes.map((item) => [item.id, item])), [purposes]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }, [filters]);

  const loadPurposes = useCallback(async () => {
    try {
      const response = await apiFetch<{ data: CapturePurposeDTO[] }>("/v1/purposes");
      setPurposes(response.data.filter((item) => item.isActive));
      setUploadPurposeId((prev) => {
        if (prev) return prev;
        const defaultPurpose = response.data.find((item) => item.isDefault && item.isActive);
        return defaultPurpose?.id ?? response.data[0]?.id ?? "";
      });
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  const loadCaptures = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch<{ data: CaptureItemDTO[] }>(`/v1/captures${queryString}`);
      setItems(response.data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  const mergeUpdates = useCallback((updates: CaptureItemDTO[]) => {
    setItems((prev) => {
      const map = new Map(prev.map((item) => [item.id, item]));
      updates.forEach((item) => map.set(item.id, item));
      return [...map.values()].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    });
  }, []);

  useEffect(() => {
    loadPurposes();
  }, [loadPurposes]);

  useEffect(() => {
    loadCaptures();
  }, [loadCaptures]);

  useEffect(() => {
    if (!API_KEY || hasFilters) return;
    const source = new EventSource(buildEventSourceUrl("/v1/captures/stream"));
    const onUpdate = (event: MessageEvent) => {
      const payload = JSON.parse(event.data) as CaptureItemDTO[];
      if (Array.isArray(payload) && payload.length) {
        mergeUpdates(payload);
      }
    };
    source.addEventListener("update", onUpdate);
    source.addEventListener("error", () => source.close());
    return () => source.close();
  }, [hasFilters, mergeUpdates]);

  useEffect(() => {
    if (API_KEY && !hasFilters) return;
    const hasPending = items.some((item) => item.status === "UPLOADED" || item.status === "PROCESSING");
    if (!hasPending) return;
    const timer = window.setInterval(() => {
      loadCaptures();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [items, loadCaptures, hasFilters]);

  const uploadFiles = async (files: File[], purposeId?: string) => {
    if (!files.length) return;
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file, file.name));
    if (purposeId) {
      formData.append("purposeId", purposeId);
    }
    await apiFetch("/v1/captures", { method: "POST", body: formData });
  };

  const handleFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (!files.length) return;
    setUploading(true);
    setError(null);
    try {
      await uploadFiles(files, uploadPurposeId || undefined);
      await loadCaptures();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const saveQuickFiles = async () => {
    if (!quickFiles.length) return;
    setQuickSaving(true);
    setError(null);
    try {
      await uploadFiles(quickFiles, uploadPurposeId || undefined);
      setQuickFiles([]);
      if (quickInputRef.current) quickInputRef.current.value = "";
      await loadCaptures();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setQuickSaving(false);
    }
  };

  const retryCapture = async (id: string) => {
    setActionId(id);
    setError(null);
    try {
      await apiFetch(`/v1/captures/${id}/retry`, { method: "POST" });
      await loadCaptures();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActionId(null);
    }
  };

  const deleteCapture = async (id: string) => {
    if (!window.confirm("이 캡처를 삭제할까요?")) return;
    setActionId(id);
    setError(null);
    try {
      await apiFetch(`/v1/captures/${id}`, { method: "DELETE" });
      await loadCaptures();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActionId(null);
    }
  };

  return (
    <div>
      <section className="panel-grid">
        <div className="card">
          <h2>업로드</h2>
          <p style={{ marginTop: 0 }}>목적을 선택하면 AI가 해당 목적 기준으로 자동 정리합니다.</p>
          <select
            className="select"
            value={uploadPurposeId}
            onChange={(event) => setUploadPurposeId(event.target.value)}
            style={{ marginBottom: 10 }}
          >
            <option value="">기본 목적 자동 선택</option>
            {purposes.map((purpose) => (
              <option key={purpose.id} value={purpose.id}>
                {purpose.name}
                {purpose.isDefault ? " (기본)" : ""}
              </option>
            ))}
          </select>
          <label
            className={`dropzone ${dragging ? "dragging" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              if (event.dataTransfer.files?.length) {
                handleFiles(event.dataTransfer.files);
              }
            }}
          >
            <input
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => {
                if (event.target.files) handleFiles(event.target.files);
              }}
              style={{ display: "none" }}
            />
            <p>드래그&드롭 또는 클릭해서 업로드</p>
            <p className="eyebrow">PNG/JPG/WEBP · 최대 10MB</p>
            {uploading && <p>업로드 중...</p>}
          </label>
        </div>

        <div className="card">
          <h2>모바일 캡처 퀵저장</h2>
          <p style={{ marginTop: 0 }}>
            스마트폰 스크린샷 후 공유에서 Capture AI Agent를 선택하면 저장하기 화면이 열립니다.
          </p>
          <input
            ref={quickInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              if (files.length) setQuickFiles(files);
            }}
            style={{ display: "none" }}
          />
          <button className="button" onClick={() => quickInputRef.current?.click()}>
            스크린샷 선택
          </button>
          {!!quickFiles.length && (
            <div className="quick-files">
              {quickFiles.slice(0, 3).map((file) => (
                <div key={file.name} className="quick-file-item">
                  {file.name}
                </div>
              ))}
              {quickFiles.length > 3 && <div className="quick-file-item">외 {quickFiles.length - 3}개</div>}
            </div>
          )}
        </div>

        <div className="card">
          <h2>검색 & 필터</h2>
          <div className="panel-grid">
            <input
              className="input"
              placeholder="키워드 검색"
              value={filters.query}
              onChange={(event) => setFilters((prev) => ({ ...prev, query: event.target.value }))}
            />
            <select
              className="select"
              value={filters.category}
              onChange={(event) => setFilters((prev) => ({ ...prev, category: event.target.value }))}
            >
              <option value="">카테고리 전체</option>
              {CAPTURE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <select
              className="select"
              value={filters.status}
              onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
            >
              <option value="">상태 전체</option>
              {CAPTURE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <select
              className="select"
              value={filters.purposeId}
              onChange={(event) => setFilters((prev) => ({ ...prev, purposeId: event.target.value }))}
            >
              <option value="">목적 전체</option>
              {purposes.map((purpose) => (
                <option key={purpose.id} value={purpose.id}>
                  {purpose.name}
                </option>
              ))}
            </select>
            <input
              className="input"
              type="date"
              value={filters.from}
              onChange={(event) => setFilters((prev) => ({ ...prev, from: event.target.value }))}
            />
            <input
              className="input"
              type="date"
              value={filters.to}
              onChange={(event) => setFilters((prev) => ({ ...prev, to: event.target.value }))}
            />
          </div>
          <button className="button" onClick={loadCaptures} disabled={loading}>
            필터 적용
          </button>
        </div>
      </section>

      {error && (
        <div className="card">
          <strong>에러:</strong> {error}
        </div>
      )}

      <section className="card">
        <h2>인입함</h2>
        {loading ? (
          <p>불러오는 중...</p>
        ) : (
          <div className="list">
            {items.map((item) => (
              <div key={item.id} className="list-item">
                <Link className="list-item-link" href={`/inbox/${item.id}`}>
                  <div>
                    <strong>{item.originalFilename}</strong>
                    <p className="eyebrow">{formatDateTime(item.createdAt)}</p>
                    <p>{item.purposeSummary ?? item.summary ?? "요약 대기 중"}</p>
                    <div className="tags">
                      {item.purposeId && purposeMap.get(item.purposeId) && (
                        <span className="tag">목적:{purposeMap.get(item.purposeId)?.name}</span>
                      )}
                      {item.tags?.slice(0, 4).map((tag) => (
                        <span className="tag" key={tag}>
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </Link>
                <div className="list-item-actions">
                  <span className="status-badge">{item.status}</span>
                  {item.status === "FAILED" && (
                    <button
                      className="button secondary"
                      onClick={() => retryCapture(item.id)}
                      disabled={actionId === item.id}
                    >
                      재처리
                    </button>
                  )}
                  <button
                    className="button secondary"
                    onClick={() => deleteCapture(item.id)}
                    disabled={actionId === item.id}
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
            {!items.length && <p>아직 인입된 캡처가 없습니다.</p>}
          </div>
        )}
      </section>

      {!!quickFiles.length && (
        <div className="quick-save-bar">
          <strong>{quickFiles.length}개 스크린샷 준비됨</strong>
          <button className="button" onClick={saveQuickFiles} disabled={quickSaving}>
            {quickSaving ? "저장 중..." : "기록(저장)하기"}
          </button>
        </div>
      )}
    </div>
  );
}
