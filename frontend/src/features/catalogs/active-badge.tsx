import { Badge } from "@/shared/ui/badge";
import { ACTIVE_LABELS } from "@/domains/catalog/types";

/** Nhãn trạng thái của một mục danh mục: xanh khi đang dùng, xám khi đã ngừng. */
export function ActiveBadge({ active }: { active: boolean }) {
  return (
    <Badge variant={active ? "success" : "neutral"} dot>
      {active ? ACTIVE_LABELS.true : ACTIVE_LABELS.false}
    </Badge>
  );
}
