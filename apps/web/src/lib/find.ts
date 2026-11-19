export type Criteria = {
  region: string; date: string; start: string; text: string; tags: string[]; teacherId?: number;
  area?: string; lat?: number | null; lng?: number | null;
  context?: string; // 추가 정보(선택) — 맥락에 맞는 경험이 있는 선생님을 함께 찾음
};

const KEY = "tb.find";

function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  if (d.getDay() === 0) d.setDate(d.getDate() + 1); // skip Sunday
  if (d.getDay() === 6) d.setDate(d.getDate() + 2); // skip Saturday
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function defaultCriteria(region = "강원특별자치도 춘천시 석사동", area = "석사동", lat: number | null = null, lng: number | null = null): Criteria {
  return { region, area, lat, lng, date: tomorrow(), start: "15:00", text: "낯을 가려요. 숙제를 차분히 도와주시면 좋겠어요.", tags: [], context: "" };
}

const RECO = "tb.reco";
export function saveReasons(map: Record<number, { score: number | null; reasons: string[] }>) {
  try { sessionStorage.setItem(RECO, JSON.stringify(map)); } catch { /* ignore */ }
}
export function loadReasons(): Record<number, { score: number | null; reasons: string[] }> {
  try { return JSON.parse(sessionStorage.getItem(RECO) || "{}"); } catch { return {}; }
}

export function loadCriteria(): Criteria | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Criteria) : null;
  } catch {
    return null;
  }
}

export function saveCriteria(c: Criteria) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    /* ignore */
  }
}

const WEEK = "일월화수목금토";
export function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, "0")} (${WEEK[d.getDay()]})`;
}
export function longDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEK[d.getDay()]})`;
}
export function endTime(start: string, hours = 3): string {
  const [h, m] = start.split(":").map(Number);
  return `${String((h + hours) % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
export function cityOf(region: string): string {
  const parts = region.split(" ");
  return parts.length >= 2 ? parts.slice(-2).join(" ").replace(/^강원특별자치도 /, "") : region;
}
