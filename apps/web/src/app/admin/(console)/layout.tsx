import Link from "next/link";
import { AppShell } from "@/components/shell";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell role="admin">
      <nav className="flex gap-2 border-b border-soft bg-surface px-5 py-3 lg:hidden" aria-label="운영 메뉴">
        <Link href="/admin/reviews" className="t14 rounded-[10px] border border-brand px-3 py-2 font-bold text-brand">선생님 확인 심사</Link>
        <Link href="/admin/alerts" className="t14 rounded-[10px] border border-brand px-3 py-2 font-bold text-brand">운영 경보</Link>
        <Link href="/" className="t14 ml-auto px-1 py-2 font-bold text-brand">시연 시작으로</Link>
      </nav>
      {children}
    </AppShell>
  );
}
