import { AppShell } from "@/components/shell";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AppShell role="guardian">{children}</AppShell>;
}
