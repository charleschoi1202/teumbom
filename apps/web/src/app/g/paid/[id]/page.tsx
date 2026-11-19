"use client";

import { use } from "react";
import { Icon } from "@/components/Icon";
import { Page } from "@/components/shell";
import { AppBarDetail, BottomAction, Button, Card, Loading, won } from "@/components/ui";
import { VisitCard } from "@/components/visit";
import { useLive } from "@/lib/session";
import type { Visit } from "@/lib/types";

/** P02 · 결제 완료 */
export default function Paid({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: v } = useLive<Visit>(`/api/visits/${id}`);
  return (
    <>
      <AppBarDetail title="결제 완료" back="/g/visits" />
      <Page className="lg:max-w-[560px]">
        {!v ? <Loading /> : (
          <>
            <span className="text-brand-deep"><Icon name="check" size={40} /></span>
            <div>
              <h2 className="t24 font-bold">방문이 확정됐어요</h2>
              <p className="t16 mt-2 text-muted">{v.teacher.name} 선생님과 함께{"\n"}방문을 준비해 보세요.</p>
            </div>
            <VisitCard v={v} />
            <Card className="flex flex-col gap-2">
              <div className="t16 flex justify-between"><span>모의 결제 금액</span><b>{won(v.price)}</b></div>
              <p className="t14 text-muted">실제 청구 0원 · 시연용 결제</p>
            </Card>
          </>
        )}
        <BottomAction><Button href="/g/visits">확정한 방문 보기</Button></BottomAction>
      </Page>
    </>
  );
}
