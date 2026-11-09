import { VOUCHER_FORMS } from "@/domains/voucher/form-configs";
import type { VoucherFormConfig } from "@/domains/voucher/form-types";

/** Cấu hình trường chứng từ của một loại phiếu — khai tĩnh, không đổi khi chạy. */
export function useVoucherForm(resource: string | undefined): VoucherFormConfig | undefined {
  return resource ? VOUCHER_FORMS[resource] : undefined;
}
