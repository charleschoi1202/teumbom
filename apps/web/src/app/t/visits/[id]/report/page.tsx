"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { Page } from "@/components/shell";
import { AppBarDetail, Badge, BottomAction, Button, Card, CheckRow, ErrorText, Loading, textareaCls } from "@/components/ui";
import { useLive, useSession } from "@/lib/session";
import type { Visit } from "@/lib/types";

type Draft = { activity: string[]; message: string; sent: boolean; sent_at?: string };

/** S16 · 리포트 보내기 (+ ready · sent) */
export default function SendReport({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { api, token } = useSession();
  const { data: v } = useLive<Visit>(`/api/visits/${id}`);
  const [d, setD] = useState<Draft | null>(null);
  const [msg, setMsg] = useState("");
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!token || !v || d) return;
    if (!["draft", "sent"].includes(v.status)) return;
    api<Draft>(`/api/visits/${id}/report/draft`, { method: "POST" })
      .then((r) => { setD(r); setMsg(r.message); })
      .catch((e: Error) => setErr(e.message));
  }, [api, token, id, v, d]);

  async function send() {
    setBusy(true);
    setErr("");
    try {
      const r = await api<{ sent_at: string }>(`/api/visits/${id}/report/send`, { method: "POST", json: { message: msg, confirmed: checked } });
      setD({ ...d!, sent: true, sent_at: r.sent_at, message: msg });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!v) return <><AppBarDetail title="리포트 보내기" /><Loading /></>;
  const day = v.date_label.replace(/ \(.\)$/, "");

  if (!["draft", "sent"].includes(v.status)) {
    return (
      <>
        <AppBarDetail title="리포트 보내기" back={`/t/visits/${v.id}`} />
        <Page><p className="t16 text-muted">방문을 종료한 뒤 리포트를 보낼 수 있어요.</p></Page>
      </>
    );
  }

  const sent = d?.sent;
  return (
    <>
      <AppBarDetail title="리포트 보내기" back="/t/visits" />
      <Page>
        <div>{sent ? <Badge tone="SENT">리포트 발송 완료</Badge> : <Badge tone="DRAFT">발송 전 초안</Badge>}</div>
        <h2 className="t20 font-bold">{day} · {v.household}</h2>
        {sent && <p className="t16 text-sent-ink">{d?.sent_at}에 보호자에게 보냈어요.</p>}
        {!d ? <Loading label="기록으로 리포트 초안을 만드는 중이에요" /> : (
          <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
            <Card className="flex flex-col gap-1">
              <h3 className="t16 font-bold">활동 기록</h3>
              {d.activity.length ? d.activity.map((a) => <p key={a} className="t18">{a}</p>) : <p className="t16 text-muted">기록 없음</p>}
              {!sent && <Link href={`/t/visits/${v.id}/record`} className="t16 mt-3 font-bold text-brand">기록 보완하기</Link>}
            </Card>
            <Card className="flex flex-col gap-2">
              <h3 className="t16 font-bold">{sent ? "보낸 리포트" : "보호자에게 보낼 내용"}</h3>
              {sent ? <p className="t18">{d.message}</p> : (
                <>
                  <textarea rows={4} className={`${textareaCls} t18`} value={msg} maxLength={1000} onChange={(e) => setMsg(e.target.value)} />
                  <p className="t14 text-muted">발송 전까지 이 문장을 수정할 수 있어요. 초안은 선생님이 기록한 내용으로만 만들었어요.</p>
                </>
              )}
            </Card>
          </div>
        )}
        {!sent && d && <CheckRow checked={checked} onChange={setChecked} label="활동 기록과 최종 내용을 대조했어요" />}
        <ErrorText>{err}</ErrorText>
        <BottomAction note={!sent && !checked ? "활동 기록과 대조한 뒤 보낼 수 있어요." : undefined}>
          {sent ? <Button kind="secondary" href="/t/visits">방문 일정으로</Button>
            : <Button onClick={send} disabled={!checked || busy || !msg.trim()}>확인한 리포트 보내기</Button>}
        </BottomAction>
      </Page>
    </>
  );
}
