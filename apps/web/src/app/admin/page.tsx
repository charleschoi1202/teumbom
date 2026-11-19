"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ErrorText } from "@/components/ui";
import { useSession } from "@/lib/session";

/** 운영자 웹 시연 입장 */
export default function AdminEntry() {
  const s = useSession();
  const router = useRouter();
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!s.ready) return;
    if (s.tokens.admin) {
      router.replace("/admin/reviews");
      return;
    }
    s.loginAdmin().then(() => router.replace("/admin/reviews")).catch((e: Error) => setErr(e.message));
  }, [s, router]);
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6">
      <p className="t16 text-muted">운영자 웹 시연을 여는 중이에요…</p>
      <ErrorText>{err}</ErrorText>
    </div>
  );
}
