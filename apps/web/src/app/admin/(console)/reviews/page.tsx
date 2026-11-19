"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { Badge, Button, Card, CheckRow, ErrorText, Info, Loading, cx, inputCls } from "@/components/ui";
import { useSession } from "@/lib/session";

type Review = {
  id: number; name: string; applied: string; received: string; doc_title: string; doc_text: string;
  extracted: { name: string; qualification: string; qual_type: string; career: string };
  checked_original: boolean; checked_crime: boolean; request_note: string; status: "pending" | "approved" | "requested";
};

function Header() {
  return (
    <div className="flex items-center justify-between px-5 pt-6 lg:px-0 lg:pt-8">
      <h1 className="t24 font-bold">교원 서류 심사</h1>
      <span className="t14 rounded-md bg-disabled px-2 py-1 text-muted">가상 자료 · 운영 연동 전</span>
    </div>
  );
}

/** S18 · 교원 서류 심사 (+ ready · done) */
export default function Reviews() {
  const { api, token } = useSession();
  const [list, setList] = useState<Review[] | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [done, setDone] = useState<Review | null>(null);

  useEffect(() => {
    if (!token) return;
    api<{ reviews: Review[] }>("/api/admin/reviews").then((r) => {
      setList(r.reviews);
      setSel((s) => s ?? r.reviews.find((x) => x.status === "pending")?.id ?? r.reviews[0]?.id ?? null);
    }).catch((e: Error) => setErr(e.message));
  }, [api, token]);

  const r = list?.find((x) => x.id === sel);

  async function update(json: Record<string, unknown>) {
    if (!r) return;
    setErr("");
    try {
      const next = await api<Review>(`/api/admin/reviews/${r.id}`, { method: "POST", json });
      setList(list!.map((x) => (x.id === next.id ? next : x)));
      if (json.action === "approve" || json.action === "request") setDone(next);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  if (done) {
    return (
      <>
        <Header />
        <div className="flex flex-col gap-6 px-5 py-6 lg:px-0">
          <div><Badge tone={done.status === "approved" ? "SENT" : "WAIT"}>{done.status === "approved" ? "승인 완료" : "보완 요청"}</Badge></div>
          <h2 className="t24 font-bold">{done.name}의 교원 자격 심사를 마쳤어요.</h2>
          <Info>{done.status === "approved" ? "원본 서류와 필수 검증 결과를 확인한 시연 상태입니다." : `보완 요청: ${done.request_note}`}</Info>
          <Button kind="secondary" onClick={() => setDone(null)}>심사 목록으로</Button>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="flex flex-col gap-5 px-5 py-6 lg:px-0">
        {!list ? <Loading /> : (
          <>
            <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[188px_minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
              <div className="flex flex-col gap-3">
                {list.map((x) => (
                  <button key={x.id} type="button" onClick={() => { setSel(x.id); setNote(x.request_note); }}
                    className={cx("flex flex-col gap-2 rounded-xl border bg-surface p-4 text-left", x.id === sel ? "border-brand" : "border-soft")}>
                    <span className="t20 font-bold">심사 대기 {x.id}</span>
                    <span><Badge tone={x.status === "approved" ? "SENT" : x.status === "requested" ? "ERROR" : "WAIT"}>{x.status === "approved" ? "승인 완료" : x.status === "requested" ? "보완 요청" : "심사 중"}</Badge></span>
                    <span className="t20 font-bold">{x.name}</span>
                    <span className="t14 text-muted">{x.applied}</span>
                    <span className="t14 text-muted">{x.received} 접수</span>
                  </button>
                ))}
              </div>
              {r && (
                <>
                  <Card className="flex flex-col gap-3">
                    <h3 className="t16 font-bold">원본 · {r.doc_title}</h3>
                    <div className="flex min-h-[240px] flex-col gap-3 border border-line p-4">
                      <span className="text-brand-deep"><Icon name="doc" size={40} /></span>
                      <pre className="t16 whitespace-pre-wrap font-sans">{r.doc_text}</pre>
                      <p className="t14 mt-auto text-muted">시연용 원본 자리</p>
                    </div>
                  </Card>
                  <Card className="flex flex-col gap-3">
                    <h3 className="t16 font-bold">추출 결과 <span className="t14 font-normal text-muted">· AI 서류 검토 보조</span></h3>
                    {([["이름", r.extracted.name], ["자격 종류", r.extracted.qualification], ["확인된 경력", r.extracted.career]] as const).map(([k, v]) => (
                      <label key={k} className="flex flex-col gap-2">
                        <span className="t14 text-muted">{k}</span>
                        <input className={inputCls} defaultValue={v} />
                      </label>
                    ))}
                    <p className="t14 text-muted">{r.extracted.qual_type === "certified" ? "교원 자격 보유자" : r.extracted.qual_type === "qualified" ? "준자격자 · 아동 지도 경력 검증 대상" : "자격 유형 확인 필요"}</p>
                  </Card>
                </>
              )}
            </div>
            {r && r.status === "pending" && (
              <>
                <div className="grid gap-2 lg:grid-cols-2">
                  <CheckRow checked={r.checked_original} onChange={(v) => update({ checked_original: v })} label="원본 서류와 대조했어요" />
                  <CheckRow checked={r.checked_crime} onChange={(v) => update({ checked_crime: v })} label="범죄경력 조회 결과를 확인했어요" />
                </div>
                <label className="flex flex-col gap-2">
                  <span className="t14 text-muted">보완 요청 시 대상 자료와 사유</span>
                  <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="필요한 자료와 보완할 내용을 입력하세요." />
                </label>
                <ErrorText>{err}</ErrorText>
                <div className="grid grid-cols-2 gap-3">
                  <Button kind={note.trim() ? "secondary" : "disabled"} disabled={!note.trim()} onClick={() => update({ action: "request", note })}>보완 요청</Button>
                  <Button disabled={!(r.checked_original && r.checked_crime)} onClick={() => update({ action: "approve" })}>승인</Button>
                </div>
              </>
            )}
            {r && r.status !== "pending" && (
              <div className="flex flex-col gap-3">
                <Info>{r.status === "approved" ? "승인을 마친 심사예요." : `보완을 요청한 심사예요 · ${r.request_note}`}</Info>
                <Button kind="secondary" onClick={() => update({ action: "reset" })}>시연용으로 다시 심사하기</Button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
