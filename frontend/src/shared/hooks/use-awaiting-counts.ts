import { createContext, useContext } from "react";
import { useCan, useList, type CrudFilter } from "@refinedev/core";

/** Làm mới số việc chờ trên menu mỗi phút — duyệt / trình ở màn khác thì danh sách tự làm mới ngay (cùng khoá truy vấn). */
const REFRESH_MS = 60_000;

/** Số bản ghi đang chờ người đang đăng nhập xử lý của MỘT loại; 0 khi không có quyền duyệt loại đó. */
function useWaiting(resource: string, filter: CrudFilter): number {
  const { data: can } = useCan({ resource, action: "approve" });
  const { result } = useList({
    resource,
    filters: [filter],
    pagination: { currentPage: 1, pageSize: 1 },
    queryOptions: { enabled: !!can?.can, refetchInterval: REFRESH_MS },
  });
  return can?.can ? (result?.total ?? 0) : 0;
}

const AWAITING_ME: CrudFilter = { field: "awaiting", operator: "eq", value: "me" };

/**
 * Việc đang chờ TÔI duyệt, theo loại: phiếu (đề xuất mua sắm, ghi tăng, kiểm kê) dùng bộ lọc "Chờ tôi duyệt" của máy
 * chủ — đúng trường, đúng cấp đang chờ; kế hoạch mua sắm (không phải phiếu của trường) là kế hoạch đang chờ duyệt mà
 * tài khoản có quyền duyệt kế hoạch thấy được. Menu bên trái cộng dồn lên mục chứa loại đó.
 */
export function useAwaitingCounts(): Record<string, number> {
  return {
    purchase_proposals: useWaiting("purchase_proposals", AWAITING_ME),
    equipment_intakes: useWaiting("equipment_intakes", AWAITING_ME),
    inventory_sessions: useWaiting("inventory_sessions", AWAITING_ME),
    procurement_plans: useWaiting("procurement_plans", { field: "status", operator: "eq", value: "PENDING" }),
    // Đợt kiểm kê chuyên viên Sở trình (308): Lãnh đạo Sở thấy số đợt đang chờ mình duyệt.
    inventory_campaigns: useWaiting("inventory_campaigns", { field: "status", operator: "eq", value: "PENDING" }),
  };
}

export const AwaitingCountsContext = createContext<Record<string, number>>({});

export const useAwaitingCountsContext = () => useContext(AwaitingCountsContext);
