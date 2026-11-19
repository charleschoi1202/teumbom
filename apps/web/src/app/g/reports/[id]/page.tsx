"use client";

import { use } from "react";
import { Icon } from "@/components/Icon";
import { Page } from "@/components/shell";
import { AppBarDetail, Badge, Card, Loading } from "@/components/ui";
import { useLive } from "@/lib/session";
import type { ReportItem } from "@/lib/types";

/** S12 · 방문 리포트 (+ S12-previous) */
export default function ReportView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: r, error } = useLive<ReportItem>(`/api/visits/${id}/report`);
  const { data: all } = useLive<{ reports: ReportItem[]; week: { reading_min: number; visits: number } }>("/api/reports");

  return (
    <>
      <AppBarDetail title="방문 리포트" back="/g/reports" />
      <Page>
        {error ? <p className="t16 text-muted">{error}</p> : !r ? <Loading /> : (
          <>
            <div><Badge tone="SENT">리포트 발송 완료</Badge></div>
            <div>
              <h2 className="t24 font-bold">{r.date_label} {r.time_label}</h2>
              <p className="t14 mt-1 text-muted">{r.teacher} 선생님 · {r.sent_at} 발송</p>
            </div>
            <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
              <div className="flex flex-col gap-4">
                <Card className="flex flex-col gap-3">
                  <h3 className="t20 font-bold">오늘 함께한 활동</h3>
                  {r.theme_activity && <div className="t16 flex justify-between"><span>{r.theme_activity}</span><b>{r.theme_min ? `${r.theme_min}분` : "완료"}</b></div>}
                  {r.homework != null && <div className="t16 flex justify-between"><span>숙제</span><b>{r.homework}개</b></div>}
                  {r.reading_min != null && <div className="t16 flex justify-between"><span>독서</span><b>{r.reading_min}분</b></div>}
                  {r.school_done.length > 0 && <div className="h-px bg-soft" />}
                  {r.school_done.map((t) => (
                    <p key={t} className="t16 flex items-center gap-3"><span className="text-brand-deep"><Icon name="check" /></span>{t} · 완료</p>
                  ))}
                </Card>
                <Card className="flex flex-col gap-2">
                  <h3 className="t20 font-bold">선생님이 남긴 말</h3>
                  <p className="t16">{r.message}</p>
                </Card>
              </div>
              {all && (
                <Card className="flex flex-col gap-1">
                  <h3 className="t16 font-bold">이번 주 기록 합계</h3>
                  <p className="t24 mt-2 font-bold text-brand">독서 {all.week.reading_min}분</p>
                  <p className="t14 mt-1 text-muted">확인된 방문 {all.week.visits}회 기준{"\n"}미기록 값은 합계에서 제외해요.</p>
                </Card>
              )}
            </div>
            <p className="t14 text-muted">선생님이 실제 기록과 대조한 내용입니다.</p>
          </>
        )}
      </Page>
    </>
  );
}
