import type { Teacher } from "@/lib/types";
import { Icon } from "./Icon";

/** 신원·범죄경력 확인은 모두에게 필수, 자격은 있는 경우에만 붙는 선택 배지 */
export function TeacherBadges({ t }: { t: Teacher }) {
  return (
    <div className="t14 flex flex-wrap items-center gap-x-3 gap-y-1 text-brand">
      <span className="flex items-center gap-2"><span className="text-brand-deep"><Icon name="shield" size={20} /></span>{t.safety_label}</span>
      {t.qual_label && <span className="rounded-md bg-blue-light px-2 py-0.5 text-brand">{t.qual_label}</span>}
    </div>
  );
}
