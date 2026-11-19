"use client";

import { use, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { Page } from "@/components/shell";
import { AppBarDetail, Badge, BottomAction, Button, Info, Loading } from "@/components/ui";
import { useVisitAction } from "@/components/visit";
import { apiBase } from "@/lib/api";
import { iceServers, Viewer } from "@/lib/rtc";
import { useLive, useSession } from "@/lib/session";
import type { Visit } from "@/lib/types";

const STATE_LABEL: Record<string, string> = {
  waiting: "선생님 휴대폰의 카메라를 기다리는 중",
  new: "연결 준비 중",
  connecting: "연결하는 중",
  connected: "실시간 연결됨",
  disconnected: "연결이 잠시 끊겼어요 · 다시 연결하는 중",
  failed: "연결하지 못했어요 · 다시 시도하는 중",
  closed: "연결 종료",
  ended: "선생님이 영상 공유를 마쳤어요",
};

/** S10 · 실시간 방문 보기 (+ S10-stopped) */
export default function LiveView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const visitId = Number(id);
  const { sendRtc, onRtc, peers } = useSession();
  const { data: v } = useLive<Visit>(`/api/visits/${id}`);
  const { run, busy } = useVisitAction();
  const videoRef = useRef<HTMLVideoElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const [state, setState] = useState("waiting");
  const [hasVideo, setHasVideo] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const [recording, setRecording] = useState(false);
  const [savedName, setSavedName] = useState("");

  const allowed = !!v && v.status === "live" && v.consent.guardian && v.consent.teacher;
  const teacherOnline = peers.includes("teacher");

  useEffect(() => {
    if (!allowed) return;
    let alive = true;
    let timer: ReturnType<typeof setInterval> | undefined;
    (async () => {
      const viewer = new Viewer(sendRtc, await iceServers(apiBase()), visitId);
      if (!alive) return;
      viewerRef.current = viewer;
      viewer.onStream = (s) => {
        setHasVideo(!!s);
        streamRef.current = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          if (s) videoRef.current.play().catch(() => {});
        }
      };
      viewer.onState = (s) => setState(s);
      viewer.hello();
      timer = setInterval(() => { if (!viewer.connected) viewer.hello(); }, 4000);
    })();
    const off = onRtc((m) => { viewerRef.current?.handle(m); });
    return () => {
      alive = false;
      if (timer) clearInterval(timer);
      off();
      viewerRef.current?.close();
      viewerRef.current = null;
    };
  }, [allowed, visitId, sendRtc, onRtc]);

  const canRecord = !!v && v.consent.record_guardian && v.consent.record_teacher;

  /** 선택 녹화: 두 사람 모두 허용한 경우에만, 이 휴대폰에만 저장(서버로 올리지 않음) */
  function toggleRecord() {
    if (recording) {
      recRef.current?.stop();
      return;
    }
    const s = streamRef.current;
    if (!s || typeof MediaRecorder === "undefined") return;
    const type = ["video/webm;codecs=vp9", "video/webm", "video/mp4"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
    const rec = new MediaRecorder(s, type ? { mimeType: type } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      setRecording(false);
      const blob = new Blob(chunks, { type: rec.mimeType || "video/webm" });
      const name = `teumbom-${v?.date ?? "visit"}-${Date.now()}.${(rec.mimeType || "").includes("mp4") ? "mp4" : "webm"}`;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
      setSavedName(name);
    };
    rec.start(1000);
    recRef.current = rec;
    setRecording(true);
  }

  if (!v) return <><AppBarDetail title="실시간 방문 보기" /><Loading /></>;

  if (!allowed) {
    return (
      <>
        <AppBarDetail title="실시간 방문 보기" back="/g/visits" />
        <Page className="lg:max-w-[640px]">
          <div><Badge tone={v.status === "live" ? "LIVE" : "CLOSED"}>{v.status === "live" ? "방문 중" : "영상 없음"}</Badge></div>
          <h2 className="t24 font-bold">{v.status === "live" ? "영상 공유가 종료됐어요" : "지금은 볼 수 있는 영상이 없어요"}</h2>
          <Info>{v.status === "live" ? "동의 철회로 영상 송출과 재생을 중단한 상태입니다." : "영상은 방문 중이고 보호자·선생님이 모두 동의한 경우에만 보여요."}</Info>
          {v.status === "live" && <p className="t16 text-muted">방문은 계속 진행 중이에요.</p>}
          <BottomAction><Button kind="secondary" href="/g/visits">방문 일정으로</Button></BottomAction>
        </Page>
      </>
    );
  }

  return (
    <>
      <AppBarDetail title="실시간 방문 보기" back="/g/visits" />
      <Page className="lg:max-w-[760px]">
        <div><Badge tone="LIVE">방문 중</Badge></div>
        <h2 className="t20 font-bold">{v.date_label.replace(/ \(.\)$/, "")} · {v.teacher.name} 선생님</h2>
        <div className="relative overflow-hidden rounded-xl bg-overlay">
          <video ref={videoRef} autoPlay playsInline muted className={hasVideo ? "aspect-video w-full bg-black object-contain" : "hidden"} />
          {!hasVideo && (
            <div className="flex aspect-video flex-col items-start justify-end gap-1 p-5 text-white">
              <span className="mb-auto self-center pt-6 text-brand"><Icon name="video" size={40} /></span>
              <p className="t20 font-bold">실시간 영상</p>
              <p className="t14 opacity-80">{teacherOnline ? STATE_LABEL[state] ?? state : "선생님 휴대폰이 연결되면 바로 보여요"}</p>
            </div>
          )}
          {hasVideo && (
            <span className="t14 absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-white">
              <span className="h-2 w-2 rounded-full bg-[#ff5a5a] tb-pulse" />LIVE
            </span>
          )}
        </div>
        <Info>보호자·선생님 동의 완료{"\n"}선생님 휴대폰 카메라 → 이 화면으로 직접 전송(WebRTC) · {STATE_LABEL[state] ?? state}</Info>
        {canRecord ? (
          <div className="flex flex-col gap-2">
            <h3 className="t20 font-bold">녹화 (선택)</h3>
            <p className="t16 text-muted">두 분 모두 녹화를 허용했어요. 녹화본은 서버에 올라가지 않고 이 휴대폰에만 저장돼요.</p>
            <Button kind={recording ? "danger" : "secondary"} disabled={!hasVideo} onClick={toggleRecord}>
              {recording ? "● 녹화 멈추고 저장" : "녹화 시작"}
            </Button>
            {savedName && <p className="t14 text-sent-ink">저장했어요 · {savedName}</p>}
          </div>
        ) : (
          <div>
            <h3 className="t20 font-bold">실시간으로만 확인해요</h3>
            <p className="t16 mt-2 text-muted">녹화는 선택이에요. 두 분 모두 녹화를 허용한 방문에서만 이 휴대폰에 저장할 수 있어요.</p>
          </div>
        )}
        <BottomAction>
          <Button kind="secondary" disabled={busy} onClick={() => run(`/api/visits/${v.id}/consent`, { value: false })}>영상 공유 동의 철회</Button>
        </BottomAction>
      </Page>
    </>
  );
}
