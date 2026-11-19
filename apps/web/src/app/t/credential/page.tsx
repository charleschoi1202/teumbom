"use client";

import { Icon } from "@/components/Icon";
import { BottomTabs, Page, RoleSwitchLink } from "@/components/shell";
import { AppBarRoot, Badge, Button, Card, Loading } from "@/components/ui";
import { useLive } from "@/lib/session";
import type { Me } from "@/lib/types";

/** S17 · 교원 자격 */
export default function Credential() {
  const { data: me } = useLive<Me>("/api/me");
  const t = me?.teacher;
  const certified = t?.qual_type === "certified";
  const docs = certified
    ? ["교원 자격증 · 확인 완료", "경력증명서 · 확인 완료", "범죄경력 조회 결과 · 확인 완료"]
    : ["자격증(보육교사·아이돌봄사 등) · 확인 완료", "아동 지도 경력증명서 · 확인 완료", "범죄경력 조회 결과 · 확인 완료"];
  return (
    <>
      <AppBarRoot title="교원 자격" right={<RoleSwitchLink />} />
      <Page className="lg:max-w-[640px]">
        {!t ? <Loading /> : (
          <>
            <div><Badge tone="SENT">{t.qual_label}</Badge></div>
            <h2 className="t24 font-bold">{t.name} 선생님</h2>
            <p className="t16 -mt-3 text-muted">{t.qual_kind} · {t.qual_detail}</p>
            <Card className="py-1">
              {docs.map((d) => (
                <p key={d} className="t16 flex items-center gap-3 border-b border-soft py-3 last:border-0">
                  <span className="text-brand-deep"><Icon name="check" /></span>{d}
                </p>
              ))}
            </Card>
            <Card className="flex flex-col gap-3">
              <p className="t16 font-bold">{t.verified.training ? "표준 교육 완료" : "표준 교육 대기"}</p>
              <p className="t16 font-bold">{t.verified.shadow ? "동반 시범 방문 완료" : "동반 시범 방문 대기"}</p>
            </Card>
            <p className="t16 text-muted">승인된 시연 계정입니다.{"\n"}서류 원본은 다른 가정과 선생님에게 공개되지 않아요.</p>
            <Button kind="secondary" href="/t/profile">내 프로필 수정</Button>
          </>
        )}
      </Page>
      <BottomTabs role="teacher" />
    </>
  );
}
