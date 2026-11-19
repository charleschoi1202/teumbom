export type Criteria = {
  region: string; date: string; start: string; text: string; tags: string[]; teacherId?: number;
  credentialedOnly?: boolean; video?: boolean; record?: boolean;
};

const KEY = "tb.find";

function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  if (d.getDay() === 0) d.setDate(d.getDate() + 1); // skip Sunday
  if (d.getDay() === 6) d.setDate(d.getDate() + 2); // skip Saturday
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function defaultCriteria(region = "강원특별자치도 춘천시"): Criteria {
  return {
    region, date: tomorrow(), start: "15:00",
    text: "곤충이랑 식물을 정말 좋아해요. 밖에서 관찰하는 걸 좋아하고 낯을 조금 가려요.",
    tags: [], credentialedOnly: false, video: false, record: false,
  };
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
  return region.split(" ").pop() || region;
}
