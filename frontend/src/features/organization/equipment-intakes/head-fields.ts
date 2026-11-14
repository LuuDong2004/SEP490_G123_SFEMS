import { dateRules, textRules } from "@/shared/lib/field-rules";
import { PURCHASE_CODE } from "./readiness";


export type HeadFields = {
  supplier?: string;
  documentNo?: { label: string; invoice: boolean };
  documentDate?: string;
};

/**
 * Ô chứng từ ở đầu phiếu theo NGUỒN HÌNH THÀNH — chọn nguồn xong chỉ hiện ô của nguồn đó: mua sắm có nhà cung cấp và
 * hoá đơn (bắt buộc khi trình); được cấp phát, bàn giao có quyết định giao; tặng, tài trợ có đơn vị tặng; khác có đơn vị giao và số
 * chứng từ; kiểm kê thừa, tự làm không có chứng từ mua bán.
 */
export function headFieldsOf(code: string | undefined): HeadFields {
  switch (code) {
    case PURCHASE_CODE:
    case "MUA_NGOAI_KH":
      return { supplier: "Nhà cung cấp", documentNo: { label: "Số hoá đơn", invoice: true }, documentDate: "Ngày hoá đơn" };
    case "PHAN_BO":
      return { documentNo: { label: "Số quyết định giao", invoice: false }, documentDate: "Ngày quyết định" };
    case "TANG_TAI_TRO":
      return { supplier: "Đơn vị tặng, tài trợ", documentNo: { label: "Số biên bản tặng", invoice: false }, documentDate: "Ngày biên bản" };
    case "KHAC":
      return { supplier: "Đơn vị giao", documentNo: { label: "Số chứng từ", invoice: false }, documentDate: "Ngày chứng từ" };
    default:
      return {};
  }
}

/** Luật của ô "Số hoá đơn" / số chứng từ — cùng `checkDocuments` ở máy chủ. */
export const documentNoRules = (head: HeadFields) =>
  head.documentNo?.invoice ? textRules("INVOICE_NO", "Số hoá đơn") : textRules("SHORT_TEXT", head.documentNo?.label ?? "Số chứng từ", { max: 100 });

/** Ngày chứng từ không sau hôm nay (ngày ghi tăng là ngày duyệt — luôn sau đó). */
export const documentDateRules = (label: string) => dateRules("PAST_OR_TODAY", label);

export type DocMeta = { title: string; files: string };

/**
 * Tên khối chứng từ và tên ô tệp theo NGUỒN HÌNH THÀNH — khối "Thông tin phiếu" đổi tên theo nguồn đã chọn, để
 * người lập thấy ngay phiếu này cần giấy tờ gì.
 */
export function docMetaOf(code: string | undefined): DocMeta {
  switch (code) {
    case PURCHASE_CODE:
    case "MUA_NGOAI_KH":
      return { title: "Hoá đơn mua hàng", files: "Hoá đơn, hợp đồng" };
    case "PHAN_BO":
      return { title: "Quyết định giao", files: "Quyết định, biên bản bàn giao" };
    case "TANG_TAI_TRO":
      return { title: "Biên bản tặng, tài trợ", files: "Biên bản tiếp nhận" };
    case "KIEM_KE_THUA":
      return { title: "Biên bản kiểm kê", files: "Biên bản kiểm kê" };
    case "TU_LAM":
      return { title: "Đồ dùng tự làm", files: "Biên bản nghiệm thu" };
    case "KHAC":
      return { title: "Chứng từ", files: "Giấy tờ kèm theo" };
    default:
      return { title: "Chứng từ", files: "Hoá đơn, biên bản" };
  }
}
