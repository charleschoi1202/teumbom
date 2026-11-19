"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { Badge, Button, ErrorText } from "@/components/ui";
import { apiBase } from "@/lib/api";
import { useSession } from "@/lib/session";

const STEPS = ["통신문 확인 · 할 일 맡기기", "방문 중 체크 · 활동 기록", "선생님 확인 후 리포트 받기"];

/** S01 · 틈봄 시작하기 */
export default function Start() {
  const s = useSession();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [url, setUrl] = useState("");
  const [server, setServer] = useState<"checking" | "ready" | "waking" | "down">("checking");
  useEffect(() => setUrl(window.location.origin), []);

  // Free-tier API sleeps when idle: wake it as soon as someone scans the QR.
  useEffect(() => {
    let alive = true;
    const slow = setTimeout(() => alive && setServer((s) => (s === "checking" ? "waking" : s)), 2500);
    const ping = async (tries: number): Promise<void> => {
      try {
        const r = await fetch(`${apiBase()}/`, { cache: "no-store" });
        if (r.ok && alive) { setServer("ready"); return; }
      } catch { /* retry */ }
      if (tries > 0 && alive) { await new Promise((res) => setTimeout(res, 3000)); return ping(tries - 1); }
      if (alive) setServer("down");
    };
    void ping(25);
    return () => { alive = false; clearTimeout(slow); };
  }, []);

  async function begin(as: "guardian" | "teacher") {
    setBusy(as);
    setErr("");
    try {
      await s.startRoom();
      if (as === "teacher") s.switchRole("teacher");
      router.push(as === "guardian" ? "/g/home" : "/t/visits");
    } catch (e) {
      setErr((e as Error).message);
      setBusy(null);
    }
  }

  const resume = s.ready && s.room && (s.tokens.guardian || s.tokens.teacher);

  return (
    <div className="min-h-dvh lg:flex lg:items-center lg:justify-center lg:gap-16 lg:px-12">
      <div className="mx-auto w-full max-w-[480px] lg:mx-0">
        <header className="flex h-16 items-center bg-surface px-5 lg:bg-transparent lg:px-0">
          <h1 className="t20 font-bold">틈봄 시작하기</h1>
        </header>
        <div className="flex flex-col gap-5 px-5 pb-8 pt-5 lg:px-0">
          <div><Badge tone="BOOKED">교육형 방문 돌봄</Badge></div>
          <Logo />
          <h2 className="t32 font-bold">학교와 집 사이,<br />아이의 하루를 잇다.</h2>
          <p className="t16 text-muted">통신문의 할 일부터 방문 기록까지.<br />보호자와 선생님이 함께 돌봐요.</p>
          <ol className="rounded-xl border border-soft bg-surface px-4">
            {STEPS.map((t, i) => (
              <li key={t} className="t16 flex items-center gap-3 border-b border-soft py-4 last:border-0">
                <span className="font-bold text-brand">0{i + 1}</span>{t}
              </li>
            ))}
          </ol>
          {server === "waking" && (
            <p className="t14 flex items-center gap-2 rounded-xl bg-wait px-4 py-3 text-wait-ink" role="status">
              <span className="tb-pulse">●</span> 시연 서버를 깨우는 중이에요. 무료 서버라 첫 접속은 30초 정도 걸려요.
            </p>
          )}
          {server === "down" && <ErrorText>시연 서버에 연결하지 못했어요. 잠시 후 새로고침해 주세요.</ErrorText>}
          <ErrorText>{err}</ErrorText>
          <div className="flex flex-col gap-3">
            <Button onClick={() => begin("guardian")} disabled={!!busy}>{busy === "guardian" ? "시연 방을 만드는 중…" : "보호자로 체험하기"}</Button>
            <Button kind="secondary" onClick={() => begin("teacher")} disabled={!!busy}>{busy === "teacher" ? "시연 방을 만드는 중…" : "선생님으로 체험하기"}</Button>
            {resume && (
              <Button kind="text" href={s.role === "teacher" ? "/t/visits" : "/g/home"}>이어서 하기 · 방 {s.room}</Button>
            )}
            <Button kind="text" href="/login">내 계정으로 시작하기</Button>
            <Link href="/join" className="t16 text-center font-bold text-brand">방 코드로 선생님 참여하기</Link>
          </div>
        </div>
      </div>

      {url && (
        <aside className="hidden w-[360px] rounded-2xl border border-soft bg-surface p-8 lg:block">
          <p className="t20 font-bold">휴대폰으로 열기</p>
          <p className="t16 mt-2 text-muted">카메라로 QR을 찍으면 앱처럼 실행돼요.<br />홈 화면에 추가하면 전체 화면으로 열려요.</p>
          <div className="mt-6 flex justify-center rounded-xl bg-bg p-6">
            <QRCodeSVG value={url} size={220} level="M" />
          </div>
          <p className="t14 mt-4 break-all text-center text-muted">{url}</p>
        </aside>
      )}
    </div>
  );
}
