import { Badge } from "@/shared/ui/badge";

/** Tình trạng của đợt kiểm kê: đang mở hay đã đóng. */
export function CampaignStateBadge({ closed }: { closed: boolean }) {
  return closed ? <Badge variant="neutral">Đã đóng</Badge> : <Badge variant="info">Đang mở</Badge>;
}
