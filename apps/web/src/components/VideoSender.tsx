"use client";

import { useEffect, useRef, useState } from "react";
import { apiBase } from "@/lib/api";
import { iceServers, Sender } from "@/lib/rtc";
import { useLive, useSession } from "@/lib/session";
import type { Visit } from "@/lib/types";
import { Icon } from "./Icon";

/**
 * Lives in the teacher layout so the camera keeps streaming while the teacher
 * moves between 방문 할 일 and 활동 기록. Streams only while the visit is live
 * and both sides have consented; stops the moment either side withdraws.
 */
export function VideoSender() {
  const { sendRtc, onRtc, api } = useSession();
  const { data } = useLive<{ visits: Visit[] }>("/api/visits");
  const live = data?.visits.find((v) => v.status === "live" && v.consent.guardian && v.consent.teacher);
  const senderRef = useRef<Sender | null>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<string>("idle");
  const [error, setError] = useState("");
  const [open, setOpen] = useState(true);

  const visitId = live?.id;

  async function start(id: number) {
    setError("");
    try {
      const sender = new Sender(sendRtc, await iceServers(apiBase()), id);
      sender.onState = (s) => setState(s);
      const stream = await sender.startCamera();
      senderRef.current = sender;
      if (previewRef.current) previewRef.current.srcObject = stream;
      setState("ready");
      await api(`/api/visits/${id}/video`, { method: "POST", json: { state: "live" } });
      await sender.connect(); // a viewer may already be waiting
    } catch (e) {
      setError((e as Error).name === "NotAllowedError" ? "카메라 권한을 허용해 주세요." : "카메라를 켜지 못했어요.");
    }
  }

  useEffect(() => {
    if (!visitId) {
      if (senderRef.current) {
        const id = senderRef.current.visitId;
        senderRef.current.stop();
        senderRef.current = null;
        setState("idle");
        api(`/api/visits/${id}/video`, { method: "POST", json: { state: "off" } }).catch(() => {});
      }
      return;
    }
    if (!senderRef.current) void start(visitId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitId]);

  useEffect(() => onRtc((m) => { senderRef.current?.handle(m); }), [onRtc]);

  useEffect(() => () => senderRef.current?.stop(), []);

  if (!live) return null;

  return (
    <div className="fixed right-3 top-3 z-40 flex flex-col items-end gap-2 lg:right-6 lg:top-6">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="t14 flex items-center gap-2 rounded-full bg-overlay px-3 py-1.5 font-bold text-white shadow-lg">
        <span className={state === "connected" ? "h-2 w-2 rounded-full bg-[#ff5a5a] tb-pulse" : "h-2 w-2 rounded-full bg-line"} />
        {state === "connected" ? "보호자에게 영상 공유 중" : error ? "영상 공유 대기" : "영상 공유 준비"}
        <Icon name="video" size={18} />
      </button>
      <div className={open ? "w-36 overflow-hidden rounded-xl border-2 border-white bg-black shadow-xl" : "hidden"}>
        <video ref={previewRef} autoPlay muted playsInline className="aspect-video w-full object-cover" />
        {error && (
          <button type="button" onClick={() => start(live.id)} className="t14 w-full bg-surface px-2 py-1 font-bold text-brand">
            {error} 다시 켜기
          </button>
        )}
      </div>
    </div>
  );
}
