"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Page } from "@/components/shell";
import { AppBarDetail, Avatar, BottomAction, Button, Chip, ErrorText, Field, Info, inputCls, textareaCls } from "@/components/ui";
import { useLive, useSession } from "@/lib/session";
import type { Me } from "@/lib/types";

const THEMES = ["곤충", "식물·자연", "동물", "음악·노래", "춤·몸놀이", "미술·만들기", "과학·실험", "우주·별", "공룡·화석",
  "운동·바깥놀이", "요리", "책·이야기", "레고·로봇", "코딩", "영어·외국어", "수학·퍼즐", "숙제·학습"];
const TRAITS = ["차분함", "활발함", "다정함"];

/** A03 · 내 프로필 — 살아온 이야기와 아이와 나누고 싶은 테마 */
export default function Profile() {
  const { api } = useSession();
  const router = useRouter();
  const { data: me } = useLive<Me>("/api/me");
  const [f, setF] = useState({ name: "", background: "", headline: "", story: "", interests: [] as string[], traits: [] as string[] });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    const t = me?.teacher;
    if (t) setF({ name: t.name, background: t.background, headline: t.headline, story: t.story, interests: t.interests, traits: t.traits });
  }, [me]);

  const toggle = (key: "interests" | "traits", v: string) =>
    setF({ ...f, [key]: f[key].includes(v) ? f[key].filter((x) => x !== v) : [...f[key], v] });

  async function save() {
    setBusy(true);
    setErr("");
    try {
      await api("/api/me/teacher", { method: "PATCH", json: f });
      router.push("/t/schedule");
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <>
      <AppBarDetail title="내 프로필" back="/t/credential" />
      <Page>
        <div className="flex flex-col gap-5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-8">
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <Avatar initial={f.name.slice(0, 1) || "선"} size={48} />
              <p className="t14 text-muted">사진 없이 이름 첫 글자로 표시해요.</p>
            </div>
            <Field label="표시 이름"><input className={inputCls} value={f.name} maxLength={20} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="나를 한 줄로 · 하는 일이나 살아온 길"><input className={inputCls} value={f.background} maxLength={40} placeholder="예: 숲해설가 · 은퇴" onChange={(e) => setF({ ...f, background: e.target.value })} /></Field>
            <Field label="아이와 함께하고 싶은 것"><input className={inputCls} value={f.headline} maxLength={40} placeholder="예: 숲 관찰 · 곤충과 식물 이야기" onChange={(e) => setF({ ...f, headline: e.target.value })} /></Field>
            <Field label="나의 이야기" hint="자격증보다 이야기가 매칭의 핵심이에요. 즐겨 온 것, 아이들과의 경험을 적어 주세요.">
              <textarea rows={5} className={textareaCls} value={f.story} maxLength={800} onChange={(e) => setF({ ...f, story: e.target.value })} />
            </Field>
          </div>
          <div className="flex flex-col gap-4">
            <h2 className="t20 font-bold">관심 테마</h2>
            <div className="flex flex-wrap gap-2">{THEMES.map((g) => <Chip key={g} selected={f.interests.includes(g)} onClick={() => toggle("interests", g)}>{g}</Chip>)}</div>
            <h2 className="t20 font-bold">나의 성향</h2>
            <div className="flex flex-wrap gap-2">{TRAITS.map((g) => <Chip key={g} selected={f.traits.includes(g)} onClick={() => toggle("traits", g)}>{g}</Chip>)}</div>
            <Info>자격증은 선택이에요. 등록하면 배지로만 보여요.{"\n"}신원 확인과 범죄경력 조회는 모든 선생님이 거쳐요.</Info>
            <ErrorText>{err}</ErrorText>
          </div>
        </div>
        <BottomAction><Button onClick={save} disabled={busy || !f.name.trim()}>저장하고 가능 시간 설정</Button></BottomAction>
      </Page>
    </>
  );
}
