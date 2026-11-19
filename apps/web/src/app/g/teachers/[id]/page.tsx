"use client";

import { use } from "react";
import { Icon } from "@/components/Icon";
import { Page } from "@/components/shell";
import { AppBarDetail, Avatar, BottomAction, Button, Card, Chip, Info, Loading } from "@/components/ui";
import { loadCriteria } from "@/lib/find";
import { useLive } from "@/lib/session";
import type { Teacher } from "@/lib/types";

/** S05 · 선생님 상세 */
export default function TeacherDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: t } = useLive<Teacher>(`/api/teachers/${id}`);
  const crit = typeof window !== "undefined" ? loadCriteria() : null;

  return (
    <>
      <AppBarDetail title={t ? `${t.name} 선생님` : "선생님"} back="/g/recommend" />
      <Page>
        {!t ? <Loading /> : (
          <div className="flex flex-col gap-5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
            <div className="flex flex-col gap-5">
              <Card className="flex flex-col gap-3">
                <div className="flex items-center gap-4">
                  <div className="flex h-[72px] w-[72px] items-center justify-center rounded-xl bg-blue-light"><Avatar initial={t.initial} size={56} /></div>
                  <div>
                    <p className="t24 font-bold">{t.name} 선생님</p>
                    <p className="t16 text-muted">{t.headline}</p>
                  </div>
                </div>
                <p className="t16 flex items-center gap-3 font-bold text-brand"><span className="text-brand-deep"><Icon name="shield" /></span>{t.qual_label}</p>
                <p className="t14 text-muted">
                  {[t.verified.training && "표준 교육", t.verified.shadow && "동반 시범 방문 완료"].filter(Boolean).join(" · ")}
                </p>
              </Card>
              <div>
                <h2 className="t20 font-bold">{t.title}</h2>
                <p className="t16 mt-2 text-muted">{t.intro}</p>
              </div>
              <div className="flex flex-wrap gap-2">{t.tags.map((g) => <Chip key={g} disabled>{g}</Chip>)}</div>
            </div>
            <div className="flex flex-col gap-5">
              {t.reasons.length > 0 || crit ? (
                <Card>
                  <h3 className="t16 font-bold">우리 가정에 추천된 이유</h3>
                  <ul className="t16 mt-2 list-disc pl-5">
                    {(t.reasons.length ? t.reasons : t.experience).map((r) => <li key={r}>{r}</li>)}
                    {crit?.tags.filter((g) => t.tags.includes(g)).slice(0, 2).map((g) => <li key={g}>요청 조건 ‘{g}’과 맞아요</li>)}
                  </ul>
                </Card>
              ) : null}
              <Card className="flex flex-col gap-2">
                <h3 className="t16 font-bold">자격 · 경력</h3>
                <p className="t16">{t.qual_kind} — {t.qual_detail}</p>
                <p className="t14 text-muted">지도 경력 {t.years}년 · 방문 가능 {t.days.join("·")} {t.start_time}~ · {t.region}</p>
              </Card>
              <Info>자격 원본 서류는 공개되지 않아요.{"\n"}운영자가 확인한 결과만 표시해요.</Info>
            </div>
          </div>
        )}
        <BottomAction>
          <Button href={t ? `/g/request/${t.id}` : undefined} disabled={!t}>이 선생님께 방문 요청</Button>
        </BottomAction>
      </Page>
    </>
  );
}
