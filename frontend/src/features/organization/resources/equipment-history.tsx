import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeftRight,
  ClipboardCheck,
  FilePen,
  PackagePlus,
  TriangleAlert,
  Trash2,
  Wrench,
} from "lucide-react";
import type { ReactNode } from "react";

import { kyInstance } from "@/shared/api/data";
import { Timeline, TimelineItem, type TimelineTone } from "@/shared/components/timeline";
import { formatDateTime } from "@/shared/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import {
  ASSET_STATUS_LABELS,
  CONDITION_LABELS,
  HISTORY_ACTION_LABELS,
  HISTORY_FIELD_LABELS,
  type EquipmentHistoryAction,
  type EquipmentHistoryRow,
} from "@/domains/equipment/types";

const ACTION_ICON: Record<EquipmentHistoryAction, ReactNode> = {
  GHI_TANG: <PackagePlus />,
  CAP_NHAT: <FilePen />,
  DIEU_CHUYEN: <ArrowLeftRight />,
  KIEM_KE: <ClipboardCheck />,
  BAO_HONG: <TriangleAlert />,
  SUA_CHUA: <Wrench />,
  THANH_LY: <Trash2 />,
  MAT: <TriangleAlert />,
};

const ACTION_TONE: Record<EquipmentHistoryAction, TimelineTone> = {
  GHI_TANG: "success",
  CAP_NHAT: "neutral",
  DIEU_CHUYEN: "info",
  KIEM_KE: "info",
  BAO_HONG: "warning",
  SUA_CHUA: "warning",
  THANH_LY: "neutral",
  MAT: "destructive",
};

/** Giá trị lưu ở backend là tên hằng; trường status/condition hiện nhãn tiếng Việt. */
function valueOf(field: string | null, value: string | null): string | null {
  if (value == null || value === "") return null;
  if (field === "status") return ASSET_STATUS_LABELS[value as keyof typeof ASSET_STATUS_LABELS] ?? value;
  if (field === "condition") return CONDITION_LABELS[value as keyof typeof CONDITION_LABELS] ?? value;
  return value;
}

/** Một dòng lịch sử thành câu đọc được: "Trạng thái: Đang sử dụng → Hỏng, chờ xử lý". */
function describe(row: EquipmentHistoryRow): string {
  if (!row.field) return row.note ?? "";
  const label = HISTORY_FIELD_LABELS[row.field] ?? row.field;
  const from = valueOf(row.field, row.fromValue);
  const to = valueOf(row.field, row.toValue);
  if (from == null && to == null) return label;
  return `${label}: ${from ?? "trống"} → ${to ?? "trống"}`;
}

/** Lịch sử thiết bị (TS-04), mới nhất trước. Ngoài phạm vi máy chủ trả 404 — màn cha đã báo. */
export function EquipmentHistoryCard({ equipmentId }: { equipmentId: number }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["equipment-history", equipmentId],
    queryFn: () => kyInstance.get(`equipment/${equipmentId}/history`).json<EquipmentHistoryRow[]>(),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lịch sử thay đổi</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Đang tải…</p>
        ) : isError ? (
          <p className="text-destructive text-sm">Không tải được lịch sử.</p>
        ) : !data || data.length === 0 ? (
          <p className="text-muted-foreground text-sm">Chưa có thay đổi nào.</p>
        ) : (
          <Timeline>
            {data.map((row) => (
              <TimelineItem
                key={row.id}
                icon={ACTION_ICON[row.action] ?? <FilePen />}
                tone={ACTION_TONE[row.action] ?? "neutral"}
                title={HISTORY_ACTION_LABELS[row.action] ?? row.action}
                time={formatDateTime(row.createdAt)}
                by={row.actorName ?? undefined}
              >
                <div className="text-sm">{describe(row)}</div>
                {row.voucherCode ? (
                  <div className="text-muted-foreground text-xs">Theo phiếu {row.voucherCode}</div>
                ) : null}
                {row.note ? <div className="text-muted-foreground text-xs">{row.note}</div> : null}
              </TimelineItem>
            ))}
          </Timeline>
        )}
      </CardContent>
    </Card>
  );
}
