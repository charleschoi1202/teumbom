"use client";

import { use, useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { Page } from "@/components/shell";
import { TeacherBadges } from "@/components/TeacherBadges";
import { AppBarDetail, Avatar, BottomAction, Button, Card, Chip, Info, Loading } from "@/components/ui";
import { loadCriteria } from "@/lib/find";
import { useLive, useSession } from "@/lib/session";
import type { Teacher } from "@/lib/types";

/** S05 · 선생님 상세 — 이 사람이 살아온 이야기 */
export default function TeacherDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { api, token } = useSession();
  const { data: t } = useLive<Teacher>(`/api/teachers/${id}`);
  const [why, setWhy] = useState<Teacher | null>(null);

  // reasons are computed against this family's request
  useEffect(() => {
    const c = loadCriteria();
    if (!c || !token) return;
    api<{ teachers: Teacher[] }>("/api/match/recommend", {
      method: "POST", json: { region: c.region, date: c.date, start: c.start, text: c.text, tags: c.tags, credentialed_only: false },
    }).then((r) => setWhy(r.teachers.find((x) => String(x.id) === id) ?? null)).catch(() => {});
  }, [api, token, id]);

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
                    <p className="t16 text-muted">{t.background}</p>
                  </div>
                </div>
                <TeacherBadges t={t} />
              </Card>
              <div>
                <h2 className="t20 font-bold">{t.headline}</h2>
                <p className="t16 mt-2 whitespace-pre-line">{t.story}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {t.interests.map((g) => <Chip key={g} selected>{g}</Chip>)}
                {t.traits.map((g) => <Chip key={g} disabled>{g}</Chip>)}
              </div>
            </div>
            <div className="flex flex-col gap-5">
              {why && (
                <Card>
                  <h3 className="t16 font-bold">우리 아이와 맞는 이유 · {why.score}점</h3>
                  <ul className="t16 mt-2 flex list-disc flex-col gap-1 pl-5">
                    {why.reasons.map((r) => <li key={r}>{r}</li>)}
                  </ul>
                </Card>
              )}
              <Card className="flex flex-col gap-2">
                <h3 className="t16 font-bold">확인 현황</h3>
                <p className="t16 flex items-center gap-2"><span className="text-brand-deep"><Icon name="check" size={20} /></span>신원 확인 · 범죄경력 조회 (필수)</p>
                <p className="t16 flex items-center gap-2"><span className="text-brand-deep"><Icon name="check" size={20} /></span>안전 교육 · 동반 시범 방문</p>
                <p className="t16 flex items-center gap-2 text-muted"><Icon name="doc" size={20} />자격 (선택) · {t.qual_detail || "자격증 없음 · 경험과 이야기로 활동"}</p>
                <p className="t14 text-muted">아이들과 함께한 시간 {t.years}년 · 방문 가능 {t.days.join("·")} {t.start_time}~ · {t.region}</p>
              </Card>
              <Info>원본 서류는 공개되지 않아요.{"\n"}운영자가 확인한 결과만 표시해요.</Info>
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
