"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { Page } from "@/components/shell";
import { AppBarDetail, BottomAction, Button, Card, Chip, ErrorText, Info, Loading, textareaCls } from "@/components/ui";
import { ocrImage, pdfText, type OcrProgress } from "@/lib/ocr";
import { useLive, useSession } from "@/lib/session";
import type { Notice, Visit } from "@/lib/types";

type Doc = { name: string; file: Blob; kind: "image" | "pdf"; preview?: string };

const STEPS = ["사진의 글자 읽기", "할 일과 기한 찾기", "원문과 일치 여부 확인"];

function NoticeNew() {
  const params = useSearchParams();
  const router = useRouter();
  const { api } = useSession();
  const { data } = useLive<{ visits: Visit[] }>("/api/visits");
  const visit = data?.visits.find((v) => String(v.id) === params.get("visit"))
    ?? data?.visits.find((v) => ["booked", "payment", "requested"].includes(v.status));
  const [doc, setDoc] = useState<Doc | null>(null);
  const [typed, setTyped] = useState<string | null>(null);
  const [reading, setReading] = useState<OcrProgress | null>(null);
  const [step, setStep] = useState(0);
  const [err, setErr] = useState("");
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const pdf = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (doc?.preview) URL.revokeObjectURL(doc.preview); }, [doc]);

  function pick(f: File | undefined, kind: "image" | "pdf") {
    if (!f) return;
    setErr("");
    setDoc({ name: f.name, file: f, kind, preview: kind === "image" ? URL.createObjectURL(f) : undefined });
  }

  async function useSample() {
    const blob = await (await fetch("/samples/notice-01.png")).blob();
    setDoc({ name: "11월 독서 활동 안내(예시).png", file: blob, kind: "image", preview: URL.createObjectURL(blob) });
  }

  async function run() {
    if (!visit) return;
    setErr("");
    setStep(0);
    setReading({ stage: "load", progress: 0.02 });
    try {
      let text = typed ?? "";
      if (!typed && doc) {
        text = doc.kind === "pdf" ? await pdfText(doc.file, setReading) : await ocrImage(doc.file, setReading);
      }
      if (text.replace(/\s/g, "").length < 10) throw new Error("글자를 읽지 못했어요. 밝은 곳에서 다시 찍거나 글자로 입력해 주세요.");
      setStep(1);
      const n = await api<Notice>(`/api/visits/${visit.id}/notices`, { method: "POST", json: { text } });
      setStep(2);
      await new Promise((r) => setTimeout(r, 500));
      router.push(`/g/notice/${n.id}`);
    } catch (e) {
      setErr((e as Error).message);
      setReading(null);
    }
  }

  if (reading) {
    // L01 · 통신문 읽는 중
    return (
      <>
        <AppBarDetail title="통신문 읽는 중" />
        <Page className="lg:max-w-[560px]">
          <span className="text-brand-deep"><Icon name="doc" size={40} /></span>
          <div>
            <h2 className="t24 font-bold">통신문을 읽고 있어요</h2>
            <p className="t16 mt-2 text-muted">준비물과 날짜를 찾고{"\n"}원문과 다시 비교하고 있어요.</p>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-soft">
            <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${Math.round((step === 0 ? reading.progress * 0.6 : step === 1 ? 0.75 : 0.95) * 100)}%` }} />
          </div>
          <Card className="py-1">
            {STEPS.map((s, i) => (
              <div key={s} className="t16 flex items-center gap-3 border-b border-soft py-3 last:border-0">
                <span className={i < step ? "text-brand-deep" : i === step ? "text-brand tb-pulse" : "text-line"}>
                  <Icon name={i < step ? "check" : "clock"} />
                </span>
                <span className={i === step ? "text-brand" : i < step ? "text-ink" : "text-muted"}>
                  {i > step ? `다음 · ${s}` : s}
                </span>
              </div>
            ))}
          </Card>
          <Info>보호자가 확인하기 전에는{"\n"}선생님에게 아무것도 전달되지 않아요.</Info>
          <p className="t14 text-muted">사진은 이 휴대폰 안에서만 읽고, 서버에는 읽은 글자만 보내요.</p>
          <BottomAction><Button kind="secondary" href="/g/visits">방문 일정에서 나중에 확인</Button></BottomAction>
        </Page>
      </>
    );
  }

  return (
    <>
      <AppBarDetail title="통신문 올리기" />
      <Page>
        {!data ? <Loading /> : !visit ? (
          <Info>통신문을 연결할 방문이 없어요. 먼저 방문을 요청해 주세요.</Info>
        ) : (
          <div className="flex flex-col gap-5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
            <div className="flex flex-col gap-4">
              <Info>연결할 방문 {visit.short_date} {visit.start}{"\n"}{visit.teacher.name} 선생님 · {visit.phase === "payment" ? "결제 대기" : visit.phase === "requested" ? "요청 중" : "예약 확정"}</Info>
              <div className="flex flex-wrap gap-2">
                <Chip onClick={() => camera.current?.click()}>사진 찍기</Chip>
                <Chip onClick={() => gallery.current?.click()}>사진 선택</Chip>
                <Chip onClick={() => pdf.current?.click()}>PDF</Chip>
                <Chip onClick={() => setTyped((t) => (t === null ? "" : null))} selected={typed !== null}>글자로 입력</Chip>
              </div>
              <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => pick(e.target.files?.[0], "image")} />
              <input ref={gallery} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0], "image")} />
              <input ref={pdf} type="file" accept="application/pdf" hidden onChange={(e) => pick(e.target.files?.[0], "pdf")} />
              {!doc && typed === null && (
                <button type="button" onClick={useSample} className="t16 rounded-xl border border-dashed border-line bg-surface p-4 text-left">
                  <b className="text-brand">예시 통신문으로 해보기</b>
                  <span className="t14 mt-1 block text-muted">춘천예시초 「11월 독서 활동 및 현장체험학습 안내」</span>
                </button>
              )}
              {typed !== null && (
                <textarea rows={8} className={textareaCls} value={typed} placeholder="통신문 내용을 붙여 넣어 주세요."
                  onChange={(e) => setTyped(e.target.value)} />
              )}
            </div>
            <div className="flex flex-col gap-4">
              {doc && typed === null && (
                <Card className="flex flex-col gap-3">
                  <p className="t16 flex items-center gap-2 font-bold"><span className="text-brand-deep"><Icon name="doc" /></span>가정통신문 · 1쪽</p>
                  <p className="t14 break-all text-muted">{doc.name}</p>
                  {doc.preview && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={doc.preview} alt="올린 통신문" className="max-h-[360px] w-full rounded-lg border border-soft object-contain" />
                  )}
                </Card>
              )}
              {doc && typed === null && <Button kind="secondary" onClick={() => setDoc(null)}>다른 문서 선택</Button>}
              <p className="t14 flex gap-2 text-muted">
                <span className="text-brand-deep"><Icon name="lock" /></span>
                <span>원문은 보호자에게만 보여요.{"\n"}마감 기한이 지나면 삭제됩니다.</span>
              </p>
              <ErrorText>{err}</ErrorText>
            </div>
          </div>
        )}
        <BottomAction>
          <Button onClick={run} disabled={!visit || (!doc && !(typed && typed.trim().length > 10))}>할 일 찾기</Button>
        </BottomAction>
      </Page>
    </>
  );
}

/** S08 · 통신문 올리기 → L01 · 통신문 읽는 중 */
export default function Page_() {
  return <Suspense><NoticeNew /></Suspense>;
}
