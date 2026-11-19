"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppBarDetail, BottomAction, Button, Chip, ErrorText, Info } from "@/components/ui";
import { request } from "@/lib/api";
import { useSession } from "@/lib/session";

type Account = { id: number; name: string; headline: string; area: string };

/** A01 · 가입·로그인 (보호자 / 선생님) */
export default function Login() {
  const s = useSession();
  const router = useRouter();
  const [role, setRole] = useState<"guardian" | "teacher">("guardian");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [teacherId, setTeacherId] = useState<number | null>(null);

  useEffect(() => {
    request<{ teachers: Account[]; default: string }>("/api/auth/teachers")
      .then((r) => {
        setAccounts(r.teachers);
        setTeacherId(r.teachers.find((t) => t.name === r.default)?.id ?? r.teachers[0]?.id ?? null);
      })
      .catch(() => {});
  }, []);

  async function go() {
    setBusy(true);
    setErr("");
    try {
      if (role === "teacher") {
        await s.startTeacher(teacherId ?? undefined);
        router.push("/t/profile");
      } else {
        await s.startGuardian();
        router.push("/g/address");
      }
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
            <p className="t14 text-muted">교원 자격 보유자, 보육교사·아이돌봄사 등 아동 지도 경력이 검증된 분이 활동해요.</p>
          )}
        </div>
        {role === "teacher" && accounts.length > 0 && (
          <div className="flex flex-col gap-3">
            <h3 className="t20 font-bold">시연 선생님 계정</h3>
            <p className="t14 text-muted">보호자가 이 선생님에게 보낸 방문 요청을 받아요.</p>
            <div className="flex flex-wrap gap-2">
              {accounts.map((t) => (
                <Chip key={t.id} selected={teacherId === t.id} onClick={() => setTeacherId(t.id)}>{t.name} · {t.area}</Chip>
              ))}
            </div>
          </div>
        )}
        {role === "guardian" && <Info>카카오 실제 인증은 후속 연동 범위입니다.</Info>}
        <ErrorText>{err}</ErrorText>
      </div>
      <BottomAction>
        <Button onClick={go} disabled={busy}>{busy ? "준비하는 중…" : role === "guardian" ? "보호자로 계속하기" : "선생님으로 계속하기"}</Button>
      </BottomAction>
    </div>
  );
}
