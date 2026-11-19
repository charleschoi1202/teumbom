import type { Metadata, Viewport } from "next";
import { Noto_Sans_KR } from "next/font/google";
import { SessionProvider } from "@/lib/session";
import "./globals.css";

const noto = Noto_Sans_KR({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-noto", display: "swap" });

export const metadata: Metadata = {
  title: "틈봄 — 학교와 집 사이, 아이의 하루를 잇다",
  description: "검증된 교원·아동 지도 전문가가 가정을 방문하는 AI 기반 방과후 학습·돌봄 서비스",
  
  appleWebApp: { capable: true, title: "틈봄", statusBarStyle: "default" },
  icons: { icon: "/icon.svg", apple: "/icon-192.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className={noto.variable}>
      <body className="antialiased">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
