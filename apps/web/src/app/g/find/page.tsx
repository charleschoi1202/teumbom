"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BottomTabs, Page, RoleSwitchLink } from "@/components/shell";
import { AppBarRoot, BottomAction, Button, CheckRow, Chip, ErrorText, Field, Info, inputCls, textareaCls } from "@/components/ui";
import { defaultCriteria, endTime, loadCriteria, saveCriteria, type Criteria } from "@/lib/find";
import { useLive, useSession } from "@/lib/session";
import type { Me } from "@/lib/types";

const THEMES = ["곤충", "식물·자연", "동물", "음악·노래", "춤·몸놀이", "미술·만들기", "과학·실험", "우주·별", "공룡·화석",
  "운동·바깥놀이", "요리", "책·이야기", "레고·로봇", "코딩", "영어·외국어", "수학·퍼즐", "숙제·학습"];
const TRAITS = ["낯가림", "활발함", "차분함", "다정함"];
const TIMES = ["13:00", "14:00", "15:00", "16:00", "17:00"];
const EXAMPLES = [
  "곤충이랑 식물을 정말 좋아해요. 밖에서 관찰하는 걸 좋아하고 낯을 조금 가려요.",
  "노래 부르는 걸 좋아해요. 피아노도 쳐 보고 싶어 해요.",
  "공룡이랑 우주 이야기를 하면 시간 가는 줄 몰라요.",
  "에너지가 넘쳐요. 밖에서 뛰어놀고 숙제도 조금 봐 주시면 좋겠어요.",
];

/** S03 · 어떤 선생님을 찾으세요? — 아이의 이야기로 찾기 (+ S03-tags) */
export default function Find() {
  const { api } = useSession();
  const router = useRouter();
  const { data: me } = useLive<Me>("/api/me");
  const [c, setC] = useState<Criteria | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (c || !me) return;
    setC(loadCriteria() ?? defaultCriteria(me.household.region));
  }, [me, c]);

  if (!c) return <><AppBarRoot title="어떤 선생님을 찾으세요?" /><BottomTabs role="guardian" /></>;

  const set = (patch: Partial<Criteria>) => setC({ ...c, ...patch });

  async function findTags(text = c!.text) {
    setBusy(true);
    setErr("");
    try {
      const r = await api<{ tags: string[] }>("/api/match/tags", { method: "POST", json: { text } });
      setC((prev) => ({ ...prev!, text, tags: r.tags }));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
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
            <Field label="아이가 좋아하는 것, 함께했으면 하는 것">
              <textarea rows={4} className={textareaCls} value={c.text} maxLength={500}
                placeholder="예: 곤충이랑 식물을 좋아해요. 노래 부르는 걸 좋아해요." onChange={(e) => set({ text: e.target.value })} />
            </Field>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <button key={ex} type="button" onClick={() => findTags(ex)}
                  className="t14 rounded-full border border-soft bg-surface px-3 py-1.5 text-left text-muted">
                  {ex.split(".")[0]}
                </button>
              ))}
            </div>
            <Button kind="secondary" onClick={() => findTags()} disabled={busy || !c.text.trim()}>{busy ? "이야기를 읽는 중…" : "이야기에서 테마 찾기"}</Button>
            <ErrorText>{err}</ErrorText>
            <Field label="방문 지역">
              <input className={inputCls} value={c.region} onChange={(e) => set({ region: e.target.value })} />
            </Field>
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
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="t20 font-bold">찾은 테마를 확인해 주세요</h2>
            {c.tags.length > 0 ? (
              <Info>아이의 이야기에서 찾은 테마와 성향이에요.{"\n"}이 테마를 삶에서 즐겨 온 선생님을 찾아요. 자격증 유무와 관계없어요.</Info>
            ) : (
              <p className="t16 text-muted">아이가 좋아하는 것을 적고 ‘이야기에서 테마 찾기’를 누르면{"\n"}곤충·음악·요리 같은 테마가 여기에 정리돼요.</p>
            )}
            <div className="flex flex-wrap gap-2">
              {c.tags.map((t) => <Chip key={t} selected onRemove={() => set({ tags: c.tags.filter((x) => x !== t) })}>{t}</Chip>)}
              <Chip onClick={() => setAdding((a) => !a)}>+ 테마 추가</Chip>
            </div>
            {adding && (
              <div className="flex flex-wrap gap-2 rounded-xl border border-soft bg-surface p-3">
                {[...THEMES, ...TRAITS].filter((t) => !c.tags.includes(t)).map((t) => (
                  <Chip key={t} onClick={() => set({ tags: [...c.tags, t] })}>{t}</Chip>
                ))}
              </div>
            )}
            <h3 className="t16 mt-3 font-bold">선택 옵션</h3>
            <div className="rounded-xl border border-soft bg-surface px-3">
              <CheckRow checked={!!c.credentialedOnly} onChange={(v) => set({ credentialedOnly: v })} label="교원·보육 자격이 있는 분만 보기" />
              <CheckRow checked={!!c.video} onChange={(v) => set({ video: v, record: v ? c.record : false })} label="방문 중 실시간 영상 공유" />
              {c.video && <CheckRow checked={!!c.record} onChange={(v) => set({ record: v })} label="녹화도 원해요 (보호자 휴대폰에만 저장)" />}
            </div>
            <p className="t14 text-muted">모든 선생님은 신원 확인과 범죄경력 조회를 마쳤어요. 그 밖의 조건은 모두 선택이에요.</p>
          </div>
        </div>
        <BottomAction aboveTabs>
          <Button onClick={search} disabled={!c.date || !c.region || (!c.text.trim() && c.tags.length === 0)}>이 이야기로 선생님 찾기</Button>
        </BottomAction>
      </Page>
      <div className="lg:hidden"><BottomTabs role="guardian" /></div>
    </>
  );
}
