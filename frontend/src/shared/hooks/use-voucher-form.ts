import { useQuery } from "@tanstack/react-query";

import { kyInstance } from "@/shared/api/data";
import type { VoucherFormConfig } from "@/domains/voucher/form-types";

/** Cấu hình trường chứng từ của một loại phiếu. Không đổi khi chạy, nên nạp một lần. */
export function useVoucherForm(resource: string | undefined) {
  const { data } = useQuery({
    queryKey: ["voucher_forms", resource],
    enabled: !!resource,
    staleTime: Infinity,
    queryFn: ({ signal }) => kyInstance.get(`voucher_forms/${resource}`, { signal }).json<VoucherFormConfig>(),
  });
  return data && "sections" in data ? data : undefined;
}
