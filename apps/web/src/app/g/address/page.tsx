"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Page } from "@/components/shell";
import { AppBarDetail, BottomAction, Button, ErrorText, Field, Info, inputCls } from "@/components/ui";
import { useLive, useSession } from "@/lib/session";
import type { Me } from "@/lib/types";

/** A02 · 방문지 설정 */
export default function Address() {
  const { api } = useSession();
  const router = useRouter();
  const { data: me } = useLive<Me>("/api/me");
  const [f, setF] = useState({ region: "", address: "", address_detail: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (me) setF({ region: me.household.region, address: me.household.address, address_detail: me.household.address_detail });
  }, [me]);

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
