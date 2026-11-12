import { useQuery } from "@tanstack/react-query";

import { kyInstance } from "@/shared/api/data";
import type { IntakeLine, WrittenUpAsset } from "@/domains/equipment-intake/types";

/** Một tài sản sinh ra từ phiếu ghi tăng — đủ để hiện mã và mở hồ sơ của nó. */
export type IntakeAsset = { id: number; code: string };

/**
 * Tài sản đã ghi tăng của một phiếu, gom theo DÒNG phiếu. Đọc `GET /equipment_intakes/{id}/assets` một lần cho cả
 * phiếu — theo phạm vi của PHIẾU: ai xem được phiếu thì xem được những gì phiếu đã ghi tăng. Máy chủ trả theo số
 * dòng rồi theo mã; mã trong một dòng được cấp liên tiếp lúc duyệt, nên xếp theo mã là xếp theo thứ tự cấp.
 *
 * Chỉ hỏi khi phiếu đã ghi tăng (trước đó chưa có tài sản nào).
 */
export function useIntakeAssets(intakeId: number | undefined, completed: boolean, lines: IntakeLine[] = []) {
  const enabled = completed && intakeId != null;
  const query = useQuery({
    queryKey: ["equipment_intakes", intakeId, "assets"],
    queryFn: () => kyInstance.get(`equipment_intakes/${intakeId}/assets`).json<WrittenUpAsset[]>(),
    enabled,
  });
  const idOfLine = new Map(lines.map((l) => [l.lineNo, l.id]));
  const byLine = new Map<number, IntakeAsset[]>();
  for (const item of query.data ?? []) {
    const lineId = idOfLine.get(item.lineNo);
    if (lineId == null) continue;
    const list = byLine.get(lineId) ?? [];
    list.push({ id: item.id, code: item.code });
    byLine.set(lineId, list);
  }
  return { byLine, loading: enabled && query.isLoading, canRead: !query.isError };
}
