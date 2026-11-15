import { useCan } from "@refinedev/core";
import { Printer } from "lucide-react";

import { DocumentSheet } from "@/shared/components/print/document-sheet";
import { moneyInWords } from "@/shared/lib/format";
import { Button } from "@/shared/ui/button";
import { DropdownMenuItem } from "@/shared/ui/dropdown-menu";
import { FUNDING_LABELS } from "@/domains/equipment/types";
import { PRIORITY_LABELS, PURCHASE_LINE_KIND_LABELS, type PurchaseProposal } from "@/domains/procurement/types";

const money = new Intl.NumberFormat("vi-VN");

/**
 * Tờ trình đề xuất mua sắm thiết bị (SRS mục III.4.3 "Purchase Proposal Details"): trường trình Sở xin mua những
 * thiết bị còn thiếu, có chỗ ký của người lập và thủ trưởng đơn vị.
 *
 * <p>Sở chưa ban hành mẫu tờ trình riêng cho đề xuất mua sắm, nên tờ này dựng theo SRS: thể thức văn bản hành chính
 * của `DocumentSheet` (quốc hiệu, tên trường, số phiếu, ngày đề xuất), nơi gửi, căn cứ (sự cần thiết), bảng thiết
 * bị kèm số đang có và số phải có theo định mức (chụp lúc lưu đề xuất, NC-02 bước 5), tổng dự toán bằng số và bằng
 * chữ, rồi hai chỗ ký. Khi Sở có mẫu chính thức thì chỉ sửa trong file này.
 */
export function ProposalDocument({ record }: { record: PurchaseProposal }) {
  const lines = record.lines ?? [];
  const priced = lines.some((l) => l.unitPrice != null);
  return (
    <DocumentSheet
      unit={record.school?.name}
      title="Tờ trình đề xuất mua sắm thiết bị"
      number={record.code}
      date={record.proposalDate}
      facts={[
        { label: "Kính gửi", value: "Sở Giáo dục và Đào tạo", wide: true },
        { label: "Năm ngân sách", value: record.budgetYear },
        { label: "Nguồn kinh phí dự kiến", value: record.fundingSource ? FUNDING_LABELS[record.fundingSource] : null },
        { label: "Sự cần thiết", value: record.reason, wide: true },
        { label: "Ghi chú", value: record.note, wide: true },
      ]}
      table={{
        headers: ["STT", "Tên thiết bị", "ĐVT", "Hình thức", "Hiện có / định mức", "Số lượng", "Đơn giá", "Thành tiền", "Ưu tiên"],
        rows: lines.map((l, i) => [
          i + 1,
          l.specification ? `${l.name} (${l.specification})` : l.name,
          l.unitName ?? "",
          PURCHASE_LINE_KIND_LABELS[l.kind],
          `${l.currentQuantity ?? "—"} / ${l.requiredQuantity ?? "—"}`,
          l.quantity,
          l.unitPrice != null ? money.format(l.unitPrice) : "",
          l.amount != null ? money.format(l.amount) : "",
          PRIORITY_LABELS[l.priority] ?? "",
        ]),
        footer: ["", "Tổng cộng (đồng)", "", "", "", record.totalQuantity, "", priced ? money.format(record.totalAmount) : "", ""],
        alignCenter: [0, 2, 4, 8],
        alignRight: [5, 6, 7],
        grow: 1,
      }}
      signers={[{ title: "Người lập" }, { title: "Thủ trưởng đơn vị", hint: "(Ký, ghi rõ họ tên, đóng dấu)" }]}
    >
      <div className="mt-4 space-y-1.5">
        {priced ? (
          <p>
            Tổng dự toán: <span className="font-bold">{money.format(record.totalAmount)} đồng</span>
            <span className="italic"> (Bằng chữ: {moneyInWords(record.totalAmount)})</span>.
          </p>
        ) : null}
        <p>
          {record.school?.name ?? "Nhà trường"} kính trình Sở Giáo dục và Đào tạo xem xét, phê duyệt để đưa các thiết
          bị trên vào kế hoạch mua sắm năm {record.budgetYear ?? "……"}.
        </p>
      </div>
    </DocumentSheet>
  );
}

/**
 * Mục "Xuất tờ trình" trong menu ⚙ — cho tài khoản có quyền xuất đề xuất (`purchase_proposals:export`). Bản in là
 * tờ ở dạng Văn bản, nên chuyển sang dạng đó rồi mới mở hộp in; chờ menu đóng hẳn, in ngay thì menu còn trên giấy.
 * "Lưu thành PDF" của hộp in là đường xuất ra tệp.
 */
export function ExportProposalMenuItem({ onExport }: { onExport: () => void }) {
  const { data } = useCan({ resource: "purchase_proposals", action: "export" });
  if (!data?.can) return null;
  return (
    <DropdownMenuItem onSelect={onExport}>
      <Printer />
      Xuất tờ trình
    </DropdownMenuItem>
  );
}

/** Nút "Xuất tờ trình" ở dạng Văn bản: tờ đang hiện chính là bản in, nên mở hộp in ngay. */
export function ExportProposalButton() {
  const { data } = useCan({ resource: "purchase_proposals", action: "export" });
  if (!data?.can) return null;
  return (
    <Button type="button" variant="outline" onClick={() => window.print()}>
      <Printer />
      Xuất tờ trình
    </Button>
  );
}
