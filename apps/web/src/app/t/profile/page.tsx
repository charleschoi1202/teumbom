"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Page } from "@/components/shell";
import { AppBarDetail, Avatar, BottomAction, Button, ErrorText, Field, Info, inputCls, textareaCls } from "@/components/ui";
import { useLive, useSession } from "@/lib/session";
import type { Me } from "@/lib/types";

/** A03 · 내 프로필 */
export default function Profile() {
  const { api } = useSession();
  const router = useRouter();
  const { data: me } = useLive<Me>("/api/me");
  const [f, setF] = useState({ name: "", headline: "", intro: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (me?.teacher) setF({ name: me.teacher.name, headline: me.teacher.headline, intro: me.teacher.intro });
  }, [me]);

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
      <Page className="lg:max-w-[560px]">
        <div className="flex items-center gap-3">
          <Avatar initial={f.name.slice(0, 1) || "선"} size={48} />
          <p className="t14 text-muted">사진 없이 이름 첫 글자로 표시해요.</p>
        </div>
        <Field label="표시 이름"><input className={inputCls} value={f.name} maxLength={20} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="지도 경험"><input className={inputCls} value={f.headline} maxLength={40} onChange={(e) => setF({ ...f, headline: e.target.value })} /></Field>
        <Field label="활동 소개"><textarea rows={3} className={textareaCls} value={f.intro} maxLength={400} onChange={(e) => setF({ ...f, intro: e.target.value })} /></Field>
        <Info>공개 프로필과 자격 확인은 별개예요.{"\n"}자격 확인 전에는 검색에 공개되지 않아요.</Info>
        <ErrorText>{err}</ErrorText>
        <BottomAction><Button onClick={save} disabled={busy || !f.name.trim()}>저장하고 가능 시간 설정</Button></BottomAction>
      </Page>
    </>
  );
}
