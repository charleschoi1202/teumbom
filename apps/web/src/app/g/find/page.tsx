"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BottomTabs, Page, RoleSwitchLink } from "@/components/shell";
import { AppBarRoot, BottomAction, Button, Chip, ErrorText, Field, Info, inputCls, textareaCls } from "@/components/ui";
import { defaultCriteria, endTime, loadCriteria, saveCriteria, type Criteria } from "@/lib/find";
import { locate } from "@/lib/geo";
import { useLive, useSession } from "@/lib/session";
import type { Me } from "@/lib/types";

const ALL_TAGS = ["낯가림", "숙제 지도", "독서", "수학", "한글·받아쓰기", "영어", "놀이형 지도", "차분한 지도", "활동적인 아이", "집중력", "생활 습관", "학교 준비물", "미술"];
const TIMES = ["13:00", "14:00", "15:00", "16:00", "17:00"];

/** S03 · 어떤 선생님을 찾으세요? (+ S03-tags) */
export default function Find() {
  const { api } = useSession();
  const router = useRouter();
  const { data: me } = useLive<Me>("/api/me");
  const [c, setC] = useState<Criteria | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [engine, setEngine] = useState("");
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (c || !me) return;
    const h = me.household;
    setC(loadCriteria() ?? defaultCriteria(h.region, h.area, h.lat, h.lng));
  }, [me, c]);

  if (!c) return <><AppBarRoot title="어떤 선생님을 찾으세요?" /><BottomTabs role="guardian" /></>;

  const set = (patch: Partial<Criteria>) => setC({ ...c, ...patch });

  async function findTags() {
    setBusy(true);
    setErr("");
    try {
      const r = await api<{ tags: string[]; engine: string }>("/api/match/tags", { method: "POST", json: { text: c!.text } });
      set({ tags: r.tags });
      setEngine(r.engine);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function useMyLocation() {
    setLocating(true);
    setErr("");
    try {
      const p = await locate();
      set({ region: p.region, area: p.area, lat: p.lat, lng: p.lng });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLocating(false);
    }
  }

  function search() {
    saveCriteria(c!);
    router.push("/g/recommend");
  }

  return (
    <>
      <AppBarRoot title="어떤 선생님을 찾으세요?" right={<RoleSwitchLink />} />
      <Page>
        <div className="flex flex-col gap-5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-8">
          <div className="flex flex-col gap-5">
            <Field label="방문 지역" hint={c.lat ? `${c.area ?? ""} 기준 가까운 선생님부터 찾아요.` : undefined}>
              <input className={inputCls} value={c.region} onChange={(e) => set({ region: e.target.value })} />
            </Field>
            <button type="button" onClick={useMyLocation} disabled={locating}
              className="t14 -mt-3 self-start font-bold text-brand">{locating ? "내 위치를 찾는 중…" : "내 위치로 찾기"}</button>
            <div className="grid grid-cols-2 gap-3">
              <Field label="희망 날짜">
                <input type="date" className={inputCls} value={c.date} onChange={(e) => set({ date: e.target.value })} />
              </Field>
              <Field label="시작 시간">
                <select className={inputCls} value={c.start} onChange={(e) => set({ start: e.target.value })}>
                  {TIMES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </Field>
            </div>
            <p className="t14 -mt-2 text-muted">종료 {endTime(c.start)} · 세 시간 방문</p>
            <Field label="아이에게 어떤 도움이 필요한가요?">
              <textarea rows={3} className={textareaCls} value={c.text} maxLength={300}
                placeholder="예: 낯을 가려요. 숙제를 차분히 도와주시면 좋겠어요." onChange={(e) => set({ text: e.target.value })} />
            </Field>
            <Button kind="secondary" onClick={findTags} disabled={busy || !c.text.trim()}>{busy ? "요청을 읽는 중…" : "요청에서 태그 찾기"}</Button>
            <Field label="추가 정보 · 선택" hint="아이가 좋아하는 것을 적으면 그 맥락에 맞는 경험이 있는 선생님을 함께 찾아요.">
              <textarea rows={2} className={textareaCls} value={c.context ?? ""} maxLength={500}
                placeholder="예: 곤충이랑 식물을 좋아해요. 노래 부르는 걸 좋아해요." onChange={(e) => set({ context: e.target.value })} />
            </Field>
            <ErrorText>{err}</ErrorText>
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="t20 font-bold">찾은 조건을 확인해 주세요</h2>
            {c.tags.length > 0 ? (
              <Info>요청에서 찾은 조건이에요.{"\n"}원하지 않는 조건은 빼고 직접 확인해 주세요.{engine === "claude+rules" ? "\n(AI 분석)" : ""}</Info>
            ) : (
              <p className="t16 text-muted">요청을 적고 ‘요청에서 태그 찾기’를 누르면{"\n"}성향·과목 조건이 여기에 정리돼요.</p>
            )}
            <div className="flex flex-wrap gap-2">
              {c.tags.map((t) => <Chip key={t} selected onRemove={() => set({ tags: c.tags.filter((x) => x !== t) })}>{t}</Chip>)}
              <Chip onClick={() => setAdding((a) => !a)}>+ 태그 추가</Chip>
            </div>
            {adding && (
              <div className="flex flex-wrap gap-2 rounded-xl border border-soft bg-surface p-3">
                {ALL_TAGS.filter((t) => !c.tags.includes(t)).map((t) => (
                  <Chip key={t} onClick={() => set({ tags: [...c.tags, t] })}>{t}</Chip>
                ))}
              </div>
            )}
          </div>
        </div>
        <BottomAction aboveTabs>
          <Button onClick={search} disabled={!c.date || !c.region}>이 조건으로 찾기</Button>
        </BottomAction>
      </Page>
      <div className="lg:hidden"><BottomTabs role="guardian" /></div>
    </>
  );
}
