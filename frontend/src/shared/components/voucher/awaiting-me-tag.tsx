/**
 * Nhãn nhỏ "Chờ tôi duyệt" cạnh số phiếu ở danh sách phiếu — phiếu đang chờ ĐÚNG người đang xem duyệt (server trả
 * `approve` trong `_actions`: có quyền và thuộc cấp đang chờ). Nhìn danh sách là thấy việc của mình, không phải bật bộ lọc.
 */
export function AwaitingMeTag({ voucher }: { voucher: { _actions?: string[] } }) {
  if (!voucher._actions?.includes("approve")) return null;
  return (
    <span className="bg-foreground/75 text-background shrink-0 rounded px-1.5 py-px text-[0.6875rem] leading-4 font-medium whitespace-nowrap">
      Chờ tôi duyệt
    </span>
  );
}
