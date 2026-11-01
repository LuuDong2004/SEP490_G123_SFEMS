import { useQuery } from "@tanstack/react-query";

import { kyInstance } from "@/shared/api/data";
import type { VoucherEvent } from "@/domains/voucher/types";

/** Nhật ký duyệt của một phiếu. Khoá truy vấn được `VoucherActions` làm mới sau mỗi bước. */
export function useVoucherEvents(resource: string, id: number | undefined) {
  return useQuery({
    queryKey: ["voucher_events", resource, id],
    enabled: id != null,
    queryFn: () =>
      kyInstance
        .get("voucher_events", { searchParams: { resource, voucherId: String(id) } })
        .json<VoucherEvent[]>(),
  });
}
