import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { kyInstance } from "@/shared/api/data";
import { Segmented } from "@/shared/components/segmented";
import { StepTitle } from "@/shared/components/voucher/voucher-layout";
import { LIFT_ROW } from "@/shared/lib/row-lift";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent } from "@/shared/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { COUNT_HEADS, sumCounts, type DiscrepancyCounts, type InventorySession, type SessionBreakdown } from "@/domains/inventory/types";

type By = "rooms" | "subjects";

/** Ô đầu và ô cuối của dòng thẳng mép với chữ trong thẻ. */
const EDGE = "[&>*:first-child]:ps-4 [&>*:last-child]:pe-4";

/** Ô số: 0 thì mờ, khác 0 thì đậm theo màu của loại chênh lệch. */
function Num({ value, tone }: { value: number; tone?: "success" | "destructive" | "warning" }) {
  const tones = { success: "text-success-text", destructive: "text-destructive-text", warning: "text-warning-text" };
  return (
    <span className={cn("tabular-nums", value === 0 ? "text-muted-foreground" : tone && cn("font-semibold", tones[tone]))}>
      {value}
    </span>
  );
}

/** Hàng số của một nhóm. */
export function CountCells({ row }: { row: DiscrepancyCounts }) {
  return (
    <>
      <TableCell className="text-right"><Num value={row.total} /></TableCell>
      <TableCell className="text-right"><Num value={row.checked} /></TableCell>
      <TableCell className="text-right"><Num value={row.matched} tone="success" /></TableCell>
      <TableCell className="text-right"><Num value={row.missing} tone="destructive" /></TableCell>
      <TableCell className="text-right"><Num value={row.wrongRoom} tone="warning" /></TableCell>
      <TableCell className="text-right"><Num value={row.damaged} tone="warning" /></TableCell>
    </>
  );
}

/**
 * Chênh lệch của biên bản theo phòng (kho là phòng loại kho) và theo môn học của thiết bị — đếm theo phòng
 * ghi trên sổ, đọc `GET /inventory_sessions/{id}/breakdown`. Tải lại mỗi lần phiếu được lưu.
 */
export function InventoryBreakdown({ record }: { record: InventorySession }) {
  const { data } = useQuery({
    // Ghi kết quả kiểm đếm không chắc đổi updatedAt của phiếu — khoá theo cả bản tóm tắt.
    queryKey: ["inventory_breakdown", record.id, record.updatedAt, JSON.stringify(record.summary)],
    queryFn: () => kyInstance.get(`inventory_sessions/${record.id}/breakdown`).json<SessionBreakdown>(),
  });
  const multiRoom = (data?.rooms.length ?? 0) > 1;
  const [choice, setChoice] = useState<By | null>(null);
  const by: By = choice ?? (multiRoom ? "rooms" : "subjects");
  if (!data || record.lines.length === 0) return null;
  const rows = data[by];
  const totals = sumCounts(rows);

  return (
    <Card className="gap-0 py-0">
      <CardContent className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <StepTitle title="Tổng hợp chênh lệch" />
        <Segmented<By> label="Nhóm theo" size="sm" variant="card" value={by} onChange={setChoice}
          options={[
            { value: "rooms", label: "Theo phòng, kho" },
            { value: "subjects", label: "Theo môn học" },
          ]} />
      </CardContent>
      {/* Cột số hẹp, đứng sát nhau để dò ngang một dòng dễ; tiêu đề dính khi bảng dài. */}
      <div className="max-h-[24rem] overflow-auto border-t [&>[data-slot=table-container]]:overflow-visible">
        <Table>
          <TableHeader sticky>
            <TableRow className={EDGE}>
              <TableHead>{by === "rooms" ? "Phòng, kho (theo sổ)" : "Môn học"}</TableHead>
              {COUNT_HEADS.map((h) => (
                <TableHead key={h} className="w-24 text-right">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={`${r.id ?? "none"}`} className={cn("group/row", LIFT_ROW, EDGE)}>
                <TableCell className="max-w-64">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate">{r.name}</span>
                    {by === "rooms" && r.storeroom ? <Badge variant="neutral">Kho</Badge> : null}
                  </span>
                </TableCell>
                <CountCells row={r} />
              </TableRow>
            ))}
            {rows.length > 1 ? (
              <TableRow className={cn("bg-surface-subtle hover:bg-surface-subtle font-medium", EDGE)}>
                <TableCell>Cộng</TableCell>
                <CountCells row={totals} />
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
