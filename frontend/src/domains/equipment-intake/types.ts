/**
 * Phiếu nhập thiết bị (ghi tăng tài sản): kiểu dữ liệu và nhãn.
 *
 * <p>Mã các giá trị cố định giữ nguyên tên hằng của backend; chỉ nhãn là tiếng
 * Việt. Không có React, không có Refine ở đây — đây là mô tả dữ liệu.
 */

import type { VoucherBase } from "@/domains/voucher/types";

/*
 * Trạng thái phiếu nhập là trạng thái chung của mọi phiếu (`domains/voucher`):
 * nháp → chờ lãnh đạo trường duyệt → hoàn tất (= đã ghi tăng).
 */

/**
 * Cách quản lý của mặt hàng, quyết định một dòng phiếu sẽ sinh ra cái gì.
 * Giá trị đi trên đường truyền là chữ thường ({@code JsonValue} ở backend).
 */
export type TrackingType = "serial" | "bulk";

/** Một dòng phiếu sẽ sinh ra gì khi xác nhận — câu để hiện trên màn hình. */
export function intakeLineOutcome(trackingType: string | undefined, quantity: number, unitName?: string): string {
  if (quantity <= 0) return "Không ghi tăng (không nhận được cái nào)";
  return trackingType === "bulk"
    ? `Ghi tăng 1 lô vật tư, số lượng ${quantity.toLocaleString("vi-VN")}${unitName ? ` ${unitName}` : ""}, chung một mã`
    : `Ghi tăng ${quantity} thiết bị, mỗi cái một mã`;
}

export type IntakeLine = {
  id: number | null;
  lineNo: number;
  catalog: { id: number; code: string; name: string } | null;
  name: string;
  trackingType: TrackingType;
  unit: { id: number; code: string; name: string } | null;
  physicalOrDigital: string;
  assetCategory: string | null;
  documentQuantity: number;
  receivedQuantity: number;
  varianceReason: string | null;
  unitPrice: number | null;
  amount: number | null;
  room: { id: number; code: string; name: string } | null;
  generatedCount: number;
  /** Khai riêng của dòng — null = theo đầu phiếu. */
  supplier: string | null;
  documentNo: string | null;
  documentDate: string | null;
  fundingSource: string | null;
  /** Ghi rõ khi nguồn kinh phí là "Nguồn hợp pháp khác". */
  fundingNote: string | null;
  /** Ghi rõ khi hình thức mua sắm là "Khác". */
  acquisitionNote?: string | null;
  acquisitionMethod: { id: number; name: string } | null;
  warrantyMonths: number | null;
  /** Model và hãng của LÔ hàng này — khác nhau giữa các lần mua, khai ở dòng. */
  model: string | null;
  manufacturer: string | null;
  /** Cấu hình, công suất, xuất xứ… — chữ tự do. */
  otherInfo?: string | null;
  /** Hạn sử dụng của lô vật tư tiêu hao, hoá chất (QLTB-391); dòng thiết bị từng cái luôn null. */
  expiryDate: string | null;
  /**
   * Quy cách bao bì của vật tư, hoá chất (QLTB-501): 1 `packUnit` = `packSize` đơn vị của thiết bị. Có quy cách thì
   * số lượng của dòng đếm theo bao bì, đơn giá là giá một bao bì, và lô vào sổ mang `stockQuantity` đã quy đổi.
   */
  packUnit: { id: number; code?: string; name: string } | null;
  packSize: number | null;
  stockQuantity: number | null;
  /** Số serial khai lúc nhận hàng (thiết bị từng cái), theo thứ tự cấp cho thiết bị sinh ra lúc duyệt. */
  serialNumbers?: string[];
};

/** Số lượng vào sổ của một dòng: số nhận × quy cách (QLTB-501), hoặc số nhận khi không quy đổi. */
export function stockQuantityOf(received: number, packSize: number | null | undefined): number {
  return packSize ? Math.round(received * Number(packSize) * 1000) / 1000 : received;
}

/** Phiếu nghiệp vụ đã sinh ra phiếu ghi tăng (đề xuất mua sắm, biên bản kiểm kê). */
export type IntakeSource = { resource: string; id: number | null; code: string | null };

export type EquipmentIntake = VoucherBase & {
  intakeDate: string;
  documentNo: string | null;
  documentDate: string | null;
  supplier: string | null;
  fundingSource: string | null;
  /** Nguồn hình thành của CẢ PHIẾU — quyết định nguồn kinh phí nào chọn được ở từng dòng. */
  originSource: { id: number; code?: string; name: string } | null;
  originNote: string | null;
  /** Năm học của lần ghi tăng (QLTB-390). */
  schoolYear: { id: number; code?: string; name: string } | null;
  /** null = phiếu lập tay. */
  source: IntakeSource | null;
  acquisitionMethod: { id: number; name: string } | null;
  warrantyMonths: number | null;
  /** Lúc lãnh đạo trường duyệt — cũng là lúc ghi tăng. */
  confirmedAt: string | null;
  lines: IntakeLine[];
  lineCount: number;
  totalReceived: number;
  totalAmount: number | null;
  generatedCount: number;
  createdAt: string;
  updatedAt: string | null;
  /** Người lập phiếu — `code` tên đăng nhập, `name` họ tên. */
  createdBy: { id: number; code: string; name: string } | null;
  _can?: Record<string, boolean>;
};

