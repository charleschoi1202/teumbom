"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { Page } from "@/components/shell";
import { AppBarDetail, BottomAction, Button, Card, CheckRow, Chip, ErrorText, Field, Loading, inputCls, won } from "@/components/ui";
import { cityOf, defaultCriteria, endTime, loadCriteria, longDate, type Criteria } from "@/lib/find";
import { useLive, useSession } from "@/lib/session";
import type { Me, Teacher, Visit } from "@/lib/types";

/** S06 · 방문 요청하기 */
export default function RequestVisit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { api } = useSession();
  const router = useRouter();
  const { data: t } = useLive<Teacher>(`/api/teachers/${id}`);
  const { data: me } = useLive<Me>("/api/me");
  const [c, setC] = useState<Criteria | null>(null);
  const [kind, setKind] = useState<"single" | "regular">("single");
  const [note, setNote] = useState("");
  const [video, setVideo] = useState(false);
  const [record, setRecord] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!me) return;
    const crit = loadCriteria() ?? defaultCriteria(me.household.region);
    setC(crit);
    setVideo(!!crit.video);
    setRecord(!!crit.record);
  }, [me]);

  async function send() {
    if (!c || !t) return;
    setBusy(true);
    setErr("");
    try {
      await api<Visit>("/api/visits", { method: "POST", json: { teacher_id: t.id, date: c.date, start: c.start, kind, note, tags: c.tags, video, record: video && record } });
      router.push("/g/visits");
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  const price = kind === "regular" ? 60000 : 70000;

  return (
    <>
      <AppBarDetail title="방문 요청하기" />
      <Page>
        {!t || !c || !me ? <Loading /> : (
          <div className="flex flex-col gap-5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
            <div className="flex flex-col gap-5">
              <Card className="flex flex-col gap-2">
                <p className="t20 font-bold">{t.name} 선생님</p>
                <p className="t16 font-bold">{longDate(c.date)} {c.start}–{endTime(c.start)}</p>
                <p className="t14 text-muted">{t.background} · {cityOf(c.region)} · {me.household.child_desc}</p>
                {c.tags.length > 0 && <p className="t14 text-brand">{c.tags.join(" · ")}</p>}
              </Card>
              <div className="flex flex-col gap-3">
                <h2 className="t20 font-bold">이용 유형</h2>
                <div className="flex gap-2">
                  <Chip selected={kind === "single"} onClick={() => setKind("single")}>단발 70,000원</Chip>
                  <Chip selected={kind === "regular"} onClick={() => setKind("regular")}>정기 60,000원</Chip>
                </div>
                <p className="t14 text-muted">
                  {kind === "single" ? "단발 · 아이 한 명 · 3시간\n필요할 때 한 번 이용해요." : "같은 선생님과 주 1회 이상 · 4주 이상 예약할 때 적용돼요.\n이번 시연에서는 첫 방문만 요청해요."}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-5">
              <Card className="flex flex-col gap-2">
                <p className="t16">{me.household.address}, {me.household.address_detail}</p>
                <Link href="/g/address" className="t16 font-bold text-brand">방문지 변경</Link>
              </Card>
              <Field label="선생님께 전할 메모 · 선택">
                <input className={inputCls} value={note} maxLength={300} placeholder="예: 개미 관찰을 정말 좋아해요." onChange={(e) => setNote(e.target.value)} />
              </Field>
              <div className="rounded-xl border border-soft bg-surface px-3">
                <CheckRow checked={video} onChange={(v) => { setVideo(v); if (!v) setRecord(false); }} label="실시간 영상 공유 (선택)" />
                {video && <CheckRow checked={record} onChange={setRecord} label="녹화도 원해요 (선택 · 보호자 휴대폰에만 저장)" />}
              </div>
              <p className="t14 -mt-3 text-muted">영상은 선생님도 동의해야 켜져요. 고르지 않아도 방문과 리포트는 그대로예요.</p>
              <div className="t16 flex items-center justify-between"><span className="text-muted">이용 금액</span><b>{won(price)}</b></div>
              <ErrorText>{err}</ErrorText>
            </div>
          </div>
        )}
        <BottomAction note="선생님이 수락하면 모의 결제로 방문을 확정해요.">
          <Button onClick={send} disabled={busy || !t || !c}>{busy ? "요청을 보내는 중…" : "방문 요청 보내기"}</Button>
        </BottomAction>
      </Page>
    </>
  );
}
