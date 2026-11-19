"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon } from "./Icon";
import type { Phase } from "@/lib/types";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/* ── Button (Primary / Secondary / Disabled / Danger / Text) ── */
type Kind = "primary" | "secondary" | "danger" | "text" | "disabled";
const KIND: Record<Kind, string> = {
  primary: "bg-brand text-white shadow-[0_3px_0_var(--color-brand-shadow)] active:translate-y-[2px] active:shadow-[0_1px_0_var(--color-brand-shadow)]",
  secondary: "bg-surface text-brand border border-brand",
  danger: "bg-danger text-white",
  text: "bg-transparent text-brand",
  disabled: "bg-disabled text-muted",
};

export function Button({ kind = "primary", className, children, href, disabled, ...rest }:
  { kind?: Kind; href?: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const k: Kind = disabled ? "disabled" : kind;
  const cls = cx("t16 font-bold h-12 w-full rounded-[10px] flex items-center justify-center gap-2 px-4 transition select-none", KIND[k], className);
  if (href && !disabled) return <Link href={href} className={cls}>{children}</Link>;
  return <button className={cls} disabled={disabled} {...rest}>{children}</button>;
}

export function TextLink({ href, onClick, children, className }: { href?: string; onClick?: () => void; children: ReactNode; className?: string }) {
  const cls = cx("t16 font-bold text-brand inline-flex items-center min-h-12", className);
  return href ? <Link href={href} className={cls}>{children}</Link> : <button type="button" onClick={onClick} className={cls}>{children}</button>;
}

/* ── Chip ── */
export function Chip({ selected, disabled, children, onClick, onRemove }:
  { selected?: boolean; disabled?: boolean; children: ReactNode; onClick?: () => void; onRemove?: () => void }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      className={cx("t14 h-12 px-4 rounded-[10px] border inline-flex items-center gap-1 whitespace-nowrap",
        selected ? "bg-blue-light border-brand text-brand" : disabled ? "bg-disabled border-soft text-muted" : "bg-surface border-soft text-muted")}>
      {children}
      {onRemove && (
        <span role="button" aria-label="태그 빼기" onClick={(e) => { e.stopPropagation(); onRemove(); }} className="ml-0.5 text-[15px] leading-none">×</span>
      )}
    </button>
  );
}

/* ── Badge ── */
const BADGE: Record<string, [string, string]> = {
  WAIT: ["bg-wait", "text-wait-ink"],
  BOOKED: ["bg-blue-light", "text-brand"],
  LIVE: ["bg-live", "text-live-ink"],
  DRAFT: ["bg-draft", "text-draft-ink"],
  SENT: ["bg-sent", "text-sent-ink"],
  CLOSED: ["bg-closed", "text-closed-ink"],
  ERROR: ["bg-error", "text-error-ink"],
};
export function Badge({ tone, children }: { tone: keyof typeof BADGE; children: ReactNode }) {
  const [bg, fg] = BADGE[tone];
  return <span className={cx("t14 inline-flex items-center rounded-md px-2 py-1", bg, fg)}>{children}</span>;
}

export const PHASE_BADGE: Record<Phase, { tone: keyof typeof BADGE; label: string }> = {
  requested: { tone: "WAIT", label: "요청 중" },
  declined: { tone: "CLOSED", label: "요청 거절" },
  payment: { tone: "WAIT", label: "결제 대기" },
  booked: { tone: "BOOKED", label: "예약 확정" },
  reading: { tone: "BOOKED", label: "예약 확정" },
  approved: { tone: "BOOKED", label: "예약 확정" },
  live: { tone: "LIVE", label: "방문 중" },
  draft: { tone: "DRAFT", label: "리포트 작성 중" },
  sent: { tone: "SENT", label: "리포트 발송 완료" },
  cancelled: { tone: "CLOSED", label: "예약 취소" },
};
export function PhaseBadge({ phase }: { phase: Phase }) {
  const b = PHASE_BADGE[phase];
  return <Badge tone={b.tone}>{b.label}</Badge>;
}

/* ── Field ── */
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="t14 text-muted">{label}</span>
      {children}
      {hint && <span className="t14 text-muted">{hint}</span>}
    </label>
  );
}
export const inputCls = "t16 w-full h-[50px] rounded-[10px] border border-line bg-surface px-3 text-ink placeholder:text-line outline-none focus:border-brand focus:ring-2 focus:ring-blue-light";
export const textareaCls = "t16 w-full min-h-[50px] rounded-[10px] border border-line bg-surface px-3 py-3 text-ink placeholder:text-line outline-none focus:border-brand focus:ring-2 focus:ring-blue-light resize-none";

/* ── Avatar ── */
export function Avatar({ initial, size = 56 }: { initial: string; size?: number }) {
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-blue-light font-bold text-brand"
      style={{ width: size, height: size, fontSize: size * 0.43 }}>{initial}</span>
  );
}

