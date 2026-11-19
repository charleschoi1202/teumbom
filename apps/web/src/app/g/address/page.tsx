"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Page } from "@/components/shell";
import { AppBarDetail, BottomAction, Button, ErrorText, Field, Info, inputCls } from "@/components/ui";
import { locate } from "@/lib/geo";
import { useLive, useSession } from "@/lib/session";
import type { Me } from "@/lib/types";

/** A02 · 방문지 설정 */
export default function Address() {
  const { api } = useSession();
  const router = useRouter();
  const { data: me } = useLive<Me>("/api/me");
  const [f, setF] = useState({ region: "", address: "", address_detail: "", area: "", lat: null as number | null, lng: null as number | null });
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (me) {
      const h = me.household;
      setF({ region: h.region, address: h.address, address_detail: h.address_detail, area: h.area, lat: h.lat, lng: h.lng });
    }
  }, [me]);

  async function useMyLocation() {
    setLocating(true);
    setErr("");
    try {
      const p = await locate();
      setF((x) => ({ ...x, region: p.region, area: p.area, lat: p.lat, lng: p.lng, address: p.road ? `${p.city} ${p.road}` : x.address }));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLocating(false);
    }
  }

  async function save() {
    setBusy(true);
    setErr("");
    try {
      await api("/api/me/household", { method: "PATCH", json: f });
      router.push("/g/home");
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <>
      <AppBarDetail title="방문지 설정" back="/g/home" />
      <Page className="lg:max-w-[560px]">
        <Info>상세 주소는 예약이 확정된{"\n"}담당 선생님에게만 공개돼요.</Info>
        <Field label="방문 지역"><input className={inputCls} value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })} /></Field>
        <button type="button" onClick={useMyLocation} disabled={locating} className="t14 -mt-3 self-start font-bold text-brand">
          {locating ? "내 위치를 찾는 중…" : "현재 위치로 설정"}
        </button>
        <Field label="주소"><input className={inputCls} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
        <Field label="상세 주소"><input className={inputCls} value={f.address_detail} onChange={(e) => setF({ ...f, address_detail: e.target.value })} /></Field>
        <p className="t14 text-muted">이 주소는 시연용 가상 정보입니다.</p>
        <p className="t16 text-muted">수정해도 이미 확정된 방문의 약속 장소는 바뀌지 않아요.</p>
        <ErrorText>{err}</ErrorText>
        <BottomAction><Button onClick={save} disabled={busy || f.region.length < 2 || f.address.length < 2}>방문지 저장</Button></BottomAction>
      </Page>
    </>
  );
}
