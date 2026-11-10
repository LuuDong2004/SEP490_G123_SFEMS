import { useCan } from "@refinedev/core";
import { Printer } from "lucide-react";

import { PrintSheet } from "@/shared/components/print/print-sheet";
import { formatPlainDate } from "@/shared/lib/format";
import { DropdownMenuItem } from "@/shared/ui/dropdown-menu";
import { DISCREPANCY_LABELS, type InventorySession } from "@/domains/inventory/types";

/**
 * Bản in biên bản kiểm kê (KK-07): quốc hiệu, tên trường, thông tin phiếu, bảng tài sản (sổ ghi, thực tế, chênh
 * lệch) và khối chữ ký. Chỉ hiện khi in; "Lưu thành PDF" của hộp thoại in là cách xuất ra tệp.
 */
export function InventoryPrint({ record }: { record: InventorySession }) {
  return (
    <PrintSheet
      unit={record.school?.name}
      title="Biên bản kiểm kê tài sản"
      subtitle={record.code ? `Số: ${record.code}` : "Phiếu nháp, chưa cấp số"}
      facts={[
        { label: "Tên đợt", value: record.title },
        { label: "Ngày kiểm kê", value: formatPlainDate(record.inventoryDate) },
        { label: "Phạm vi", value: record.room?.name ?? "Cả trường" },
        ...(record.council ? [{ label: "Tổ kiểm kê", value: record.council }] : []),
        ...(record.conclusion ? [{ label: "Kết luận", value: record.conclusion }] : []),
      ]}
      table={{
        headers: ["STT", "Mã tài sản", "Tên tài sản", "Sổ ghi", "Thực tế", "Chênh lệch", "Ghi chú"],
        rows: record.lines.map((l) => [
          l.lineNo,
          l.equipment.code,
          l.equipment.name,
          l.expectedRoom?.name ?? "Kho",
          l.found == null ? "Chưa kiểm" : l.found ? (l.foundRoom?.name ?? "Đúng như sổ") : "Không thấy",
          l.discrepancies.map((x) => DISCREPANCY_LABELS[x]).join(", ") || (l.found != null ? "Khớp" : ""),
          l.note ?? "",
        ]),
      }}
      signers={["Người kiểm kê", "Kế toán", "Thủ trưởng đơn vị"]}
    />
  );
}

/**
 * Mục "In biên bản" trong menu ⚙ — cho người có quyền xuất biên bản. Chờ menu đóng hẳn rồi mới mở hộp in, in ngay
 * thì menu còn nằm trên trang in.
 */
export function PrintMenuItem() {
  const { data } = useCan({ resource: "inventory_sessions", action: "export" });
  if (!data?.can) return null;
  return (
    <DropdownMenuItem onSelect={() => setTimeout(() => window.print(), 200)}>
      <Printer />
      In biên bản
    </DropdownMenuItem>
  );
}
