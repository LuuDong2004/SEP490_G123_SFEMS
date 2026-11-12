import { DocumentSheet } from "@/shared/components/print/document-sheet";
import { DISCREPANCY_LABELS, type InventorySession } from "@/domains/inventory/types";

/**
 * Biên bản kiểm kê dạng "Văn bản" (KK-07): tờ A4 như bản in, xem ngay trên màn. Ở dạng xem này, In là in đúng tờ
 * này (DocumentSheet tự có bản in của nó).
 */
export function InventoryDocument({ record }: { record: InventorySession }) {
  return (
    <DocumentSheet
      unit={record.school?.name}
      title="Biên bản kiểm kê tài sản"
      number={record.code}
      date={record.inventoryDate}
      facts={[
        { label: "Tên phiếu", value: record.title, wide: true },
        { label: "Phạm vi", value: record.room?.name ?? "Cả trường" },
        { label: "Đợt kiểm kê", value: record.campaign?.name },
        { label: "Tổ kiểm kê", value: record.council, wide: true },
        { label: "Kết luận", value: record.conclusion, wide: true },
      ]}
      table={{
        headers: ["STT", "Mã tài sản", "Tên tài sản", "Sổ ghi", "Thực tế", "Kết quả"],
        rows: record.lines.map((l, i) => [
          i + 1,
          l.equipment.code,
          l.equipment.name,
          l.expectedRoom?.name ?? "Kho",
          l.found == null ? "Chưa kiểm" : l.found ? (l.foundRoom?.name ?? "Như sổ") : "Không thấy",
          l.discrepancies.map((x) => DISCREPANCY_LABELS[x]).join(", ") || (l.found != null ? "Khớp" : ""),
        ]),
        alignCenter: [0],
        grow: 2,
      }}
      signers={[{ title: "Người kiểm kê" }, { title: "Kế toán" }, { title: "Thủ trưởng đơn vị" }]}
    />
  );
}
