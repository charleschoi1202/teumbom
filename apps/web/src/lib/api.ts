export type Role = "guardian" | "teacher";

export function apiBase(): string {
  const env = process.env.NEXT_PUBLIC_API_URL;
  if (env) return env.replace(/\/$/, "");
  if (typeof window !== "undefined") return `${window.location.protocol}//${window.location.hostname}:8000`;
  return "http://localhost:8000";
}

export function wsBase(): string {
  return apiBase().replace(/^http/, "ws");
}

const TOKENS = "tb.tokens";
const ROLE = "tb.role";

type Tokens = Partial<Record<Role, string>>;

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* private mode: session only lives in memory */
  }
}

export function loadTokens(): Tokens {
  try {
    return JSON.parse(safeGet(TOKENS) || "{}");
  } catch {
    return {};
  }
}
export function saveTokens(t: Tokens) {
  safeSet(TOKENS, JSON.stringify(t));
}
export function loadRole(): Role | null {
  return (safeGet(ROLE) as Role) || null;
}
export function saveRole(r: Role | null) {
  safeSet(ROLE, r);
}
/** Drops the storage key of the old room-code version so it never lingers. */
export function clearLegacy() {
  safeSet("tb.room", null);
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function request<T>(path: string, init: RequestInit & { token?: string | null; json?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  let body = init.body;
  if (init.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.json);
  }
  let res: Response;
  try {
    res = await fetch(`${apiBase()}${path}`, { ...init, headers, body });
  } catch {
    throw new ApiError(0, "서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.");
  }
  if (!res.ok) {
    let msg = "요청을 처리하지 못했어요.";
    try {
      const data = await res.json();
      if (typeof data.detail === "string") msg = data.detail;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, msg);
  }
  return (await res.json()) as T;
}
