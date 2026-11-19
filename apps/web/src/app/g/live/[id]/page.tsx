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
  waiting: "선생님 휴대폰이 연결되면 바로 보여요",
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
  const { sendRtc, onRtc } = useSession();
  const { data: v } = useLive<Visit>(`/api/visits/${id}`);
  const { run, busy } = useVisitAction();
  const videoRef = useRef<HTMLVideoElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const [state, setState] = useState("waiting");
  const [hasVideo, setHasVideo] = useState(false);

  const allowed = !!v && v.status === "live" && v.consent.guardian && v.consent.teacher;

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
              <p className="t14 opacity-80">{STATE_LABEL[state] ?? state}</p>
            </div>
          )}
          {hasVideo && (
            <span className="t14 absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-white">
              <span className="h-2 w-2 rounded-full bg-[#ff5a5a] tb-pulse" />LIVE
            </span>
          )}
        </div>
        <Info>보호자·선생님 동의 완료{"\n"}선생님 휴대폰 카메라 → 이 화면으로 직접 전송(WebRTC) · {STATE_LABEL[state] ?? state}</Info>
        <div>
          <h3 className="t20 font-bold">실시간으로만 확인해요</h3>
          <p className="t16 mt-2 text-muted">녹화본 탐색이나 다운로드는 제공하지 않아요. 분쟁 시에는 별도 절차로 열람해요.</p>
        </div>
        <BottomAction>
          <Button kind="secondary" disabled={busy} onClick={() => run(`/api/visits/${v.id}/consent`, { value: false })}>영상 공유 동의 철회</Button>
        </BottomAction>
      </Page>
    </>
  );
}
