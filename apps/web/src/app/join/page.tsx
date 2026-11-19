"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AppBarDetail, BottomAction, Button, ErrorText, Field, Info, inputCls } from "@/components/ui";
import { useSession } from "@/lib/session";

function JoinInner() {
  const params = useSearchParams();
  const s = useSession();
  const router = useRouter();
  const [code, setCode] = useState((params.get("code") || "").toUpperCase());
  const role = params.get("role") === "guardian" ? "guardian" : "teacher";
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function join() {
    setBusy(true);
    setErr("");
    try {
      await s.joinRoom(code.trim(), role);
      router.push(role === "teacher" ? "/t/visits" : "/g/home");
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-[480px] lg:max-w-[560px]">
      <AppBarDetail title={role === "teacher" ? "선생님으로 참여" : "보호자로 참여"} back="/" />
      <div className="flex flex-col gap-5 px-5 py-5 lg:px-0">
        <h2 className="t24 font-bold">같은 시연 방에 들어가요</h2>
        <p className="t16 text-muted">보호자 휴대폰에 보이는 방 코드나 QR로 들어오면,<br />요청·통신문·실시간 영상·리포트를 서로 주고받을 수 있어요.</p>
        <Field label="방 코드">
          <input className={`${inputCls} tracking-[0.3em] uppercase`} value={code} maxLength={6} inputMode="text"
            autoCapitalize="characters" onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="예: K7P2QX" />
        </Field>
        <Info>이 휴대폰은 보호자가 고른 돌봄 선생님(시연 계정)으로 활동해요.</Info>
        <ErrorText>{err}</ErrorText>
      </div>
      <BottomAction>
        <Button onClick={join} disabled={busy || code.trim().length !== 6}>{busy ? "들어가는 중…" : "시연 방 들어가기"}</Button>
      </BottomAction>
    </div>
  );
}

export default function Join() {
  return <Suspense><JoinInner /></Suspense>;
}
