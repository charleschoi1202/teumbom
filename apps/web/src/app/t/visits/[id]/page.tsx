"use client";

import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { Page } from "@/components/shell";
import { AppBarDetail, BottomAction, Button, Card, CheckRow, ErrorText, Info, Loading, TextLink } from "@/components/ui";
import { ConsentRow, VisitCard, useVisitAction } from "@/components/visit";
import { useLive, useSession } from "@/lib/session";
import type { Task, Visit } from "@/lib/types";

/** S14 · 방문 할 일 (+ live · done · address) */
export default function VisitTasks({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { api } = useSession();
  const { data: v, setData } = useLive<Visit>(`/api/visits/${id}`);
  const { run, busy, err } = useVisitAction();
  const [showAddr, setShowAddr] = useState(false);

  if (!v) return <><AppBarDetail title="방문 할 일" back="/t/visits" /><Loading /></>;

  const live = v.status === "live";
  const school = v.tasks.filter((t) => t.kind === "school");
  const basic = v.tasks.filter((t) => t.kind === "basic");
  const doneAll = v.tasks.length > 0 && v.tasks.every((t) => t.done);

  async function toggle(t: Task, done: boolean) {
    setData({ ...v!, tasks: v!.tasks.map((x) => (x.id === t.id ? { ...x, done } : x)) });
    try { await api(`/api/tasks/${t.id}`, { method: "PATCH", json: { done } }); } catch { /* realtime refresh restores */ }
  }

  async function start() {
    const r = await run<Visit>(`/api/visits/${v!.id}/start`);
    if (r) setData(r);
  }

  return (
    <>
      <AppBarDetail title="방문 할 일" back="/t/visits" />
      <Page>
        <div className="flex flex-col gap-5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-8">
          <div className="flex flex-col gap-4">
            <VisitCard v={v} as="teacher" />
            {showAddr && v.address ? (
              <>
                <Card className="flex flex-col gap-2">
                  <p className="t18">{v.address}</p>
                  <p className="t14 text-muted">시연용 가상 주소입니다.</p>
                </Card>
                <Button kind="secondary" onClick={() => setShowAddr(false)}>주소 접기</Button>
                <p className="t16 text-muted">담당 선생님에게만 공개되는 방문지예요.</p>
              </>
            ) : v.address ? (
              <TextLink onClick={() => setShowAddr(true)}>방문지 보기 · {v.region.split(" ").pop()} 방문지</TextLink>
            ) : <p className="t14 text-muted">상세 주소는 예약 확정 후 보여요.</p>}
            {v.note && <Info>보호자 메모 · {v.note}</Info>}
            {v.status === "booked" && (
              <Card className="flex flex-col gap-1">
                <ConsentRow v={v} as="teacher" />
                <p className="t14 text-muted">
                  {v.consent.guardian ? "보호자는 영상 공유에 동의했어요." : "보호자가 아직 영상 공유에 동의하지 않았어요."}{"\n"}
                  둘 다 동의하면 방문 시작과 함께 이 휴대폰 카메라 영상이 보호자에게 실시간으로 전송돼요. 녹화하지 않아요.
                </p>
              </Card>
            )}
            {live && v.consent.guardian && v.consent.teacher && <Info>방문 중 · 카메라 영상이 보호자에게 실시간으로 전송되고 있어요.</Info>}
          </div>

          <div className="flex flex-col gap-4">
            <section className="flex flex-col">
              <h2 className="t20 font-bold">보호자가 맡긴 학교 일</h2>
              <p className="t18 mt-1 text-muted">{live ? "완료한 일만 체크해 주세요." : v.status === "booked" ? "방문을 시작하면 체크할 수 있어요." : "방문을 마쳤어요."}</p>
              {school.length === 0 && <p className="t16 mt-3 text-muted">아직 전달된 학교 일이 없어요.</p>}
              {school.map((t) => <CheckRow key={t.id} large checked={t.done} locked={!live} label={t.title} onChange={(d) => toggle(t, d)} />)}
            </section>
            <div className="h-px bg-soft" />
            <section className="flex flex-col">
              <h2 className="t20 font-bold">기본 활동</h2>
              {basic.map((t) => <CheckRow key={t.id} large checked={t.done} locked={!live} label={t.title} onChange={(d) => toggle(t, d)} />)}
              {basic.length === 0 && <p className="t16 mt-2 text-muted">숙제 확인 · 독서</p>}
            </section>
            <ErrorText>{err}</ErrorText>
          </div>
        </div>
        <BottomAction note={live && !doneAll ? "하지 못한 일은 체크하지 않고 기록할 수 있어요." : undefined}>
          {v.status === "booked" && <Button onClick={start} disabled={busy}>방문 시작</Button>}
          {live && <Button onClick={() => router.push(`/t/visits/${v.id}/record`)}>활동 기록하기</Button>}
          {(v.status === "draft" || v.status === "sent") && <Button href={`/t/visits/${v.id}/report`}>{v.status === "draft" ? "리포트 이어쓰기" : "보낸 리포트 보기"}</Button>}
          {v.status === "payment" && <Button disabled>보호자 결제 대기</Button>}
        </BottomAction>
      </Page>
    </>
  );
}
