"use client";

import { useRouter } from "next/navigation";
import { use, useEffect, useRef, useState } from "react";
import { Page } from "@/components/shell";
import { AppBarDetail, Badge, BottomAction, Button, Card, ErrorText, Field, Info, Loading, Overlay, inputCls, textareaCls } from "@/components/ui";
import { useLive, useSession } from "@/lib/session";
import { startStt, sttSupported } from "@/lib/stt";
import type { Visit } from "@/lib/types";

type Mode = "edit" | "recording" | "transcript";

/** S15 · 활동 기록 (+ edit · recording · transcript) + D02 방문을 마칠까요? */
export default function Record({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { api } = useSession();
  const { data: v } = useLive<Visit>(`/api/visits/${id}`);
  const [hw, setHw] = useState("");
  const [rd, setRd] = useState("");
  const [memo, setMemo] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [mode, setMode] = useState<Mode>("edit");
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [secs, setSecs] = useState(0);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!v || loaded) return;
    setHw(v.record?.homework != null ? String(v.record.homework) : "");
    setRd(v.record?.reading_min != null ? String(v.record.reading_min) : "");
    setMemo(v.record?.memo ?? "");
    setLoaded(true);
  }, [v, loaded]);

  useEffect(() => {
    if (mode !== "recording") return;
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [mode]);

  useEffect(() => () => stopRef.current?.(), []);

  if (!v) return <><AppBarDetail title="활동 기록" /><Loading /></>;

  const done = v.tasks.filter((t) => t.owner === "teacher");
  const num = (s: string) => (s.trim() === "" ? null : Math.max(0, parseInt(s, 10) || 0));

  async function save() {
    await api(`/api/visits/${v!.id}/record`, { method: "PUT", json: { homework: num(hw), reading_min: num(rd), memo, transcript } });
  }

  function startRec() {
    setErr("");
    if (!sttSupported()) {
      setErr("이 브라우저는 음성 인식을 지원하지 않아요. 메모를 직접 입력해 주세요.");
      return;
    }
    setTranscript("");
    setInterim("");
    setSecs(0);
    setMode("recording");
    stopRef.current = startStt((f, i) => { setTranscript(f); setInterim(i); }, (m) => { setErr(m); setMode("edit"); });
  }

  function stopRec() {
    stopRef.current?.();
    stopRef.current = null;
    setTranscript((t) => (t + (interim ? ` ${interim}` : "")).trim());
    setInterim("");
    setMode("transcript");
  }

  async function finish() {
    setBusy(true);
    setErr("");
    try {
      await save();
      if (v!.status === "live") await api(`/api/visits/${v!.id}/finish`, { method: "POST" });
      router.push(`/t/visits/${v!.id}/report`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  const mmss = `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;

  if (mode === "recording") {
    return (
      <>
        <AppBarDetail title="활동 기록" />
        <Page className="lg:max-w-[560px]">
          <div><Badge tone="LIVE">방문 중</Badge></div>
          <h2 className="t24 font-bold">음성으로 기록하고 있어요</h2>
          <p className="t18 text-brand"><span className="tb-pulse">●</span> 녹음 중 · {mmss}</p>
          <Info>녹음한 메모는 글로 바꾼 뒤{"\n"}직접 확인하고 메모에 넣을 수 있어요.</Info>
          {(transcript || interim) && <p className="t18">{transcript} <span className="text-muted">{interim}</span></p>}
          <Button onClick={stopRec}>녹음 마치기</Button>
        </Page>
      </>
    );
  }

  if (mode === "transcript") {
    return (
      <>
        <AppBarDetail title="활동 기록" />
        <Page className="lg:max-w-[560px]">
          <div><Badge tone="LIVE">방문 중</Badge></div>
          <h2 className="t24 font-bold">글로 옮긴 메모를 확인해 주세요</h2>
          <Field label="음성 메모">
            <textarea rows={3} className={textareaCls} value={transcript} onChange={(e) => setTranscript(e.target.value)} placeholder="인식된 문장이 없어요. 직접 적어 주세요." />
          </Field>
          <Info>확인한 문장만 관찰 메모에 들어가요.</Info>
          <BottomAction>
            <Button disabled={!transcript.trim()} onClick={() => { setMemo((m) => (m ? `${m} ${transcript.trim()}` : transcript.trim())); setMode("edit"); }}>글 확인하고 메모에 넣기</Button>
            <Button kind="secondary" onClick={() => setMode("edit")}>메모에 넣지 않기</Button>
          </BottomAction>
        </Page>
      </>
    );
  }

  return (
    <>
      <AppBarDetail title="활동 기록" back={`/t/visits/${v.id}`} />
      <Page>
        <div>{v.status === "live" ? <Badge tone="LIVE">방문 중</Badge> : <Badge tone="DRAFT">종료된 방문 · 기록 보완 중</Badge>}</div>
        <div className="flex flex-col gap-5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-8">
          <Card className="flex flex-col gap-1">
            <h3 className="t16 font-bold">방문 할 일에서 확인한 내용</h3>
            {done.map((t) => <p key={t.id} className="t18">{t.title} · {t.done ? "완료" : "미완료"}</p>)}
            <p className="t14 mt-2 text-muted">수행 여부는 방문 할 일에서 바꿔 주세요.</p>
          </Card>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="숙제 개수">
                <div className="relative">
                  <input inputMode="numeric" className={inputCls} value={hw} onChange={(e) => setHw(e.target.value.replace(/\D/g, ""))} placeholder="기록 없음" />
                  <span className="t16 pointer-events-none absolute right-3 top-[13px] text-muted">개</span>
                </div>
              </Field>
              <Field label="독서 시간">
                <div className="relative">
                  <input inputMode="numeric" className={inputCls} value={rd} onChange={(e) => setRd(e.target.value.replace(/\D/g, ""))} placeholder="기록 없음" />
                  <span className="t16 pointer-events-none absolute right-3 top-[13px] text-muted">분</span>
                </div>
              </Field>
            </div>
            <p className="t14 -mt-2 text-muted">빈칸은 0이 아닌 ‘기록 없음’으로 남겨요.</p>
            <Field label="관찰 메모">
              <textarea rows={2} className={textareaCls} value={memo} maxLength={600} onChange={(e) => setMemo(e.target.value)} placeholder="예: 독서 기록장을 함께 챙겼어요." />
            </Field>
            <Button kind="secondary" onClick={startRec}>음성 메모 시작</Button>
            <p className="t18">직접 본 활동만 적어 주세요.</p>
            <ErrorText>{err}</ErrorText>
          </div>
        </div>
        <BottomAction>
          {v.status === "live"
            ? <Button onClick={() => setConfirmEnd(true)} disabled={busy}>방문 종료하기</Button>
            : <Button onClick={finish} disabled={busy}>저장하고 검토로</Button>}
        </BottomAction>
      </Page>

      <Overlay open={confirmEnd}>
        <h2 className="t24 font-bold">방문을 마칠까요?</h2>
        <p className="t16 mt-3 font-bold">{v.date_label} {v.time_label}</p>
        <p className="t14 mt-2 text-muted">{v.household} · {v.child_desc.split(" · ")[0]}</p>
        <p className="t16 mt-3">방문을 마치면 영상 공유가 종료돼요.{"\n"}리포트는 검토한 뒤 따로 보낼 수 있어요.</p>
        <div className="mt-5 flex flex-col gap-3">
          <Button kind="secondary" onClick={() => setConfirmEnd(false)}>계속 기록하기</Button>
          <Button onClick={finish} disabled={busy}>{busy ? "마치는 중…" : "방문 종료하기"}</Button>
        </div>
      </Overlay>
    </>
  );
}
