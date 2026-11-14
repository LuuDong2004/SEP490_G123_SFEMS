import { useCan } from "@refinedev/core";
import { useQuery } from "@tanstack/react-query";

import { kyInstance } from "@/shared/api/data";
import type { AfterRepairWarranty } from "@/domains/voucher-ops/types";

/**
 * Bảo hành sau sửa chữa của các tài sản, theo id tài sản. Ngày đó nằm trên phiếu sửa chữa (trường chứng từ của
 * bước ghi kết quả), không trên hồ sơ tài sản — nên ai không đọc được phiếu sửa chữa thì không hỏi, và nhận về
 * một bảng rỗng thay vì một lỗi 403.
 */
export function useAfterRepairWarranties(equipmentIds: number[]): Map<number, AfterRepairWarranty> {
  const canRead = useCan({ resource: "repair_orders", action: "list" }).data?.can ?? false;
  const ids = [...new Set(equipmentIds.filter((id) => Number.isFinite(id)))].sort((a, b) => a - b);
  const { data } = useQuery({
    queryKey: ["repair_orders", "warranties", ids],
    enabled: canRead && ids.length > 0,
    queryFn: () =>
      kyInstance.get("repair_orders/warranties", { searchParams: { equipmentIds: ids.join(",") } })
        .json<AfterRepairWarranty[]>(),
  });
  return new Map((data ?? []).map((w) => [w.equipmentId, w]));
}
