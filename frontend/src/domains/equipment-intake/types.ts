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

/** Một hoá đơn (chứng từ) của phiếu ghi tăng (254). */
export type IntakeDocument = {
  id: number;
  docNo: number;
  supplier: string | null;
  taxCode: string | null;
  /** Liên hệ của nhà cung cấp — số điện thoại hoặc email (256, 257). */
  contact: string | null;
  documentNo: string | null;
  documentDate: string | null;
  fundingSource: string | null;
  fundingNote: string | null;
  acquisitionMethod: { id: number; code?: string | null; name?: string | null } | null;
  acquisitionNote: string | null;
};

export type IntakeLine = {
  /** Hoá đơn của dòng (254). */
  documentId?: number | null;
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
   * Quy cách bao bì (QLTB-501) — ĐÃ BỎ quy đổi: phiếu mới luôn trống, số lượng theo đơn vị của danh mục. Chỉ phiếu cũ
   * còn mang: khi đó số lượng đếm theo bao bì và `stockQuantity` là số đã quy đổi (màn xem phiếu vẫn hiện).
   */
  packUnit: { id: number; code?: string; name: string } | null;
  packSize: number | null;
  stockQuantity: number | null;
  /** Số serial khai lúc nhận hàng (thiết bị từng cái), theo thứ tự cấp cho thiết bị sinh ra lúc duyệt. */
  serialNumbers?: string[];
};

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
  /** Hoá đơn (chứng từ) của phiếu (254). */
  documents?: IntakeDocument[];
  lineCount: number;
  /** Tổng số lượng thực nhận — `null` khi các dòng khác đơn vị tính (2 cái + 200 gam không cộng được). */
  totalReceived: number | null;
  totalAmount: number | null;
  generatedCount: number;
  createdAt: string;
  updatedAt: string | null;
  /** Người lập phiếu — `code` tên đăng nhập, `name` họ tên. */
  createdBy: { id: number; code: string; name: string } | null;
  _can?: Record<string, boolean>;
};

