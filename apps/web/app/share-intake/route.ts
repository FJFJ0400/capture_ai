import { NextResponse } from "next/server";
import { stageShareFiles } from "@/lib/share-stage";

export async function POST(request: Request) {
  const form = await request.formData();
  const stagedFiles: Array<{ name: string; type: string; size: number; base64: string }> = [];
  const candidates = [...form.getAll("files"), ...form.getAll("file")];

  for (const value of candidates) {
    if (!(value instanceof File)) continue;
    if (!value.type.startsWith("image/")) continue;
    const buffer = Buffer.from(await value.arrayBuffer());
    stagedFiles.push({
      name: value.name || "capture-image",
      type: value.type || "image/png",
      size: value.size,
      base64: buffer.toString("base64")
    });
  }

  if (!stagedFiles.length) {
    return NextResponse.redirect(new URL("/inbox?shareError=1", request.url), 303);
  }

  const token = stageShareFiles(stagedFiles);
  return NextResponse.redirect(new URL(`/mobile-save?token=${token}`, request.url), 303);
}
