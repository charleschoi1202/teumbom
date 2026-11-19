"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSession } from "@/lib/session";
import type { Visit } from "@/lib/types";
import { Avatar, Badge, Button, Card, CheckRow, ErrorText, Info, Overlay, PhaseBadge, TextLink, won } from "./ui";

export function VisitCard({ v, as = "guardian", price }: { v: Visit; as?: "guardian" | "teacher"; price?: boolean }) {
  const name = as === "guardian" ? `${v.teacher.name} 선생님` : v.household;
  const initial = as === "guardian" ? v.teacher.initial : "보";
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <PhaseBadge phase={v.phase} />
      </div>
      <p className="t16 font-bold">{v.date_label} {v.time_label}</p>
      <div className="flex items-center gap-3">
        <Avatar initial={initial} size={40} />
        <div>
          <p className="t16 font-bold">{name}</p>
          <p className="t14 text-muted">{v.child_desc}</p>
        </div>
      </div>
      {price && (
        <div className="t16 flex items-center justify-between text-muted">
          <span>{v.kind_label} · {v.hours}시간</span>
          <span className="font-bold text-ink">{won(v.price)}</span>
        </div>
      )}
    </Card>
  );
}

export function useVisitAction() {
  const { api } = useSession();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function run<T>(path: string, json?: unknown): Promise<T | null> {
    setBusy(true);
    setErr("");
    try {
      return await api<T>(path, { method: "POST", json });
    } catch (e) {
      setErr((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  return { busy, err, run, setErr };
}

/** D01 · 예약을 취소할까요? */
export function CancelDialog({ v, open, onClose, as = "guardian" }: { v: Visit; open: boolean; onClose: () => void; as?: "guardian" | "teacher" }) {
  const { run, busy, err } = useVisitAction();
  return (
    <Overlay open={open}>
      <h2 className="t24 font-bold">예약을 취소할까요?</h2>
      <p className="t16 mt-3 font-bold">{as === "guardian" ? `${v.teacher.name} 선생님` : v.household}</p>
      <p className="t16 mt-3">{v.date_label} {v.time_label}</p>
      <p className="t16 mt-3 text-muted">취소하면 이 방문을 시작할 수 없어요.<br />실제 비용을 결제하지 않은 시연입니다.</p>
      <ErrorText>{err}</ErrorText>
      <div className="mt-5 flex flex-col gap-3">
        <Button kind="secondary" onClick={onClose}>예약 유지하기</Button>
        <Button kind="danger" disabled={busy} onClick={async () => { if (await run(`/api/visits/${v.id}/cancel`)) onClose(); }}>방문 취소하기</Button>
      </div>
    </Overlay>
  );
}

/** P01 · 모의 결제 */
export function PayDialog({ v, open, onClose, onPaid }: { v: Visit; open: boolean; onClose: () => void; onPaid?: () => void }) {
  const { run, busy, err } = useVisitAction();
  return (
    <Overlay open={open} sheet>
      <h2 className="t24 font-bold">모의 결제</h2>
      <div className="mt-3"><Badge tone="WAIT">결제 대기</Badge></div>
      <p className="t16 mt-3 font-bold">{v.date_label} {v.time_label}</p>
      <p className="t16 mt-2 text-muted">{v.teacher.name} 선생님 · {v.kind === "regular" ? "정기" : "단발"} {v.hours}시간</p>
      <div className="t16 mt-4 flex justify-between border-t border-soft pt-4"><span>총 금액</span><b>{won(v.price)}</b></div>
      <Info className="mt-4">실제로 결제되지 않아요.{"\n"}카드·계좌 정보를 입력하지 않습니다.</Info>
      <ErrorText>{err}</ErrorText>
      <div className="mt-5 flex flex-col gap-3">
        <Button disabled={busy} onClick={async () => { if (await run(`/api/visits/${v.id}/pay`)) { onClose(); onPaid?.(); } }}>{won(v.price)} 모의 결제</Button>
        <Button kind="secondary" onClick={onClose}>나중에 결제하기</Button>
      </div>
    </Overlay>
  );
}

export function ConsentRow({ v, as }: { v: Visit; as: "guardian" | "teacher" }) {
  const { run, busy } = useVisitAction();
  const value = as === "guardian" ? v.consent.guardian : v.consent.teacher;
  return (
    <div aria-busy={busy}>
      <CheckRow checked={value} label="이번 방문의 영상 공유에 동의해요"
        onChange={(next) => run(`/api/visits/${v.id}/consent`, { value: next })} />
    </div>
  );
}

function Count({ label, n }: { label: string; n: number }) {
  return (
    <div className="t16 flex items-center justify-between border-b border-soft py-4 last:border-0">
      <span className="text-muted">{label}</span><b>{n}개</b>
    </div>
  );
}

/** S07 state bodies for the guardian (requested · payment · booked · reading · approved · live · draft · sent · cancelled · declined) */
export function GuardianVisitBody({ v }: { v: Visit }) {
  const router = useRouter();
  const [cancel, setCancel] = useState(false);
  const [pay, setPay] = useState(false);
  const name = v.teacher.name;
  const teacherTasks = v.tasks.filter((t) => t.kind === "school" && t.owner === "teacher");
  const guardianTasks = v.tasks.filter((t) => t.kind === "school" && t.owner === "guardian");
  const canCancel = ["requested", "payment", "booked"].includes(v.status);

  return (
    <div className="flex flex-col gap-4">
      {v.phase === "requested" && <Info>선생님이 방문 요청을 확인하고 있어요.{"\n"}수락하면 결제할 수 있어요.</Info>}
      {v.phase === "payment" && (
        <>
          <Info>{name} 선생님이 수락했어요.{"\n"}모의 결제를 마치면 방문이 확정돼요.</Info>
          <Button onClick={() => setPay(true)}>모의 결제하기</Button>
        </>
      )}
      {v.phase === "booked" && (
        <>
          <Card className="flex flex-col gap-3">
            <h3 className="t20 font-bold">등록한 통신문이 없어요</h3>
            <p className="t16 text-muted">통신문을 올리면 이번 방문에{"\n"}맡길 일을 골라 전달할 수 있어요.</p>
            <Button href={`/g/notice/new?visit=${v.id}`}>통신문 올리기</Button>
          </Card>
          <Card className="py-0">
            <Count label="선생님에게 맡긴 일" n={0} />
            <Count label="보호자 할 일" n={0} />
          </Card>
        </>
      )}
      {v.phase === "reading" && v.notice && (
        <>
          <Info>통신문을 읽고 있어요.{"\n"}아직 선생님에게 전달된 일은 없어요.</Info>
          <Button href={`/g/notice/${v.notice.id}`}>통신문 확인하기</Button>
        </>
      )}
      {v.phase === "approved" && (
        <>
          <Info>확인한 학교 할 일 {teacherTasks.length}개를{"\n"}{name} 선생님에게 전달했어요.</Info>
          <Card className="flex flex-col gap-2">
            <h3 className="t16 font-bold">선생님에게 맡긴 일 · {teacherTasks.length}개</h3>
            {teacherTasks.map((t) => <p key={t.id} className="t16">{t.title}</p>)}
            {teacherTasks.length === 0 && <p className="t16 text-muted">없어요</p>}
          </Card>
          <Card className="flex flex-col gap-2">
            <h3 className="t16 font-bold">보호자 할 일 · {guardianTasks.length}개</h3>
            {guardianTasks.map((t) => (
              <div key={t.id}>
                <p className="t16">{t.title}</p>
                {t.due_label && <p className="t14 mt-1 text-brand">기한 {t.due_label}</p>}
              </div>
            ))}
            {guardianTasks.length === 0 && <p className="t16 text-muted">없어요</p>}
          </Card>
          <Info>선생님에게는 준비물만 보여요.{"\n"}통신문 원문과 납부 항목은 전달되지 않아요.</Info>
        </>
      )}
      {v.phase === "live" && (
        <>
          <Info>{name} 선생님이 방문 중이에요.{"\n"}{v.consent.guardian && v.consent.teacher ? "양측 영상 공유 동의가 완료됐어요." : "영상 공유 동의가 없는 방문이에요."}</Info>
          {v.consent.guardian && v.consent.teacher
            ? <Button href={`/g/live/${v.id}`}>실시간 보기</Button>
            : <ConsentRow v={v} as="guardian" />}
        </>
      )}
      {v.phase === "draft" && <Info>선생님이 방문 기록을 확인하고 있어요.{"\n"}보내기 전의 초안은 볼 수 없어요.</Info>}
      {v.phase === "sent" && (
        <>
          <Info>{name} 선생님이 리포트를 보냈어요.</Info>
          <Button href={`/g/reports/${v.id}`}>리포트 보기</Button>
        </>
      )}
      {v.phase === "cancelled" && (
        <>
          <Info>이 방문은 취소됐어요.{"\n"}다른 선생님을 찾아보세요.</Info>
          <Button href="/g/find">다른 선생님 찾기</Button>
        </>
      )}
      {v.phase === "declined" && (
        <>
          <Info>선생님이 요청을 거절했어요.{"\n"}다른 선생님을 찾아보세요.</Info>
          <Button href="/g/find">다른 선생님 찾기</Button>
        </>
      )}

      {["booked", "reading", "approved"].includes(v.phase) && <ConsentRow v={v} as="guardian" />}
      {canCancel && <TextLink onClick={() => setCancel(true)}>예약 취소</TextLink>}

      <CancelDialog v={v} open={cancel} onClose={() => setCancel(false)} />
      <PayDialog v={v} open={pay} onClose={() => setPay(false)} onPaid={() => router.push(`/g/paid/${v.id}`)} />
    </div>
  );
}
