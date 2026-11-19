"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { Page } from "@/components/shell";
import { AppBarDetail, Avatar, BottomAction, Button, Card, ErrorText, Loading, cx } from "@/components/ui";
import { cityOf, loadCriteria, saveCriteria, shortDate, type Criteria } from "@/lib/find";
import { useSession } from "@/lib/session";
import type { Teacher } from "@/lib/types";

/** S04 · 추천 선생님 — 설명 가능한 매칭 */
export default function Recommend() {
  const { api, token } = useSession();
  const router = useRouter();
  const [c, setC] = useState<Criteria | null>(null);
  const [list, setList] = useState<Teacher[] | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    const crit = loadCriteria();
    if (!crit) { router.replace("/g/find"); return; }
    setC(crit);
  }, [router]);

  useEffect(() => {
    if (!c || !token) return;
    api<{ teachers: Teacher[] }>("/api/match/recommend", { method: "POST", json: { region: c.region, date: c.date, start: c.start, tags: c.tags } })
      .then((r) => { setList(r.teachers); setSel(r.teachers[0]?.id ?? null); })
      .catch((e: Error) => setErr(e.message));
  }, [c, api, token]);

  const chosen = list?.find((t) => t.id === sel);

  return (
    <>
      <AppBarDetail title="추천 선생님" back="/g/find" />
      <Page>
        {c && (
          <Card className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="t16 font-bold">{cityOf(c.region)} · {shortDate(c.date)} {c.start}</p>
              <p className="t14 mt-1 text-muted">{[...c.tags, "3시간"].join(" · ")}</p>
            </div>
            <Button kind="secondary" href="/g/find" className="lg:w-40">조건 수정</Button>
          </Card>
        )}
        <div className="flex items-center justify-between">
          <h2 className="t20 font-bold">추천 선생님</h2>
          {list && <span className="t14 text-muted">{list.length}명</span>}
        </div>
        <ErrorText>{err}</ErrorText>
        {!list ? <Loading label="조건에 맞는 선생님을 찾는 중이에요" /> : (
          <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-4">
            {list.map((t) => (
              <button key={t.id} type="button" onClick={() => setSel(t.id)} onDoubleClick={() => router.push(`/g/teachers/${t.id}`)}
                className={cx("flex flex-col gap-3 rounded-xl border bg-surface p-4 text-left transition",
                  sel === t.id ? "border-brand ring-2 ring-blue-light" : "border-soft")}>
                <div className="flex items-center gap-3">
                  <Avatar initial={t.initial} />
                  <div className="flex-1">
                    <p className="t16 font-bold">{t.name} 선생님</p>
                    <p className="t14 text-muted">{t.headline} · {t.region}</p>
                  </div>
                  <span className="t16 font-bold text-brand">{t.score}점</span>
                </div>
                <ul className="t14 text-muted">
                  {t.reasons.map((r) => <li key={r}>{r}</li>)}
                </ul>
                <p className="t14 flex items-center gap-3 text-brand">
                  <span className="text-brand-deep"><Icon name="shield" /></span>{t.qual_label}
                  <span className="t14 text-muted">· {t.qual_kind}</span>
                </p>
                {sel === t.id && (
                  <Link href={`/g/teachers/${t.id}`} className="t14 hidden font-bold text-brand lg:block" onClick={(e) => e.stopPropagation()}>자세히 보기 →</Link>
                )}
              </button>
            ))}
          </div>
        )}
        <BottomAction>
          <Button disabled={!chosen} onClick={() => { if (c && chosen) { saveCriteria({ ...c, teacherId: chosen.id }); router.push(`/g/teachers/${chosen.id}`); } }}>
            {chosen ? `${chosen.name} 선생님 자세히 보기` : "선생님을 선택해 주세요"}
          </Button>
        </BottomAction>
      </Page>
    </>
  );
}
