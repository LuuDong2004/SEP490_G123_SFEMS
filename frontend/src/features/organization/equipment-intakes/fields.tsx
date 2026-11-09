
import { todayLocal } from "@/shared/lib/format";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Các ô THÔNG TIN CHUNG của phiếu nhập.
 *
 * <p>Tất cả những gì ghi một lần ở đây sẽ được mọi tài sản sinh ra từ phiếu kế
 * thừa: nguồn vốn, nhà cung cấp, nguồn hình thành, hình thức mua sắm, bảo hành.
 * Đó là lý do chúng nằm trên đầu phiếu chứ không lặp lại ở từng dòng — nhập 50
 * máy tính thì nguồn vốn được gõ một lần, không phải năm mươi.
 */
export const INTAKE_DEFAULT_VALUES = {
  school: { id: null },
  // Getter: tính lúc form mount (khi `defaults` được trải ra), không chốt lúc tải trang.
  get intakeDate() {
    return todayLocal();
  },
  documentNo: "",
  documentDate: null,
  supplier: "",
  fundingSource: null,
  originSource: { id: null },
  originNote: "",
  schoolYear: { id: null },
  acquisitionMethod: { id: null },
  /** Phần ghi rõ của hình thức "Khác" ở đầu phiếu — chỉ trên form, chép xuống các dòng theo phiếu. */
  acquisitionNoteHead: "",
  warrantyMonths: null,
  note: "",
  lines: [] as unknown[],
};

export type IntakeFormValues = typeof INTAKE_DEFAULT_VALUES;
