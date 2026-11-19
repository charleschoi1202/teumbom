"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  ApiError, loadRole, loadRoom, loadTokens, request, saveRole, saveRoom, saveTokens, wsBase, type Role,
} from "./api";

type RtcHandler = (msg: RtcMessage) => void;
export type RtcMessage = { type: "rtc"; kind: string; from?: Role; [k: string]: unknown };

type Session = {
  ready: boolean;
  role: Role | null;
  room: string | null;
  token: string | null;
  tokens: Partial<Record<Role, string>>;
  peers: string[];
  version: number;
  connected: boolean;
  startRoom: () => Promise<void>;
  joinRoom: (code: string, role: Role) => Promise<void>;
  switchRole: (role?: Role) => void;
  signOut: () => void;
  api: <T>(path: string, init?: RequestInit & { json?: unknown }) => Promise<T>;
  sendRtc: (msg: Omit<RtcMessage, "type">) => void;
  onRtc: (fn: RtcHandler) => () => void;
};

const Ctx = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [tokens, setTokens] = useState<Partial<Record<Role, string>>>({});
  const [role, setRole] = useState<Role | null>(null);
  const [room, setRoom] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [peers, setPeers] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const rtcHandlers = useRef(new Set<RtcHandler>());

  useEffect(() => {
    setTokens(loadTokens());
    setRole(loadRole());
    setRoom(loadRoom());
    setReady(true);
  }, []);

  const token = role ? tokens[role] ?? null : null;

  // one socket per active identity; reconnects with backoff
  useEffect(() => {
    if (!token) return;
    let alive = true;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ping: ReturnType<typeof setInterval> | undefined;
    const open = () => {
      const ws = new WebSocket(`${wsBase()}/ws?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;
      ws.onopen = () => {
        retry = 0;
        setConnected(true);
        setVersion((v) => v + 1);
        ping = setInterval(() => ws.readyState === 1 && ws.send('{"type":"ping"}'), 25000);
      };
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === "changed") setVersion((v) => v + 1);
        else if (msg.type === "presence") setPeers(msg.peers);
        else if (msg.type === "rtc") rtcHandlers.current.forEach((fn) => fn(msg));
      };
      ws.onclose = (e) => {
        setConnected(false);
        if (ping) clearInterval(ping);
        if (!alive || e.code === 4401) return;
        timer = setTimeout(open, Math.min(8000, 800 * 2 ** retry++));
      };
    };
    open();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      if (ping) clearInterval(ping);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [token, role]);

  const persist = useCallback((t: Partial<Record<Role, string>>, r: Role | null, code: string | null) => {
    setTokens(t);
    setRole(r);
    setRoom(code);
    saveTokens(t);
    saveRole(r);
    saveRoom(code);
  }, []);

  const startRoom = useCallback(async () => {
    const g = await request<{ code: string; token: string }>("/api/rooms", { method: "POST" });
    // same device also holds the teacher identity so "역할 전환" works with one phone
    const t = await request<{ token: string }>(`/api/rooms/${g.code}/join`, { method: "POST", json: { role: "teacher" } });
    persist({ guardian: g.token, teacher: t.token }, "guardian", g.code);
  }, [persist]);

  const joinRoom = useCallback(async (code: string, r: Role) => {
    const res = await request<{ code: string; token: string }>(`/api/rooms/${code}/join`, { method: "POST", json: { role: r } });
    persist({ ...(room === res.code ? tokens : {}), [r]: res.token }, r, res.code);
  }, [persist, room, tokens]);

  const switchRole = useCallback((next?: Role) => {
    const target: Role = next ?? (role === "guardian" ? "teacher" : "guardian");
    if (!tokens[target]) return;
    setRole(target);
    saveRole(target);
  }, [role, tokens]);

  const signOut = useCallback(() => persist({}, null, null), [persist]);

  const api = useCallback(async <T,>(path: string, init: RequestInit & { json?: unknown } = {}) => {
    try {
      return await request<T>(path, { ...init, token });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) persist({}, null, null);
      throw e;
    }
  }, [token, persist]);

  const sendRtc = useCallback((msg: Omit<RtcMessage, "type">) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: "rtc", ...msg }));
  }, []);

  const onRtc = useCallback((fn: RtcHandler) => {
    rtcHandlers.current.add(fn);
    return () => {
      rtcHandlers.current.delete(fn);
    };
  }, []);

  const value = useMemo<Session>(() => ({
    ready, role, room, token, tokens, peers, version, connected,
    startRoom, joinRoom, switchRole, signOut, api, sendRtc, onRtc,
  }), [ready, role, room, token, tokens, peers, version, connected, startRoom, joinRoom, switchRole, signOut, api, sendRtc, onRtc]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): Session {
  const s = useContext(Ctx);
  if (!s) throw new Error("SessionProvider missing");
  return s;
}

/** Fetch a resource and refetch whenever the server pushes a change for this room. */
export function useLive<T>(path: string | null) {
  const { api, version, token } = useSession();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!path || !token) return;
    let stale = false;
    api<T>(path)
      .then((d) => { if (!stale) { setData(d); setError(null); } })
      .catch((e: Error) => { if (!stale) setError(e.message); })
      .finally(() => { if (!stale) setLoading(false); });
    return () => { stale = true; };
  }, [path, version, tick, api, token]);
  return { data, error, loading, reload: () => setTick((t) => t + 1), setData };
}
