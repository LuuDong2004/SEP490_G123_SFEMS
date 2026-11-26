import { useQuery } from "@tanstack/react-query";

import { kyInstance } from "@/shared/api/data";
import type { VoucherApprovers, VoucherEvent } from "@/domains/voucher/types";

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

/**
 * Người duyệt của phiếu lúc này. Khoá nằm dưới `["voucher_events", resource, id]` nên làm mới cùng nhật ký duyệt sau mỗi
 * bước trình / duyệt; `status` trong khoá để đổi trạng thái (tải lại phiếu) là đọc lại.
 */
export function useVoucherApprovers(resource: string, id: number | undefined, status?: string) {
  return useQuery({
    queryKey: ["voucher_events", resource, id, "approvers", status],
    enabled: id != null,
    queryFn: () =>
      kyInstance
        .get("voucher_events/approvers", { searchParams: { resource, voucherId: String(id) } })
        .json<VoucherApprovers>(),
  });
}
