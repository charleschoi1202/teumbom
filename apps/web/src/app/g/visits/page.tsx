"use client";

import { BottomTabs, Page, RoleSwitchLink } from "@/components/shell";
import { AppBarRoot, Button, Card, Loading, PhaseBadge } from "@/components/ui";
import { GuardianVisitBody, VisitCard } from "@/components/visit";
import { useLive } from "@/lib/session";
import type { Visit } from "@/lib/types";
import Link from "next/link";

/** S07 · 방문 일정 (모든 상태) */
export default function Visits() {
  const { data } = useLive<{ visits: Visit[] }>("/api/visits");
  const visits = data?.visits ?? [];
  const current = visits.find((v) => ["requested", "payment", "booked", "live", "draft"].includes(v.status)) ?? visits[0];
  const others = visits.filter((v) => v.id !== current?.id);

  return (
    <>
      <AppBarRoot title="방문 일정" right={<RoleSwitchLink />} />
      <Page>
        {!data ? <Loading /> : !current ? (
          <Card className="flex flex-col gap-3">
            <h2 className="t20 font-bold">예약한 방문이 없어요</h2>
            <p className="t16 text-muted">선생님을 찾아 방문을 요청해 보세요.</p>
            <Button href="/g/find">선생님 찾기</Button>
          </Card>
        ) : (
          <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-6">
            <div className="flex flex-col gap-4">
              <VisitCard v={current} price={current.phase === "booked"} />
              {others.length > 0 && (
                <div className="hidden flex-col gap-2 lg:flex">
                  <h3 className="t16 font-bold text-muted">지난 방문</h3>
                  {others.map((v) => <PastRow key={v.id} v={v} />)}
                </div>
              )}
            </div>
            <GuardianVisitBody v={current} />
            {others.length > 0 && (
              <div className="flex flex-col gap-2 lg:hidden">
                <h3 className="t16 font-bold text-muted">지난 방문</h3>
                {others.map((v) => <PastRow key={v.id} v={v} />)}
              </div>
            )}
          </div>
        )}
      </Page>
      <BottomTabs role="guardian" />
    </>
  );
}

function PastRow({ v }: { v: Visit }) {
  return (
    <Link href={v.status === "sent" ? `/g/reports/${v.id}` : "/g/visits"}
      className="flex items-center justify-between rounded-xl border border-soft bg-surface px-4 py-3">
      <div>
        <p className="t16 font-bold">{v.short_date} {v.start}</p>
        <p className="t14 text-muted">{v.teacher.name} 선생님</p>
      </div>
      <PhaseBadge phase={v.phase} />
    </Link>
  );
}
