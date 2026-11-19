"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Card, Chip, ErrorText, Info, Loading, cx, textareaCls } from "@/components/ui";
import { useSession } from "@/lib/session";

type Alert = { id: number; kind: string; title: string; subtitle: string; detail: string[]; action: string; memo: string; status: "open" | "resolved"; created: string };

const QUESTION: Record<string, string> = {
  "도착 지연": "예정 시각과 실제 기록을 확인해 주세요",
  "영상 중단": "영상이 끊긴 이유를 확인해 주세요",
  "잦은 취소": "취소가 반복된 이유를 확인해 주세요",
};

/** S19 · 운영 경보 (+ done) — 이상 감지 결과에 대한 운영자 조치 */
export default function Alerts() {
  const { api, token } = useSession();
  const [list, setList] = useState<Alert[] | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [action, setAction] = useState("");
  const [memo, setMemo] = useState("");
  const [err, setErr] = useState("");

  async function load() {
    const r = await api<{ alerts: Alert[] }>("/api/admin/alerts");
    setList(r.alerts);
    return r.alerts;
  }

  useEffect(() => {
    if (!token) return;
    load().then((a) => {
      const first = a.find((x) => x.status === "open") ?? a[0];
      if (first) pick(first);
    }).catch((e: Error) => setErr(e.message));
    const t = setInterval(() => { load().catch(() => {}); }, 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function pick(a: Alert) {
    setSel(a.id);
    setAction(a.action || "연락 후 확인");
    setMemo(a.memo || (a.kind === "도착 지연" ? "선생님에게 도착 시각을 확인했어요.\n보호자에게 연락 결과를 안내했어요." : ""));
  }

  const a = list?.find((x) => x.id === sel);

  async function resolve() {
    if (!a) return;
    setErr("");
    try {
      const next = await api<Alert>(`/api/admin/alerts/${a.id}`, { method: "POST", json: { action, memo, resolve: true } });
      setList(list!.map((x) => (x.id === next.id ? next : x)));
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <>
      <div className="flex items-center justify-between px-5 pt-6 lg:px-0 lg:pt-8">
        <h1 className="t24 font-bold">운영 경보</h1>
        <span className="t14 rounded-md bg-disabled px-2 py-1 text-muted">가상 자료 · 운영 연동 전</span>
      </div>
      <div className="flex flex-col gap-4 px-5 py-6 lg:grid lg:grid-cols-[230px_minmax(0,1fr)] lg:items-start lg:gap-6 lg:px-0">
        {!list ? <Loading /> : list.length === 0 ? <Info>열린 경보가 없어요.</Info> : (
          <>
            <div className="flex flex-col gap-3">
              {list.map((x) => (
                <button key={x.id} type="button" onClick={() => pick(x)}
                  className={cx("flex flex-col gap-2 rounded-xl border bg-surface p-4 text-left", x.id === sel ? "border-brand" : "border-soft")}>
                  <span><Badge tone={x.status === "resolved" ? "SENT" : "ERROR"}>{x.status === "resolved" ? "조치 완료" : "확인 필요"}</Badge></span>
                  <span className="t20 font-bold">{x.title}</span>
                  <span className="t16">{x.subtitle}</span>
                  <span className="t14 border-t border-soft pt-2 text-muted">최근 발생 · {x.created}</span>
                </button>
              ))}
            </div>
            {a && (
              <Card className="flex flex-col gap-3">
                <h2 className="t20 font-bold">{QUESTION[a.kind] ?? "기록을 확인해 주세요"}</h2>
                {a.detail.map((d) => <p key={d} className="t16">{d}</p>)}
                <div className="h-px bg-soft" />
                <div className="flex flex-wrap gap-2">
                  {["연락 후 확인", "대체 선생님 검토"].map((x) => (
                    <Chip key={x} selected={action === x} disabled={a.status === "resolved"} onClick={() => setAction(x)}>{x}</Chip>
                  ))}
                </div>
                <label className="flex flex-col gap-2">
                  <span className="t14 text-muted">조치 메모</span>
                  <textarea rows={2} className={textareaCls} value={memo} disabled={a.status === "resolved"} onChange={(e) => setMemo(e.target.value)} />
                </label>
                <p className="t14 text-muted">경보만으로 방문을 취소하거나 선생님을 교체하지 않아요.</p>
                <ErrorText>{err}</ErrorText>
                <Button onClick={resolve} disabled={a.status === "resolved" || !memo.trim() || !action}>{a.status === "resolved" ? "조치 완료" : "조치 완료"}</Button>
              </Card>
            )}
          </>
        )}
      </div>
    </>
  );
}
