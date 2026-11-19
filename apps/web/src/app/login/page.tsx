"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppBarDetail, BottomAction, Button, Chip, ErrorText, Info } from "@/components/ui";
import { useSession } from "@/lib/session";

/** A01 · 가입·로그인 (보호자 / 선생님) */
export default function Login() {
  const s = useSession();
  const router = useRouter();
  const [role, setRole] = useState<"guardian" | "teacher">("guardian");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function go() {
    setBusy(true);
    setErr("");
    try {
      await s.startRoom();
      if (role === "teacher") {
        s.switchRole("teacher");
        router.push("/t/profile");
      } else router.push("/g/address");
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-[480px] lg:max-w-[560px]">
      <AppBarDetail title="가입·로그인" back="/" />
      <div className="flex flex-col gap-6 px-5 py-5 lg:px-0">
        <div>
          <h2 className="t24 font-bold">내 계정으로 틈봄 시작하기</h2>
          {role === "guardian" && <p className="t16 mt-2 text-muted">첫 가입이라면 역할과 기본 정보를<br />입력한 뒤 이용할 수 있어요.</p>}
        </div>
        <Info>카카오 계정 연결 완료 · 가상 계정</Info>
        <div className="flex flex-col gap-3">
          <h3 className="t20 font-bold">어떤 역할로 이용하시나요?</h3>
          <div className="flex gap-2">
            <Chip selected={role === "guardian"} onClick={() => setRole("guardian")}>보호자</Chip>
            <Chip selected={role === "teacher"} onClick={() => setRole("teacher")}>선생님</Chip>
          </div>
          <p className="t16 text-muted">
            {role === "guardian" ? <>아이에게 필요한 돌봄을 찾고<br />선생님의 방문 기록을 받아요.</> : <>지역 가정을 방문하고<br />아이의 활동을 기록해요.</>}
          </p>
          {role === "teacher" && (
            <p className="t14 text-muted">자격증이 없어도 괜찮아요. 곤충·음악·요리처럼 내가 즐겨 온 것과 살아온 이야기로 아이와 만나요. 신원 확인과 범죄경력 조회는 필수예요.</p>
          )}
        </div>
        {role === "guardian" && <Info>카카오 실제 인증은 후속 연동 범위입니다.</Info>}
        <ErrorText>{err}</ErrorText>
      </div>
      <BottomAction>
        <Button onClick={go} disabled={busy}>{busy ? "준비하는 중…" : role === "guardian" ? "보호자로 계속하기" : "선생님으로 계속하기"}</Button>
      </BottomAction>
    </div>
  );
}
