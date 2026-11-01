import { useQuery } from "@tanstack/react-query";

import { kyInstance } from "@/shared/api/data";
import type { ApprovalStep } from "@/domains/voucher/types";

/**
 * Các cấp duyệt đang áp dụng cho một loại phiếu (`GET /api/approval_flows/{resource}/steps`). Rỗng =
 * phiếu bấm là xong, không ai duyệt — form lập phiếu dùng để đặt tên nút "Trình" / "Duyệt". Cấu hình
 * hiếm đổi, nên nạp một lần.
 */
export function useApprovalSteps(resource: string | undefined) {
  const { data } = useQuery({
    queryKey: ["approval_steps", resource],
    enabled: !!resource,
    staleTime: Infinity,
    queryFn: () => kyInstance.get(`approval_flows/${resource}/steps`).json<{ steps: ApprovalStep[] }>(),
  });
  return data?.steps;
}
