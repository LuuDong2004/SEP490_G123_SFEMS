import { FileText, LayoutList } from "lucide-react";

import { Segmented } from "@/shared/components/segmented";
import type { VoucherView } from "@/shared/hooks/use-voucher-view";

const VIEWS = [
  { value: "work" as const, label: "Làm việc", icon: <LayoutList />, hint: "Bảng, thẻ và nút thao tác của phiếu" },
  { value: "document" as const, label: "Văn bản", icon: <FileText />, hint: "Xem phiếu như bản in A4" },
];

/**
 * Nút chuyển hai dạng xem của một phiếu: "Làm việc" (bảng, thẻ, nút) và "Văn bản" (tờ A4 như bản in,
 * `DocumentSheet`). Dùng chung cho mọi màn chi tiết phiếu — trạng thái lấy từ `useVoucherView`.
 */
export function VoucherViewSwitch({ view, onChange }: { view: VoucherView; onChange: (view: VoucherView) => void }) {
  return <Segmented label="Dạng xem" size="sm" options={VIEWS} value={view} onChange={onChange} />;
}
