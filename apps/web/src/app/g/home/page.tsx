"use client";

import Link from "next/link";
import { Icon } from "@/components/Icon";
import { BottomTabs, Page, RoleSwitchLink } from "@/components/shell";
import { AppBarRoot, Badge, Button, Card, Loading } from "@/components/ui";
import { VisitCard } from "@/components/visit";
import { useLive } from "@/lib/session";
import type { Me, Visit } from "@/lib/types";

/** S02 · 홈 (+ S02-sent) */
export default function Home() {
  const { data } = useLive<{ visits: Visit[] }>("/api/visits");
  const { data: me } = useLive<Me>("/api/me");
  const visits = data?.visits ?? [];
  const current = visits.find((v) => ["requested", "payment", "booked", "live", "draft"].includes(v.status));
  const justSent = !current ? visits.find((v) => v.status === "sent") : undefined;
  const city = me?.household.region.split(" ").pop() ?? "춘천시";

  return (
    <>
      <AppBarRoot title="홈" right={<RoleSwitchLink />} />
      <Page>
        {!data ? <Loading /> : justSent ? (
          <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
            <div className="flex flex-col gap-3 lg:col-span-2">
              <h2 className="t24 font-bold">오늘의 방문 기록이 도착했어요</h2>
              <div><Badge tone="SENT">리포트 발송 완료</Badge></div>
            </div>
            <VisitCard v={justSent} />
            <div className="flex flex-col gap-4">
              <Card className="flex flex-col gap-3">
                <p className="t16">{justSent.teacher.name} 선생님이 확인해서 보냈어요.</p>
                <Button href={`/g/reports/${justSent.id}`}>리포트 보기</Button>
              </Card>
              <Button kind="secondary" href="/g/find">다음 방문 선생님 찾기</Button>
            </div>
          </div>
        ) : (
          <>
            <Link href="/g/address" className="t14 flex items-center gap-2 text-muted">
              <span className="text-brand-deep"><Icon name="home" size={20} /></span>{city} · 내 방문지
            </Link>
            <div>
              <h2 className="t24 font-bold">안녕하세요, 보호자님</h2>
              <p className="t16 mt-1 text-muted">{current ? "다음 방문을 함께 준비해요." : "검증된 선생님이 아이의 방과후를 함께해요."}</p>
            </div>
            <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
              {current ? (
                <div className="flex flex-col gap-3">
                  <VisitCard v={current} />
                  <Button kind="secondary" href="/g/visits">방문 일정 보기</Button>
                </div>
              ) : (
                <Card className="flex flex-col gap-3">
                  <h3 className="t20 font-bold">아직 예약한 방문이 없어요</h3>
                  <p className="t16 text-muted">아이에게 필요한 도움을 말로 적으면{"\n"}AI가 조건을 정리해 선생님을 추천해요.</p>
                  <Button href="/g/find">선생님 찾기</Button>
                </Card>
              )}
              {current && current.phase === "reading" && current.notice && (
                <div className="flex flex-col gap-3 rounded-xl bg-blue-light p-4">
                  <h3 className="t20 flex items-center gap-2 font-bold"><span className="text-brand-deep"><Icon name="doc" /></span>확인할 통신문 1건</h3>
                  <p className="t16 text-muted">준비물과 납부 기한을 확인한 뒤{"\n"}선생님에게 맡길 일을 골라 주세요.</p>
                  <Button href={`/g/notice/${current.notice.id}`}>통신문 확인하기</Button>
                </div>
              )}
              {current && current.phase === "booked" && (
                <div className="flex flex-col gap-3 rounded-xl bg-blue-light p-4">
                  <h3 className="t20 flex items-center gap-2 font-bold"><span className="text-brand-deep"><Icon name="doc" /></span>가정통신문 올리기</h3>
                  <p className="t16 text-muted">사진 한 장이면 준비물과 마감일을{"\n"}선생님의 할 일로 정리해 드려요.</p>
                  <Button href={`/g/notice/new?visit=${current.id}`}>통신문 올리기</Button>
                </div>
              )}
              {current && current.phase === "live" && current.consent.guardian && current.consent.teacher && (
                <div className="flex flex-col gap-3 rounded-xl bg-live p-4">
                  <h3 className="t20 flex items-center gap-2 font-bold text-live-ink"><Icon name="video" />지금 방문 중이에요</h3>
                  <Button href={`/g/live/${current.id}`}>실시간 보기</Button>
                </div>
              )}
              {current && <Button kind="secondary" href="/g/find">새로운 선생님 찾기</Button>}
            </div>
          </>
        )}
      </Page>
      <BottomTabs role="guardian" />
    </>
  );
}
