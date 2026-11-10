import type { VoucherFormConfig } from "@/domains/voucher/form-types";

/**
 * Cấu hình các trường chứng từ của từng loại phiếu, khai tĩnh ở đây (máy chủ không có `GET /voucher_forms`).
 * Khoá trong `details` của phiếu khớp với khoá máy chủ đọc/ghi — phiếu ghi tăng ánh xạ chúng sang các cột của
 * Biên bản giao nhận (người giao, đại diện bên giao, người nhận, chức vụ, kết quả kiểm tra, số biên bản).
 */
export const VOUCHER_FORMS: Record<string, VoucherFormConfig> = {
  equipment_intakes: {
    resource: "equipment_intakes",
    sections: [
      {
        title: "Biên bản giao nhận",
        fields: [
          { key: "deliveredBy", label: "Người giao", kind: "text", max: 255, required: true },
          { key: "deliveryRepresentative", label: "Đại diện bên giao", kind: "text", max: 255 },
          { key: "receiverName", label: "Người nhận", kind: "text", max: 255, suggest: "staff" },
          { key: "receiverPosition", label: "Chức vụ", kind: "text", max: 255 },
          { key: "inspectionResult", label: "Kết quả kiểm tra", kind: "enum", enum: "InspectionResult" },
          { key: "handoverMinutesNo", label: "Số biên bản bàn giao", kind: "text", max: 100 },
        ],
      },
    ],
    line: [],
    lineTables: {},
    enums: {
      InspectionResult: [
        { value: "PASSED", label: "Đạt" },
        { value: "PARTIAL", label: "Đạt một phần" },
        { value: "FAILED", label: "Không đạt" },
      ],
    },
  },
};
