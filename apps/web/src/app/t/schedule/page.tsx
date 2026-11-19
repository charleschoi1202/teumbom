"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Page } from "@/components/shell";
import { AppBarDetail, BottomAction, Button, Chip, ErrorText, Field, Info, inputCls } from "@/components/ui";
import { endTime } from "@/lib/find";
import { locate } from "@/lib/geo";
import { useLive, useSession } from "@/lib/session";
import type { Me } from "@/lib/types";

const RADII = [1, 3, 5, 10];
const DAYS = ["월", "화", "수", "목", "금"];
const TIMES = ["13:00", "14:00", "15:00", "16:00"];

/** A04 · 방문 가능 일정 */
export default function Schedule() {
  const { api } = useSession();
  const router = useRouter();
  const { data: me } = useLive<Me>("/api/me");
  const [place, setPlace] = useState({ region: "", area: "", lat: null as number | null, lng: null as number | null });
  const [radius, setRadius] = useState(5);
  const [locating, setLocating] = useState(false);
  const [days, setDays] = useState<string[]>([]);
  const [start, setStart] = useState("15:00");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (me?.teacher) {
      const t = me.teacher;
      setPlace({ region: t.region, area: t.area, lat: null, lng: null });
      setRadius(t.radius_km);
      setDays(t.days);
      setStart(t.start_time);
    }
  }, [me]);

  async function save() {
    setBusy(true);
    setErr("");
    try {
      const loc = place.lat != null ? { region: place.region, area: place.area, lat: place.lat, lng: place.lng } : {};
      await api("/api/me/teacher", { method: "PATCH", json: { ...loc, radius_km: radius, days, start_time: start } });
      router.push("/t/visits");
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <>
      <AppBarDetail title="방문 가능 일정" back="/t/visits" />
      <Page className="lg:max-w-[560px]">
        <h2 className="t20 font-bold">방문 가능한 지역</h2>
        <p className="t16">{place.region} {place.area} 중심</p>
        <button type="button" disabled={locating} className="t14 -mt-3 self-start font-bold text-brand" onClick={async () => {
          setLocating(true);
          setErr("");
          try {
            const p = await locate();
            setPlace({ region: p.city || p.region, area: p.area, lat: p.lat, lng: p.lng });
          } catch (e) {
            setErr((e as Error).message);
          } finally {
            setLocating(false);
          }
        }}>{locating ? "내 위치를 찾는 중…" : "현재 위치로 설정"}</button>
        <div className="flex flex-wrap gap-2">{RADII.map((r) => <Chip key={r} selected={radius === r} onClick={() => setRadius(r)}>반경 {r}km</Chip>)}</div>
        <h2 className="t20 font-bold">방문 가능한 요일</h2>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((d) => (
            <Chip key={d} selected={days.includes(d)} onClick={() => setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort((a, b) => DAYS.indexOf(a) - DAYS.indexOf(b)))}>{d}요일</Chip>
          ))}
        </div>
        <Field label="시작 시간">
          <select className={inputCls} value={start} onChange={(e) => setStart(e.target.value)}>{TIMES.map((t) => <option key={t}>{t}</option>)}</select>
        </Field>
        <Info>방문 종료 {endTime(start)} · 3시간{"\n"}이미 확정된 약속은 그대로 유지돼요.</Info>
        <p className="t16 text-muted">선택한 지역과 시간이 맞는 요청만 받아요.</p>
        <ErrorText>{err}</ErrorText>
        <BottomAction><Button onClick={save} disabled={busy || days.length === 0}>가능 일정 저장</Button></BottomAction>
      </Page>
    </>
  );
}
