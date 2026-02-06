"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import type { CapturePurposeDTO } from "@capture-ai/shared";

type StagedFile = {
  name: string;
  type: string;
  size: number;
  base64: string;
};

type StagedPayload = {
  createdAt: number;
  files: StagedFile[];
};

const base64ToFile = (item: StagedFile): File => {
  const binary = atob(item.base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], item.name, { type: item.type });
};

type MobileSavePageProps = {
  searchParams: {
    token?: string;
  };
};

export default function MobileSavePage({ searchParams }: MobileSavePageProps) {
  const router = useRouter();
  const token = searchParams.token ?? "";

  const [staged, setStaged] = useState<StagedPayload | null>(null);
  const [purposes, setPurposes] = useState<CapturePurposeDTO[]>([]);
  const [purposeId, setPurposeId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(() => {
    if (!staged?.files[0]) return null;
    const first = staged.files[0];
    return `data:${first.type};base64,${first.base64}`;
  }, [staged]);

  useEffect(() => {
    if (!token) return;
    fetch(`/mobile-save/staged/${token}`)
      .then((response) => response.json())
      .then((payload) => {
        if (!payload.data) throw new Error(payload.error?.message ?? "Staged data missing.");
        setStaged(payload.data as StagedPayload);
      })
      .catch((err) => setError((err as Error).message));
  }, [token]);

  useEffect(() => {
    apiFetch<{ data: CapturePurposeDTO[] }>("/v1/purposes")
      .then((response) => {
        setPurposes(response.data.filter((item) => item.isActive));
        const defaultPurpose = response.data.find((item) => item.isDefault && item.isActive);
        setPurposeId(defaultPurpose?.id ?? response.data[0]?.id ?? "");
      })
      .catch((err) => setError((err as Error).message));
  }, []);

  const clearStage = async () => {
    if (!token) return;
    await fetch(`/mobile-save/staged/${token}`, { method: "DELETE" });
  };

  const saveSharedCapture = async () => {
    if (!staged?.files.length) return;
    setSaving(true);
    setError(null);
    try {
      const formData = new FormData();
      staged.files.forEach((item) => {
        formData.append("files", base64ToFile(item), item.name);
      });
      if (purposeId) {
        formData.append("purposeId", purposeId);
      }
      await apiFetch("/v1/captures", { method: "POST", body: formData });
      await clearStage();
      router.push("/inbox?shared=1");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const cancel = async () => {
    await clearStage();
    router.push("/inbox");
  };

  return (
    <section className="card">
      <h2>모바일 캡처 저장</h2>
      <p style={{ marginTop: 0 }}>스크린샷 공유로 전달된 이미지를 확인하고 저장하세요.</p>
      {error && <p>에러: {error}</p>}
      {!staged ? (
        <p>공유 이미지 불러오는 중...</p>
      ) : (
        <>
          {preview && <img className="image-preview" src={preview} alt="shared capture" />}
          <p style={{ marginTop: 10 }}>총 {staged.files.length}개 파일 준비됨</p>
          <select className="select" value={purposeId} onChange={(event) => setPurposeId(event.target.value)}>
            <option value="">기본 목적 자동 선택</option>
            {purposes.map((purpose) => (
              <option key={purpose.id} value={purpose.id}>
                {purpose.name}
              </option>
            ))}
          </select>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button className="button" onClick={saveSharedCapture} disabled={saving}>
              {saving ? "저장 중..." : "기록(저장)하기"}
            </button>
            <button className="button secondary" onClick={cancel} disabled={saving}>
              취소
            </button>
          </div>
        </>
      )}
    </section>
  );
}
