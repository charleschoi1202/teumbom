"use client";

/** Korean speech-to-text with the browser's speech recognition (Chrome/Edge/Android, Safari 14.1+). */
type Rec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

export function sttSupported(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as Record<string, unknown>;
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export function startStt(onText: (finalText: string, interim: string) => void, onError: (msg: string) => void): () => void {
  const w = window as unknown as Record<string, new () => Rec>;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  const rec = new Ctor();
  rec.lang = "ko-KR";
  rec.continuous = true;
  rec.interimResults = true;
  let finalText = "";
  let stopped = false;
  rec.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalText += r[0].transcript;
      else interim += r[0].transcript;
    }
    onText(finalText.trim(), interim.trim());
  };
  rec.onerror = (e) => {
    if (e.error === "not-allowed") onError("마이크 권한을 허용해 주세요.");
    else if (e.error !== "no-speech" && e.error !== "aborted") onError("음성을 인식하지 못했어요.");
  };
  rec.onend = () => { if (!stopped) { try { rec.start(); } catch { /* already started */ } } };
  rec.start();
  return () => { stopped = true; rec.stop(); };
}
