"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  ApiError, clearLegacy, loadRole, loadTokens, request, saveRole, saveTokens, wsBase, type Role,
} from "./api";

type RtcHandler = (msg: RtcMessage) => void;
export type RtcMessage = { type: "rtc"; kind: string; from?: Role; [k: string]: unknown };

type Session = {
  ready: boolean;
  role: Role | null;
  token: string | null;
  tokens: Partial<Record<Role, string>>;
  version: number;
  connected: boolean;
  /** 보호자로 시작: 이 기기에 새 보호자 계정 */
  startGuardian: () => Promise<void>;
  /** 선생님으로 시작: 시연 선생님 계정(기본 김하늘) */
  startTeacher: (teacherId?: number) => Promise<void>;
  /** 이미 가진 계정으로 화면만 바꿔요 */
  activate: (role: Role) => void;
  /** 한 휴대폰 시연용 역할 전환: 보호자 → 방금 요청한 선생님 계정 */
  switchRole: (role?: Role) => Promise<void>;
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
  const [version, setVersion] = useState(0);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const rtcHandlers = useRef(new Set<RtcHandler>());

  useEffect(() => {
    setTokens(loadTokens());
    setRole(loadRole());
    clearLegacy();
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

  const persist = useCallback((t: Partial<Record<Role, string>>, r: Role | null) => {
    setTokens(t);
    setRole(r);
    saveTokens(t);
    saveRole(r);
  }, []);

  const startGuardian = useCallback(async () => {
    const g = await request<{ token: string }>("/api/auth/guardian", { method: "POST" });
    persist({ ...tokens, guardian: g.token }, "guardian");
  }, [persist, tokens]);

  const startTeacher = useCallback(async (teacherId?: number) => {
    const t = await request<{ token: string }>("/api/auth/teacher", { method: "POST", json: { teacher_id: teacherId ?? null } });
    persist({ ...tokens, teacher: t.token }, "teacher");
  }, [persist, tokens]);

  const activate = useCallback((next: Role) => {
    if (!tokens[next]) return;
    setRole(next);
    saveRole(next);
  }, [tokens]);

  const switchRole = useCallback(async (next?: Role) => {
    const target: Role = next ?? (role === "guardian" ? "teacher" : "guardian");
    if (target === "guardian") {
      if (tokens.guardian) activate("guardian");
      else await startGuardian();
      return;
    }
    // 보호자가 가장 최근에 요청한 선생님 계정으로 전환해요(없으면 기본 시연 선생님).
    let teacherId: number | undefined;
    if (tokens.guardian) {
      try {
        const res = await request<{ visits: { teacher: { id: number } }[] }>("/api/visits", { token: tokens.guardian });
        teacherId = res.visits[0]?.teacher.id;
      } catch { /* fall back to the default teacher */ }
    }
    await startTeacher(teacherId);
  }, [role, tokens, activate, startGuardian, startTeacher]);

  const signOut = useCallback(() => persist({}, null), [persist]);

  const api = useCallback(async <T,>(path: string, init: RequestInit & { json?: unknown } = {}) => {
    try {
      return await request<T>(path, { ...init, token });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) persist({}, null);
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
    ready, role, token, tokens, version, connected,
    startGuardian, startTeacher, activate, switchRole, signOut, api, sendRtc, onRtc,
  }), [ready, role, token, tokens, version, connected, startGuardian, startTeacher, activate, switchRole, signOut, api, sendRtc, onRtc]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): Session {
  const s = useContext(Ctx);
  if (!s) throw new Error("SessionProvider missing");
  return s;
}

/** Fetch a resource and refetch whenever the server pushes a change for this account. */
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