/* ── Check row (Unchecked / Checked / Locked) ── */
export function CheckRow({ checked, locked, label, onChange, large }:
  { checked: boolean; locked?: boolean; label: ReactNode; onChange?: (v: boolean) => void; large?: boolean }) {
  return (
    <button type="button" disabled={locked} onClick={() => onChange?.(!checked)}
      className="flex w-full items-center gap-3 py-3 text-left min-h-[52px]" aria-pressed={checked}>
      <span className={cx("flex h-7 w-7 shrink-0 items-center justify-center rounded-md border",
        locked ? "bg-disabled border-line" : checked ? "border-brand bg-surface text-brand-deep" : "border-line bg-surface")}>
        {checked && <Icon name="check" size={24} />}
      </span>
      <span className={cx(large ? "t18" : "t16", locked ? "text-muted" : "text-ink")}>{label}</span>
    </button>
  );
}

/* ── Card & info boxes ── */
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-xl border border-soft bg-surface p-4", className)}>{children}</div>;
}
export function Info({ children, tone = "blue", className }: { children: ReactNode; tone?: "blue" | "wait"; className?: string }) {
  return (
    <div className={cx("t14 rounded-xl px-4 py-4 whitespace-pre-line", tone === "wait" ? "bg-wait text-wait-ink" : "bg-blue-light text-muted", className)}>
      {children}
    </div>
  );
}

/* ── App bars ── */
export function AppBarRoot({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between bg-surface px-5 lg:static lg:h-auto lg:bg-transparent lg:px-0 lg:pb-2 lg:pt-8">
      <h1 className="t20 font-bold lg:text-[24px] lg:leading-8">{title}</h1>
      {right}
    </header>
  );
}
export function AppBarDetail({ title, back, right }: { title: string; back?: string; right?: ReactNode }) {
  const router = useRouter();
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-2 bg-surface px-3 lg:static lg:h-auto lg:bg-transparent lg:px-0 lg:pb-2 lg:pt-8">
      <button type="button" aria-label="뒤로" onClick={() => (back ? router.push(back) : router.back())}
        className="flex h-12 w-12 items-center justify-center text-brand-deep lg:-ml-3">
        <Icon name="back" />
      </button>
      <h1 className="t20 font-bold flex-1 lg:text-[24px] lg:leading-8">{title}</h1>
      {right}
    </header>
  );
}

/* ── Bottom fixed action (mobile) / inline action row (desktop) ── */
export function BottomAction({ children, note, aboveTabs }: { children: ReactNode; note?: ReactNode; aboveTabs?: boolean }) {
  return (
    <>
      <div className="h-36 lg:hidden" aria-hidden />
      <div className={cx("fixed inset-x-0 z-30 lg:static", aboveTabs ? "bottom-[72px]" : "safe-bottom bottom-0")} style={aboveTabs ? { marginBottom: "env(safe-area-inset-bottom)" } : undefined}>
      <div className="border-t border-soft bg-surface px-5 pb-4 pt-3 lg:static lg:mt-6 lg:border-0 lg:bg-transparent lg:p-0">
        <div className="mx-auto flex max-w-[480px] flex-col gap-2 lg:max-w-none lg:flex-row-reverse lg:items-center lg:justify-start lg:gap-3 [&>a]:lg:w-auto [&>a]:lg:min-w-60 [&>button]:lg:w-auto [&>button]:lg:min-w-60">
          {children}
        </div>
        {note && <p className="t14 mx-auto mt-2 max-w-[480px] text-muted lg:max-w-none">{note}</p>}
      </div>
      </div>
    </>
  );
}

/* ── Overlay dialog (D01, D02, P01) ── */
export function Overlay({ open, children, sheet }: { open: boolean; children: ReactNode; sheet?: boolean }) {
  if (!open) return null;
  return (
    <div className={cx("fixed inset-0 z-50 flex bg-overlay/90 p-6", sheet ? "items-end p-0 sm:items-center sm:p-6" : "items-center")} role="dialog" aria-modal>
      <div className={cx("mx-auto w-full max-w-[420px] bg-surface p-5", sheet ? "rounded-t-2xl sm:rounded-2xl" : "rounded-2xl")}>{children}</div>
    </div>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p role="alert" className="t14 rounded-lg bg-error px-3 py-2 text-error-ink">{children}</p>;
}

export function Loading({ label = "불러오는 중이에요" }: { label?: string }) {
  return <div className="t14 py-16 text-center text-muted" aria-busy>{label}…</div>;
}

export function Section({ title, children, aside }: { title?: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      {title && (
        <div className="flex items-center justify-between">
          <h2 className="t20 font-bold">{title}</h2>
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

export function won(n: number) {
  return `${n.toLocaleString("ko-KR")}원`;
}
