"use client";

import type { RtcMessage } from "./session";

/**
 * One-to-one live view: teacher phone (sender) → guardian (viewer).
 * Signaling rides on the room WebSocket ({type:"rtc", kind: hello|offer|answer|ice|bye}).
 * Nothing is recorded: media flows peer-to-peer (or via TURN when configured).
 */
type Send = (msg: Omit<RtcMessage, "type">) => void;

export async function iceServers(apiBase: string): Promise<RTCIceServer[]> {
  try {
    const r = await fetch(`${apiBase}/api/config`);
    const d = await r.json();
    return d.ice_servers as RTCIceServer[];
  } catch {
    return [{ urls: "stun:stun.l.google.com:19302" }];
  }
}

export class Sender {
  private pc: RTCPeerConnection | null = null;
  stream: MediaStream | null = null;
  onState?: (s: RTCPeerConnectionState | "idle") => void;

  constructor(private send: Send, private ice: RTCIceServer[], readonly visitId: number) {}

  async startCamera(): Promise<MediaStream> {
    if (this.stream) return this.stream;
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" }, width: { ideal: 960 }, height: { ideal: 540 }, frameRate: { ideal: 24, max: 30 } },
      audio: false,
    });
    return this.stream;
  }

  /** A viewer said hello: (re)negotiate a fresh connection to it. */
  async connect() {
    if (!this.stream) return;
    this.pc?.close();
    const pc = new RTCPeerConnection({ iceServers: this.ice });
    this.pc = pc;
    this.stream.getTracks().forEach((t) => pc.addTrack(t, this.stream!));
    pc.onicecandidate = (e) => e.candidate && this.send({ kind: "ice", visit: this.visitId, candidate: e.candidate.toJSON() });
    pc.onconnectionstatechange = () => this.onState?.(pc.connectionState);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.send({ kind: "offer", visit: this.visitId, sdp: offer.sdp });
  }

  async handle(msg: RtcMessage) {
    if (msg.visit !== this.visitId) return;
    if (msg.kind === "hello") await this.connect();
    else if (msg.kind === "answer" && this.pc) await this.pc.setRemoteDescription({ type: "answer", sdp: msg.sdp as string });
    else if (msg.kind === "ice" && this.pc && msg.candidate) {
      try { await this.pc.addIceCandidate(msg.candidate as RTCIceCandidateInit); } catch { /* late candidate */ }
    } else if (msg.kind === "bye") {
      this.pc?.close();
      this.pc = null;
      this.onState?.("idle");
    }
  }

  stop() {
    this.send({ kind: "bye", visit: this.visitId });
    this.pc?.close();
    this.pc = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.onState?.("idle");
  }
}

export class Viewer {
  private pc: RTCPeerConnection | null = null;
  onStream?: (s: MediaStream | null) => void;
  onState?: (s: RTCPeerConnectionState | "waiting" | "ended") => void;

  constructor(private send: Send, private ice: RTCIceServer[], readonly visitId: number) {}

  hello() {
    this.send({ kind: "hello", visit: this.visitId });
  }

  async handle(msg: RtcMessage) {
    if (msg.visit !== this.visitId) return;
    if (msg.kind === "offer") {
      this.pc?.close();
      const pc = new RTCPeerConnection({ iceServers: this.ice });
      this.pc = pc;
      pc.ontrack = (e) => this.onStream?.(e.streams[0] ?? new MediaStream([e.track]));
      pc.onicecandidate = (e) => e.candidate && this.send({ kind: "ice", visit: this.visitId, candidate: e.candidate.toJSON() });
      pc.onconnectionstatechange = () => this.onState?.(pc.connectionState);
      await pc.setRemoteDescription({ type: "offer", sdp: msg.sdp as string });
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.send({ kind: "answer", visit: this.visitId, sdp: answer.sdp });
    } else if (msg.kind === "ice" && this.pc && msg.candidate) {
      try { await this.pc.addIceCandidate(msg.candidate as RTCIceCandidateInit); } catch { /* ignore */ }
    } else if (msg.kind === "bye") {
      this.close();
      this.onState?.("ended");
    }
  }

  get connected() {
    return this.pc?.connectionState === "connected";
  }

  close() {
    this.pc?.close();
    this.pc = null;
    this.onStream?.(null);
  }
}
