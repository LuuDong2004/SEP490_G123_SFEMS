import { formatPlainDate } from "@/shared/lib/format";
import { Badge } from "@/shared/ui/badge";

/** Còn bao nhiêu ngày thì tính là sắp hết hạn — cùng số với `EquipmentSummaryService.EXPIRY_WARNING_DAYS`. */
export const EXPIRY_WARNING_DAYS = 30;

/** Số ngày từ hôm nay tới hạn sử dụng (âm = đã quá hạn); `null` khi không có hạn. */
// eslint-disable-next-line react-refresh/only-export-components -- hàm thuần đi cùng nhãn hạn sử dụng
export function daysToExpiry(date: string | null | undefined): number | null {
  if (!date) return null;
  const today = new Date();
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const [y, m, d] = date.slice(0, 10).split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - start) / 86_400_000);
}

/** Nhãn cảnh báo hạn sử dụng (QLTB-391): đã hết hạn, hoặc còn dưới 30 ngày; còn xa thì không có nhãn. */
export function ExpiryBadge({ date }: { date: string | null | undefined }) {
  const days = daysToExpiry(date);
  if (days == null || days > EXPIRY_WARNING_DAYS) return null;
  return days < 0 ? (
    <Badge variant="destructive">Hết hạn sử dụng</Badge>
  ) : (
    <Badge variant="warning">{days === 0 ? "Hết hạn hôm nay" : `Còn ${days} ngày`}</Badge>
  );
}

/** Ngày hết hạn kèm nhãn cảnh báo — dùng ở hồ sơ thiết bị. */
export function ExpiryValue({ date }: { date: string | null | undefined }) {
  if (!date) return <>—</>;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {formatPlainDate(date)}
      <ExpiryBadge date={date} />
    </span>
  );
}
