"use client";

import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { Icon } from "@/components/Icon";
import { Page } from "@/components/shell";
import { AppBarDetail, BottomAction, Button, Card, ErrorText, Field, Info, Loading, TextLink, cx, inputCls } from "@/components/ui";
import { useLive, useSession } from "@/lib/session";
import type { Notice, NoticeItem } from "@/lib/types";

function Checks({ it }: { it: NoticeItem }) {
  const rows: [string, boolean][] = [["ⓐ 원문 근거", it.checks.evidence], ["ⓑ 반복 읽기 일치", it.checks.consistent], ["ⓒ 양식 비교", it.checks.template]];
  return (
    <div className="flex flex-wrap gap-1.5">
      {rows.map(([label, ok]) => (
        <span key={label} className={cx("t14 rounded-md px-2 py-0.5", ok ? "bg-sent text-sent-ink" : "bg-wait text-wait-ink")}>
          {label} {ok ? "✓" : "확인 필요"}
        </span>
      ))}
    </div>
  );
}

function Highlight({ text, mark }: { text: string; mark: string }) {
  const i = mark ? text.indexOf(mark) : -1;
  if (i < 0) return <>{text}</>;
  return <>{text.slice(0, i)}<mark className="rounded bg-wait px-0.5">{mark}</mark>{text.slice(i + mark.length)}</>;
}

