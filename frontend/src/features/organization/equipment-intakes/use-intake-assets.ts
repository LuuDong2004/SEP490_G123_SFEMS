import { useCan, useList } from "@refinedev/core";

/** Một tài sản sinh ra từ phiếu ghi tăng — đủ để hiện mã và mở hồ sơ của nó. */
export type IntakeAsset = { id: number; code: string; serialNumber?: string | null; room?: string | null; status?: string | null };

/**
 * Tài sản đã ghi tăng của một phiếu, gom theo DÒNG phiếu (`intakeDocument.lineId` trên mỗi tài sản). Đọc qua
 * cùng bộ lọc `intake.id` mà nút "Xem tài sản" dùng, một lần cho cả phiếu, xếp theo mã — mã trong một dòng
 * được cấp liên tiếp lúc duyệt, nên xếp theo mã là xếp theo thứ tự cấp.
 *
 * Chỉ hỏi khi phiếu đã ghi tăng (trước đó chưa có tài sản nào) và người xem đọc được thiết bị.
 */
export function useIntakeAssets(intakeId: number | undefined, completed: boolean) {
  const canRead = useCan({ resource: "equipment", action: "list" }).data?.can ?? false;
  const { result, query } = useList<{ id: number; code: string; serialNumber?: string | null; room?: { name?: string } | null; status?: string | null; intakeDocument?: { lineId?: number | null } | null }>({
    resource: "equipment",
    filters: [{ field: "intake.id", operator: "eq", value: intakeId }],
    sorters: [{ field: "code", order: "asc" }],
    // Một phiếu ghi tăng hiếm khi quá vài trăm tài sản; 1.000 là trần của máy chủ cho một trang.
    pagination: { currentPage: 1, pageSize: 1000 },
    queryOptions: { enabled: completed && canRead && intakeId != null },
  });
  const byLine = new Map<number, IntakeAsset[]>();
  for (const item of result?.data ?? []) {
    const lineId = item.intakeDocument?.lineId;
    if (lineId == null) continue;
    const list = byLine.get(lineId) ?? [];
    list.push({ id: item.id, code: item.code, serialNumber: item.serialNumber ?? null, room: item.room?.name ?? null, status: item.status ?? null });
    byLine.set(lineId, list);
  }
  return { byLine, loading: completed && canRead && query.isLoading, canRead };
}
