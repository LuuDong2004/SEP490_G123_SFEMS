import { Badge } from "@/shared/ui/badge";
import { VOUCHER_STATUS_VARIANTS } from "@/shared/lib/status-variants";
import { voucherStatusText, type ApprovalStep, type VoucherStatus } from "@/domains/voucher/types";

/**
 * Trạng thái phiếu, nói luôn đang chờ AI: "Chờ lãnh đạo trường duyệt" thay vì chỉ "Chờ duyệt". Câu
 * hỏi đầu tiên người ta hỏi về một phiếu đang treo là nó đang nằm ở bàn ai.
 *
 * `short` cho cột của BẢNG: chỉ "Chờ duyệt" — câu đầy đủ bị cắt cụt trong cột hẹp; rê chuột vẫn đọc
 * được đang chờ ai.
 */
export function VoucherStatusBadge({
  status,
  step,
  short,
  returned,
}: {
  status: VoucherStatus;
  step?: ApprovalStep | null;
  short?: boolean;
  /** Phiếu đang nháp vì bị người duyệt TRẢ LẠI (có `returnNote`) — hiện "Bị trả về", màu cảnh báo. */
  returned?: boolean;
}) {
  const full = voucherStatusText(status, step ?? null, returned);
  const text = short ? voucherStatusText(status, null, returned) : full;
  const variant = status === "DRAFT" && returned ? "warning" : (VOUCHER_STATUS_VARIANTS[status] ?? "neutral");
  return (
    <Badge variant={variant} title={text === full ? undefined : full}>
      {text}
    </Badge>
  );
}
