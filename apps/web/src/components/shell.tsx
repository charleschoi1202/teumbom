"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useSession } from "@/lib/session";
import type { Role } from "@/lib/api";
import { Icon } from "./Icon";
import { cx } from "./ui";

type Tab = { href: string; label: string; icon: string; match: string[] };

export const GUARDIAN_TABS: Tab[] = [
  { href: "/g/home", label: "홈", icon: "home", match: ["/g/home"] },
  { href: "/g/find", label: "선생님 찾기", icon: "search", match: ["/g/find", "/g/recommend", "/g/teachers", "/g/request"] },
  { href: "/g/visits", label: "방문 일정", icon: "calendar", match: ["/g/visits", "/g/notice", "/g/live", "/g/paid"] },
  { href: "/g/reports", label: "리포트", icon: "doc", match: ["/g/reports"] },
];
export const TEACHER_TABS: Tab[] = [
  { href: "/t/visits", label: "방문 일정", icon: "calendar", match: ["/t/visits", "/t/schedule"] },
  { href: "/t/credential", label: "교원 자격", icon: "shield", match: ["/t/credential", "/t/profile"] },
];

const HOME: Record<Role, string> = { guardian: "/g/home", teacher: "/t/visits" };

function active(path: string, tab: Tab) {
  return tab.match.some((m) => path === m || path.startsWith(m + "/"));
}

/** Mobile bottom navigation (Figma Navigation / Guardian · Teacher). Hidden on desktop where the sidebar takes over. */
export function BottomTabs({ role }: { role: "guardian" | "teacher" }) {
  const path = usePathname();
  const tabs = role === "guardian" ? GUARDIAN_TABS : TEACHER_TABS;
  return (
    <>
      <div className="h-24 lg:hidden" aria-hidden />
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-soft bg-surface lg:hidden" aria-label="주요 메뉴">
        <div className={cx("mx-auto grid max-w-[480px]", tabs.length === 4 ? "grid-cols-4 px-2" : "grid-cols-2")}>
          {tabs.map((t) => {
            const on = active(path, t);
            return (
              <Link key={t.href} href={t.href} aria-current={on ? "page" : undefined}
                className={cx("flex h-[72px] flex-col items-center justify-center gap-1", on && tabs.length === 4 ? "bg-blue-light" : "",
                  on ? "text-brand" : "text-muted")}>
                <span className={on ? "text-brand-deep" : "text-brand-deep/90"}><Icon name={t.icon} /></span>
                <span className="t14">{t.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

export function RoleSwitchLink() {
  const { role, switchRole } = useSession();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const other: Role = role === "guardian" ? "teacher" : "guardian";
  return (
    <button type="button" className="t14 text-brand lg:hidden" disabled={busy}
      onClick={async () => { setBusy(true); try { await switchRole(other); router.push(HOME[other]); } finally { setBusy(false); } }}>
      역할 전환
    </button>
  );
}

/** Route guard + responsive frame. Desktop (≥1024px) gets the operator-web style sidebar from Figma S18/S19. */
export function AppShell({ role, children }: { role: Role; children: ReactNode }) {
  const s = useSession();
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    if (!s.ready) return;
    if (!s.tokens[role]) {
      router.replace("/");
      return;
    }
    if (s.role !== role) s.activate(role);
  }, [s, role, router]);

  if (!s.ready || !s.tokens[role] || s.role !== role) {
    return <div className="t14 flex min-h-dvh items-center justify-center text-muted">불러오는 중이에요…</div>;
  }

  const tabs = role === "guardian" ? GUARDIAN_TABS : TEACHER_TABS;
  const other: Role = role === "guardian" ? "teacher" : "guardian";
  const roleLabel = role === "guardian" ? "보호자" : "선생님";

  return (
    <div className="min-h-dvh lg:flex">
      <aside className="hidden w-[240px] shrink-0 flex-col border-r border-soft bg-surface px-5 py-8 lg:flex lg:sticky lg:top-0 lg:h-dvh">
        <Link href={HOME[role]} className="t24 font-bold text-brand">틈봄</Link>
        <p className="t14 mt-2 text-muted">{roleLabel}</p>
        <div className="my-4 h-px bg-soft" />
        <nav className="flex flex-col gap-3" aria-label="주요 메뉴">
          {tabs.map((t) => {
            const on = active(path, t);
            return (
              <Link key={t.href} href={t.href} aria-current={on ? "page" : undefined}
                className={cx("t16 flex h-12 items-center justify-center gap-2 rounded-[10px] font-bold",
                  on ? "bg-brand text-white shadow-[0_3px_0_var(--color-brand-shadow)]" : "border border-brand bg-surface text-brand")}>
                {t.label}
              </Link>
            );
          })}
        </nav>
        <button type="button" onClick={async () => { await s.switchRole(other); router.push(HOME[other]); }}
          className="t16 mt-5 text-left font-bold text-brand">
          {other === "teacher" ? "선생님 화면으로 전환" : "보호자 화면으로 전환"}
        </button>
        <Link href="/" className="t16 mt-3 font-bold text-brand">시연 시작으로</Link>
      </aside>
      <main className="flex-1">
        <div className={cx("mx-auto w-full max-w-[480px] lg:max-w-[1040px] lg:px-12 lg:pb-16")}>{children}</div>
      </main>
    </div>
  );
}

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("flex flex-col gap-5 px-5 py-5 lg:px-0 lg:py-4", className)}>{children}</div>;
}
