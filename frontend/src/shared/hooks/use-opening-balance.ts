import { useQuery } from "@tanstack/react-query";

import { kyInstance } from "@/shared/api/data";
import { currentPortal } from "@/shared/api/portal";

/** Số dư đầu kỳ của trường: `closedAt` trống là chưa chốt. */
export type OpeningBalanceState = {
  closedAt: string | null;
  closedBy: string | null;
  equipmentCount: number | null;
  equipmentNow: number;
};

export const OPENING_BALANCE_KEY = ["equipment", "opening-balance"];

/**
 * Trạng thái số dư đầu kỳ của trường đang đăng nhập — chỉ cổng trường có (Sở xem nhiều trường, không có một số dư).
 * Trước khi chốt: khai tay / nhập từ tệp được. Sau khi chốt: thiết bị mới chỉ vào sổ qua phiếu ghi tăng có duyệt.
 */
export function useOpeningBalance() {
  const school = currentPortal() === "school";
  return useQuery({
    queryKey: OPENING_BALANCE_KEY,
    enabled: school,
    staleTime: 60_000,
    retry: false,
    queryFn: () => kyInstance.get("equipment/opening-balance").json<OpeningBalanceState>(),
  });
}