/** S09 · 통신문 확인 (+ edit · corrected · verified · 보완 상태) */
export default function NoticeReview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { api } = useSession();
  const router = useRouter();
  const { data: n, setData } = useLive<Notice>(`/api/notices/${id}`);
  const [editing, setEditing] = useState<number | null>(null);
  const [due, setDue] = useState("");
  const [showSource, setShowSource] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function act(it: NoticeItem, action: string, extra: Record<string, string> = {}) {
    setErr("");
    try {
      const r = await api<Notice>(`/api/notices/${id}/items/${it.id}`, { method: "PATCH", json: { action, ...extra } });
      setData(r);
      if (action !== "edit") setEditing(null);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function approve() {
    setBusy(true);
    setErr("");
    try {
      await api(`/api/notices/${id}/approve`, { method: "POST" });
      router.push("/g/visits");
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  if (!n) return <><AppBarDetail title="통신문 확인" /><Loading /></>;

  const teacherItems = n.items.filter((i) => i.owner === "teacher");
  const guardianItems = n.items.filter((i) => i.owner === "guardian");
  const pending = n.items.filter((i) => i.status === "pending");
  const toSend = teacherItems.filter((i) => i.status === "verified" || i.status === "edited");
  const excluded = n.items.filter((i) => i.status === "excluded");
  const approved = n.status === "approved";

  const itemBlock = (it: NoticeItem, tone: "teacher" | "guardian") => {
    const isEditing = editing === it.id;
    const off = it.status === "excluded";
    return (
      <div key={it.id} className={cx("flex flex-col gap-2 border-b border-soft pb-4 last:border-0", off && "opacity-60")}>
        <p className={cx("t14", tone === "teacher" ? "text-brand" : "text-muted")}>{tone === "teacher" ? "선생님에게 맡길 일" : "보호자 전용"}</p>
        <p className={cx("font-bold", tone === "teacher" ? "t16" : "t20")}>{it.title}{off && " · 제외됨"}</p>
        {tone === "teacher" ? <p className="t14 text-muted">{it.detail}</p> : (
          <p className={cx("t16 font-bold", it.status === "pending" ? "text-wait-ink" : "text-ink")}>
            기한&nbsp;&nbsp;{it.due_label || "확인 필요"}{it.amount ? ` · ${it.amount.toLocaleString()}원` : ""}
          </p>
        )}
        <Checks it={it} />
        {it.status === "pending" && tone === "teacher" && it.warning && <p className="t14 text-wait-ink">{it.warning}</p>}

        {isEditing && (
          <div className="flex flex-col gap-3 pt-1">
            <div className="t14 rounded-xl bg-wait px-4 py-3 text-wait-ink">원문{"\n"}<span className="t16">“{it.evidence}”</span></div>
            <Field label={it.category === "납부" ? "납부 기한" : "기한"}>
              <input type="date" className={inputCls} value={due || it.due} onChange={(e) => setDue(e.target.value)} />
            </Field>
            <Button kind="secondary" onClick={() => act(it, "edit", { due: due || it.due })}>수정 완료</Button>
          </div>
        )}

        {!approved && !off && (
          <div className="flex flex-col">
            {!isEditing && <TextLink onClick={() => { setEditing(it.id); setDue(it.due); }}>항목 수정 · 원문 전체 보기</TextLink>}
            {it.status === "pending"
              ? <Button kind="secondary" onClick={() => act(it, "verify")}>원문 대조 완료</Button>
              : <p className="t14 flex items-center gap-2 text-sent-ink"><Icon name="check" size={20} />원문 대조 완료</p>}
            <TextLink onClick={() => act(it, "exclude")}>항목 제외</TextLink>
            {tone === "guardian" && it.category === "납부" && <p className="t14 text-muted">납부는 보호자 할 일로 남고{"\n"}선생님에게 전달되지 않아요.</p>}
            {tone === "guardian" && it.category === "서명" && <p className="t14 text-muted">서명은 보호자가 직접 해요.{"\n"}선생님에게 전달되지 않아요.</p>}
          </div>
        )}
        {!approved && off && <TextLink onClick={() => act(it, "include")}>다시 포함하기</TextLink>}
      </div>
    );
  };

  return (
    <>
      <AppBarDetail title="통신문 확인" back="/g/visits" />
      <Page>
        {approved ? <Info>선생님에게 전달을 마친 통신문이에요.</Info>
          : pending.length > 0 ? (
            <Info tone="wait">확인할 날짜가 {pending.length}건 있어요.{"\n"}{pending.map((p) => p.warning).filter(Boolean).join("\n")}</Info>
          ) : excluded.length > 0 && toSend.length > 0 ? (
            <Info>{excluded.map((e) => e.category).join("·")} 항목을 제외했어요.{"\n"}선생님에게 맡길 일 {toSend.length}개만 전달해 주세요.</Info>
          ) : <Info>확인을 마쳤어요. 선생님에게 맡길 일 {toSend.length}개를 전달해 주세요.</Info>}

        <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-start lg:gap-8">
          <div className="flex flex-col gap-4">
            <p className="t14 text-muted">{n.title} · {n.engine === "claude+rules" ? "AI(Claude)+규칙 3중 검증" : "규칙 기반 3중 검증(데모 모드)"}</p>
            {teacherItems.map((it) => itemBlock(it, "teacher"))}
            {guardianItems.map((it) => itemBlock(it, "guardian"))}
            {n.items.length === 0 && <Info tone="wait">맡길 일을 찾지 못했어요. 원문을 확인하고 다시 올려 주세요.</Info>}
          </div>
          <div className="flex flex-col gap-4">
            <Card className="flex flex-col gap-3">
              <h3 className="t16 font-bold">선생님에게 보낼 할 일 {toSend.length}개</h3>
              {toSend.map((t) => (
                <p key={t.id} className="t16 flex items-center gap-3"><span className="text-brand-deep"><Icon name="check" /></span>{t.title}</p>
              ))}
              {toSend.length === 0 && <p className="t14 text-muted">아직 없어요</p>}
            </Card>
            <button type="button" onClick={() => setShowSource((s) => !s)} className="t16 text-left font-bold text-brand">
              {showSource ? "원문 접기" : "원문 전체 보기"}
            </button>
            {showSource && (
              <pre className="t14 whitespace-pre-wrap rounded-xl border border-soft bg-surface p-4 font-sans text-ink">
                <Highlight text={n.source_text} mark={n.items.find((i) => i.id === editing)?.evidence ?? pending[0]?.evidence ?? ""} />
              </pre>
            )}
            <p className="t14 text-muted">원문과 결제·서명 항목은 선생님에게 보이지 않아요.</p>
          </div>
        </div>
        <ErrorText>{err}</ErrorText>
        {!approved && (
          <BottomAction note={pending.length ? "날짜를 확인하거나 해당 항목을 제외해 주세요." : undefined}>
            <Button onClick={approve} disabled={busy || pending.length > 0}>검토한 {toSend.length}개 전달하기</Button>
          </BottomAction>
        )}
      </Page>
    </>
  );
}
