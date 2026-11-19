"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { BottomTabs, Page, RoleSwitchLink } from "@/components/shell";
import { AppBarRoot, Badge, Chip, Info, Loading } from "@/components/ui";
import { useLive } from "@/lib/session";
import type { ReportItem } from "@/lib/types";

/** S11 · 받은 리포트 (+ S11-empty) */
export default function Reports() {
  const { data } = useLive<{ reports: ReportItem[] }>("/api/reports");
  const [filter, setFilter] = useState<"all" | "month">("all");
  const now = new Date();
  const list = (data?.reports ?? []).filter((r) => filter === "all" || Number(r.short_date.split(".")[0]) === now.getMonth() + 1);

  return (
    <>
      <AppBarRoot title="받은 리포트" right={<RoleSwitchLink />} />
      <Page>
        {!data ? <Loading /> : data.reports.length === 0 ? (
          <div className="flex flex-col gap-3 lg:max-w-[560px]">
            <span className="text-brand-deep"><Icon name="doc" size={40} /></span>
            <h2 className="t24 font-bold">아직 받은 리포트가 없어요</h2>
            <p className="t16 text-muted">선생님이 방문 기록을 확인해서 보내면 여기에 표시돼요.</p>
            <Info>작성 중인 초안은 공개되지 않아요.</Info>
          </div>
        ) : (
          <>
            <h2 className="t24 font-bold">우리 아이의 방문 기록</h2>
            <div className="flex gap-2">
              <Chip selected={filter === "all"} onClick={() => setFilter("all")}>전체</Chip>
              <Chip selected={filter === "month"} onClick={() => setFilter("month")}>이번 달</Chip>
            </div>
            <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-4">
              {list.map((r) => (
                <Link key={r.visit_id} href={`/g/reports/${r.visit_id}`} className="flex flex-col gap-2 rounded-xl border border-soft bg-surface p-4">
                  {!r.read && <div><Badge tone="SENT">새 리포트 1</Badge></div>}
                  <p className="t20 font-bold">{r.date_label}</p>
                  <p className="t14 text-muted">{r.teacher} 선생님{r.read ? " · 읽음" : ""}</p>
                  <p className="t14 text-muted">{r.activity[0] ?? "방문 기록"}</p>
                  <span className="t16 flex items-center justify-between font-bold text-brand">리포트 보기<span className="text-brand-deep"><Icon name="arrow" /></span></span>
                </Link>
              ))}
            </div>
            <p className="t14 text-muted">선생님이 확인해서 보낸 리포트만 표시해요.</p>
          </>
        )}
      </Page>
      <BottomTabs role="guardian" />
    </>
  );
}
