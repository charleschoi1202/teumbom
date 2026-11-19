import { AppShell } from "@/components/shell";
import { VideoSender } from "@/components/VideoSender";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell role="teacher">
      <VideoSender />
      {children}
    </AppShell>
  );
}
