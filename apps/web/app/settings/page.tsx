"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE_URL, API_KEY, apiFetch } from "@/lib/api";
import type { CapturePurposeDTO } from "@capture-ai/shared";

const maskKey = (value: string) =>
  value.length <= 6 ? "******" : `${value.slice(0, 3)}***${value.slice(-2)}`;

export default function SettingsPage() {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [purposes, setPurposes] = useState<CapturePurposeDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instruction, setInstruction] = useState("");
  const [keywords, setKeywords] = useState("");

  const activeCount = useMemo(() => purposes.filter((item) => item.isActive).length, [purposes]);

  const loadPurposes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch<{ data: CapturePurposeDTO[] }>("/v1/purposes");
      setPurposes(response.data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPurposes();
  }, [loadPurposes]);

  const copyKey = async () => {
    if (!API_KEY) return;
    await navigator.clipboard.writeText(API_KEY);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const createPurpose = async () => {
    if (!name.trim() || !instruction.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/v1/purposes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          instruction: instruction.trim(),
          sampleKeywords: keywords
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean)
        })
      });
      setName("");
      setDescription("");
      setInstruction("");
      setKeywords("");
      await loadPurposes();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const setDefaultPurpose = async (purposeId: string) => {
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/v1/purposes/${purposeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true })
      });
      await loadPurposes();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (purpose: CapturePurposeDTO) => {
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/v1/purposes/${purpose.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !purpose.isActive })
      });
      await loadPurposes();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const deletePurpose = async (purposeId: string) => {
    if (!window.confirm("이 목적 프로필을 삭제할까요?")) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/v1/purposes/${purposeId}`, { method: "DELETE" });
      await loadPurposes();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card">
      <h2>설정</h2>
      {error && <p>에러: {error}</p>}
      <div className="panel-grid">
        <div className="card" style={{ margin: 0 }}>
          <h3>API 연결</h3>
          <p className="eyebrow">Base URL</p>
          <p>{API_BASE_URL}</p>
          <p className="eyebrow" style={{ marginTop: 16 }}>
            API Key
          </p>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <strong>{API_KEY ? (revealed ? API_KEY : maskKey(API_KEY)) : "설정 필요"}</strong>
            <button className="button secondary" onClick={() => setRevealed((prev) => !prev)}>
              {revealed ? "숨기기" : "보기"}
            </button>
            <button className="button" onClick={copyKey} disabled={!API_KEY}>
              {copied ? "복사됨" : "복사"}
            </button>
          </div>
          {!API_KEY && <p style={{ marginTop: 8 }}>NEXT_PUBLIC_API_KEY 환경변수를 설정하세요.</p>}
        </div>

        <div className="card" style={{ margin: 0 }}>
          <h3>모바일 캡처 동작</h3>
          <p style={{ marginTop: 0 }}>1. 앱을 PWA로 설치합니다.</p>
          <p style={{ marginTop: 0 }}>2. 스크린샷 후 공유에서 Capture AI Agent를 선택합니다.</p>
          <p style={{ marginTop: 0 }}>3. 저장하기 버튼을 눌러 인입함으로 즉시 저장합니다.</p>
          <p className="eyebrow" style={{ marginTop: 16 }}>
            파일 정책
          </p>
          <ul style={{ paddingLeft: 16, margin: 0 }}>
            <li>허용: PNG/JPG/WEBP</li>
            <li>최대 용량: 10MB</li>
            <li>암호화 저장: AES-256-GCM</li>
          </ul>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>목적 프로필 관리</h3>
        <p style={{ marginTop: 0 }}>활성 프로필 {activeCount}개</p>
        <div className="panel-grid" style={{ marginBottom: 12 }}>
          <input className="input" placeholder="목적명 (예: 영수증 정리)" value={name} onChange={(event) => setName(event.target.value)} />
          <input className="input" placeholder="설명" value={description} onChange={(event) => setDescription(event.target.value)} />
          <input
            className="input"
            placeholder="키워드 (콤마 구분)"
            value={keywords}
            onChange={(event) => setKeywords(event.target.value)}
          />
        </div>
        <textarea
          className="input"
          placeholder="정리 지시사항 (예: 일정/금액/후속작업 중심으로 요약)"
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          rows={3}
        />
        <div style={{ marginTop: 10 }}>
          <button className="button" onClick={createPurpose} disabled={saving || !name.trim() || !instruction.trim()}>
            목적 프로필 추가
          </button>
        </div>

        <div className="list" style={{ marginTop: 12 }}>
          {loading ? (
            <p>불러오는 중...</p>
          ) : (
            purposes.map((purpose) => (
              <div className="list-item" key={purpose.id}>
                <div>
                  <strong>{purpose.name}</strong>
                  <p style={{ margin: "6px 0" }}>{purpose.description ?? "설명 없음"}</p>
                  <p className="eyebrow" style={{ marginTop: 0 }}>
                    {purpose.isDefault ? "기본 목적" : "사용자 목적"} · {purpose.isActive ? "활성" : "비활성"}
                  </p>
                  <div className="tags">
                    {purpose.sampleKeywords.map((keyword) => (
                      <span key={keyword} className="tag">
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="list-item-actions">
                  {!purpose.isDefault && (
                    <button className="button secondary" onClick={() => setDefaultPurpose(purpose.id)} disabled={saving}>
                      기본으로
                    </button>
                  )}
                  <button className="button secondary" onClick={() => toggleActive(purpose)} disabled={saving}>
                    {purpose.isActive ? "비활성화" : "활성화"}
                  </button>
                  {!purpose.isDefault && (
                    <button className="button secondary" onClick={() => deletePurpose(purpose.id)} disabled={saving}>
                      삭제
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
