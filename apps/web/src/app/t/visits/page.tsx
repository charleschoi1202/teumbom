"use client";

import Link from "next/link";
import { useState } from "react";
import { BottomTabs, Page, RoleSwitchLink } from "@/components/shell";
import { AppBarRoot, Badge, Button, Chip, ErrorText, Info, Loading, TextLink } from "@/components/ui";
import { CancelDialog, VisitCard, useVisitAction } from "@/components/visit";
import { useLive } from "@/lib/session";
import type { Me, Visit } from "@/lib/types";

/** S13 · 방문 일정 (선생님) + accepted · booked · draft · sent · declined · cancelled */
export default function TeacherVisits() {
  const { data } = useLive<{ visits: Visit[] }>("/api/visits");
  const { data: me } = useLive<Me>("/api/me");
  const visits = data?.visits ?? [];
  const requests = visits.filter((v) => v.status === "requested");
  const mine = visits.filter((v) => v.status !== "requested");
  const [tab, setTab] = useState<"new" | "mine" | null>(null);
  const current = tab ?? (requests.length ? "new" : "mine");

  return (
    <>
      <AppBarRoot title="방문 일정" right={<RoleSwitchLink />} />
      <Page>
        <h2 className="t20 font-bold">{me?.name ?? "김하늘"} 선생님, 안녕하세요</h2>
        <div className="flex flex-wrap gap-2">
          <Link href="/t/profile" className="t14 inline-flex h-12 items-center rounded-[10px] border border-soft bg-surface px-4 text-muted">내 프로필</Link>
          <Link href="/t/schedule" className="t14 inline-flex h-12 items-center rounded-[10px] border border-soft bg-surface px-4 text-muted">가능 시간·지역</Link>
        </div>
        <div className="flex gap-2">
          <Chip selected={current === "new"} onClick={() => setTab("new")}>새 요청{requests.length ? ` ${requests.length}` : ""}</Chip>
          <Chip selected={current === "mine"} onClick={() => setTab("mine")}>내 방문</Chip>
        </div>
        {!data ? <Loading /> : current === "new" ? (
          requests.length === 0 ? (
            <Info>새로 들어온 방문 요청이 없어요.{"\n"}보호자가 요청하면 이 화면에 바로 나타나요.</Info>
          ) : (
            <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2">
              {requests.map((v) => <RequestCard key={v.id} v={v} />)}
            </div>
          )
        ) : mine.length === 0 ? (
          <Info>아직 수락한 방문이 없어요.</Info>
        ) : (
          <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start">
            {mine.map((v) => <MineCard key={v.id} v={v} />)}
          </div>
        )}
      </Page>
      <BottomTabs role="teacher" />
    </>
  );
}

function RequestCard({ v }: { v: Visit }) {
  const { run, busy, err } = useVisitAction();
  const [cancel, setCancel] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <div><Badge tone="WAIT">응답 필요</Badge></div>
      <p className="t18">{v.date_label} {v.time_label}</p>
      <p className="t18">{v.region.split(" ").pop()} · {v.child_desc}</p>
      {v.tags.length > 0 && <p className="t16 text-muted">{v.tags.join(" · ")}</p>}
      {v.note && <p className="t18">{v.note}</p>}
      <div className="grid grid-cols-2 gap-3">
        <Button disabled={busy} onClick={() => run(`/api/visits/${v.id}/accept`)}>수락하기</Button>
        <Button kind="secondary" disabled={busy} onClick={() => run(`/api/visits/${v.id}/decline`)}>거절하기</Button>
      </div>
      <ErrorText>{err}</ErrorText>
      <TextLink onClick={() => setCancel(true)}>더보기 · 예약 취소</TextLink>
      <div className="h-px bg-soft" />
      <Info>수락 후 보호자가 모의 결제를 마쳐야{"\n"}방문이 확정됩니다. 상세 주소는 확정 후 보여요.</Info>
      <CancelDialog v={v} open={cancel} onClose={() => setCancel(false)} as="teacher" />
    </div>
  );
}

function MineCard({ v }: { v: Visit }) {
  const [cancel, setCancel] = useState(false);
  const school = v.tasks.filter((t) => t.kind === "school").length;
  return (
    <div className="flex flex-col gap-3">
      <VisitCard v={v} as="teacher" />
      {v.status === "payment" && (
        <>
          <p className="t18">수락했어요. 보호자의 모의 결제를 기다려 주세요.</p>
          <p className="t14 text-muted">보호자가 결제해야 방문이 확정돼요.</p>
          <Button disabled>방문 시작</Button>
        </>
      )}
      {v.status === "booked" && (
        <>
          <p className="t18">{school ? `보호자가 맡긴 학교 할 일 ${school}개가 도착했어요.` : "방문이 확정됐어요. 방문 할 일을 확인해 주세요."}</p>
          <Button href={`/t/visits/${v.id}`}>방문 할 일 보기</Button>
        </>
      )}
      {v.status === "live" && (
        <>
          <p className="t18">방문 중이에요. 완료한 일을 체크해 주세요.</p>
          <Button href={`/t/visits/${v.id}`}>방문 할 일 보기</Button>
        </>
      )}
      {v.status === "draft" && (
        <>
          <p className="t18">방문을 종료했어요. 기록을 확인하고 리포트를 보내 주세요.</p>
          <Button href={`/t/visits/${v.id}/report`}>리포트 이어쓰기</Button>
        </>
      )}
      {v.status === "sent" && (
        <>
          <p className="t18">리포트를 보냈어요.{"\n"}{v.date_label.replace(/ \(.\)$/, "")} {v.report?.sent_at} 발송</p>
          <Button href={`/t/visits/${v.id}/report`}>리포트 열기</Button>
        </>
      )}
      {v.status === "declined" && <p className="t18">요청을 거절했어요. 이 방문은 시작할 수 없어요.</p>}
      {v.status === "cancelled" && <p className="t18">예약이 취소됐어요. 이 방문은 시작할 수 없어요.</p>}
      {["payment", "booked"].includes(v.status) && <TextLink onClick={() => setCancel(true)}>예약 취소</TextLink>}
      <CancelDialog v={v} open={cancel} onClose={() => setCancel(false)} as="teacher" />
    </div>
  );
}
