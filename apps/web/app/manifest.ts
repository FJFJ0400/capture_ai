import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Capture AI Agent",
    short_name: "CaptureAI",
    description: "스크린샷을 저장하고 목적 기반으로 자동 정리하는 개인 인입함",
    start_url: "/inbox",
    display: "standalone",
    background_color: "#f7f2e8",
    theme_color: "#ff7847",
    share_target: {
      action: "/share-intake",
      method: "post",
      enctype: "multipart/form-data",
      params: {
        files: [
          {
            name: "files",
            accept: ["image/*"]
          }
        ]
      }
    }
  } as unknown as MetadataRoute.Manifest;
}
