"use client";

import { Icon } from "@/components/Icon";
import { BottomTabs, Page, RoleSwitchLink } from "@/components/shell";
import { AppBarRoot, Badge, Button, Card, Chip, Loading } from "@/components/ui";
import { useLive } from "@/lib/session";
import type { Me } from "@/lib/types";

/** S17 · 내 프로필 · 확인 현황 (자격은 선택, 신원·범죄경력 확인은 필수) */
export default function Credential() {
  const { data: me } = useLive<Me>("/api/me");
  const t = me?.teacher;
  return (
    <>
      <AppBarRoot title="내 프로필" right={<RoleSwitchLink />} />
      <Page className="lg:max-w-[720px]">
        {!t ? <Loading /> : (
          <>
            <div><Badge tone="SENT">활동 확인 완료</Badge></div>
            <div>
              <h2 className="t24 font-bold">{t.name} 선생님</h2>
              <p className="t16 text-muted">{t.background} · {t.region}</p>
            </div>
            <Card className="flex flex-col gap-2">
              <h3 className="t16 font-bold">나의 이야기</h3>
              <p className="t16">{t.story}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {t.interests.map((g) => <Chip key={g} selected>{g}</Chip>)}
                {t.traits.map((g) => <Chip key={g} disabled>{g}</Chip>)}
              </div>
              <p className="t14 mt-1 text-muted">보호자는 이 이야기와 관심 테마로 선생님을 찾아요.</p>
            </Card>
            <Card className="py-1">
              {[["신원 확인 · 확인 완료", true], ["범죄경력 조회 결과 · 확인 완료", true], ["안전 교육 · 동반 시범 방문 완료", true]].map(([d]) => (
                <p key={String(d)} className="t16 flex items-center gap-3 border-b border-soft py-3 last:border-0">
                  <span className="text-brand-deep"><Icon name="check" /></span>{d}
                </p>
              ))}
              <p className="t16 flex items-center gap-3 py-3 text-muted">
                <Icon name="doc" />자격 (선택) · {t.qual_detail || "등록한 자격증 없음 — 괜찮아요"}
              </p>
            </Card>
            <p className="t16 text-muted">승인된 시연 계정입니다.{"\n"}서류 원본은 다른 가정과 선생님에게 공개되지 않아요.</p>
            <Button kind="secondary" href="/t/profile">이야기·관심사 수정</Button>
          </>
        )}
      </Page>
      <BottomTabs role="teacher" />
    </>
  );
}
