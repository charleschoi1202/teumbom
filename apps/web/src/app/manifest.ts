import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "틈봄 — 방과후 학습·돌봄",
    short_name: "틈봄",
    description: "검증된 교원·아동 지도 전문가가 가정을 방문하는 AI 기반 방과후 학습·돌봄",
    start_url: "/",
    display: "standalone",
    background_color: "#F6F8FB",
    theme_color: "#ffffff",
    lang: "ko",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
