import { useCan } from "@refinedev/core";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";

import { kyInstance } from "@/shared/api/data";
import { VoucherStatusBadge } from "@/shared/components/voucher/voucher-status";
import { LIFT_ROW } from "@/shared/lib/row-lift";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import {
  COUNT_HEADS,
  sumCounts,
  type CampaignDiscrepancyRow,
  type CampaignProgress,
  type DiscrepancyCounts,
} from "@/domains/inventory/types";
import type { VoucherStatus } from "@/domains/voucher/types";
import { CountCells } from "@/features/organization/inventory-sessions/breakdown";

/** Trường đang ở đâu trong đợt, suy từ phiếu kiểm kê của nó. */
type Stage = "done" | "pending" | "drafting" | "none";
const stageOf = (status?: string | null): Stage =>
  !status ? "none" : status === "APPROVED" || status === "COMPLETED" ? "done" : status === "PENDING" ? "pending" : "drafting";
const STAGES: { key: Stage | "all"; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "done", label: "Đã duyệt" },
  { key: "pending", label: "Chờ duyệt" },
  { key: "drafting", label: "Đang kiểm" },
  { key: "none", label: "Chưa bắt đầu" },
];
/** Trường cần cơ quan xử lý trước đứng trên: chờ duyệt, đang kiểm, đã duyệt, rồi mới tới chưa bắt đầu. */
const STAGE_ORDER: Record<Stage, number> = { pending: 0, drafting: 1, done: 2, none: 3 };

/** Tiến độ của đợt: số trường đã duyệt biên bản trên tổng số trường — cho thẻ đầu màn chi tiết đợt. */
export function useCampaignProgress(id: number | undefined) {
  const { data } = useQuery({
    queryKey: ["inventory_campaigns", id, "progress"],
    enabled: id != null,
    queryFn: () => kyInstance.get(`inventory_campaigns/${id}/progress`).json<CampaignProgress>(),
  });
  return data && typeof data === "object" && "total" in data ? data : undefined;
}

/**
 * Bảng tiến độ của đợt (KK-02): mỗi trường trong phạm vi, phiếu kiểm kê của nó đang ở đâu, và — với biên bản người
 * xem mở được — số chênh lệch. Lọc theo tình trạng và tìm theo tên trường.
 */
export function CampaignProgressTable({ campaignId, progress }: { campaignId: number | undefined; progress: CampaignProgress | undefined }) {
  // Số chênh lệch theo trường — chỉ của biên bản người xem mở được, cần quyền đọc phiếu kiểm kê.
  const canReadSessions = useCan({ resource: "inventory_sessions", action: "list" }).data?.can ?? false;
  const { data: diffData } = useQuery({
    queryKey: ["inventory_campaigns", campaignId, "discrepancies"],
    enabled: campaignId != null && canReadSessions,
    queryFn: () => kyInstance.get(`inventory_campaigns/${campaignId}/discrepancies`).json<CampaignDiscrepancyRow[]>(),
  });
  const diffs = useMemo(() => new Map((Array.isArray(diffData) ? diffData : []).map((d) => [d.schoolId, d])), [diffData]);
  const showDiffs = canReadSessions && diffs.size > 0;
  const diffTotals = useMemo(() => {
    const opened = [...diffs.values()].filter((d) => d.counts);
    return opened.length
      ? { counts: sumCounts(opened.map((d) => d.counts as DiscrepancyCounts)), surplus: opened.reduce((n, d) => n + d.surplus, 0), schools: opened.length }
      : null;
  }, [diffs]);
  const [stage, setStage] = useState<Stage | "all">("all");
  const [term, setTerm] = useState("");
  const all = useMemo(
    () => (progress?.schools ?? []).map((s) => ({ ...s, stage: stageOf(s.status) })).sort((x, y) => STAGE_ORDER[x.stage] - STAGE_ORDER[y.stage]),
    [progress],
  );
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: all.length, done: 0, pending: 0, drafting: 0, none: 0 };
    for (const s of all) c[s.stage]++;
    return c;
  }, [all]);
  const q = term.trim().toLowerCase();
  const rows = all.filter((s) => (stage === "all" || s.stage === stage) && (!q || s.schoolName.toLowerCase().includes(q)));

  return (
    <Card className="gap-0 py-0">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        {STAGES.map((s) => (
          <Button key={s.key} type="button" size="sm" variant={stage === s.key ? "default" : "outline"} className="rounded-full" onClick={() => setStage(s.key)}>
            {s.label}
            <span className="tabular-nums opacity-70">{counts[s.key] ?? 0}</span>
          </Button>
        ))}
        <div className="relative ms-auto w-64 max-w-full">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Tìm trường…" className="pl-8" aria-label="Tìm trường" />
        </div>
      </div>
      <div className="max-h-[35rem] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-4">Trường</TableHead>
              <TableHead className="px-4">Phiếu kiểm kê</TableHead>
              <TableHead className="px-4">Tình trạng</TableHead>
              {showDiffs ? (
                <>
                  {COUNT_HEADS.map((h) => <TableHead key={h} className="text-right">{h}</TableHead>)}
                  <TableHead className="pe-4 text-right">Thừa</TableHead>
                </>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showDiffs ? 10 : 3} className="text-muted-foreground py-10 text-center">
                  {progress ? "Không có trường nào khớp." : "Đang tải…"}
                </TableCell>
              </TableRow>
            ) : rows.map((s) => (
              <TableRow key={s.schoolId} className={cn("group/row", LIFT_ROW)}>
                <TableCell className="px-4">{s.schoolName}</TableCell>
                <TableCell className="px-4 font-mono text-xs">
                  {/* Biên bản còn ở trường (nháp, chờ hiệu trưởng) thì cơ quan chưa mở được — hiện số, không gắn đường dẫn. */}
                  {s.sessionId && s.canOpen ? (
                    <Link className="text-primary hover:underline" to={`/inventory-sessions/show/${s.sessionId}`}>{s.sessionCode ?? "Nháp"}</Link>
                  ) : s.sessionId ? (
                    <span className="text-muted-foreground" title="Biên bản còn ở trường — mở được khi trường duyệt xong.">{s.sessionCode ?? "Nháp"}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="px-4">
                  {s.status ? <VoucherStatusBadge status={s.status as VoucherStatus} /> : <span className="text-muted-foreground">Chưa bắt đầu</span>}
                </TableCell>
                {showDiffs ? (() => {
                  const d = diffs.get(s.schoolId);
                  return d?.counts ? (
                    <>
                      <CountCells row={d.counts} />
                      <TableCell className="pe-4 text-right tabular-nums">{d.surplus || <span className="text-muted-foreground">0</span>}</TableCell>
                    </>
                  ) : (
                    <TableCell colSpan={7} className="text-muted-foreground pe-4 text-right">—</TableCell>
                  );
                })() : null}
              </TableRow>
            ))}
            {showDiffs && diffTotals && rows.length > 0 ? (
              <TableRow className="bg-surface-subtle font-medium">
                <TableCell className="px-4" colSpan={3}>Cộng {diffTotals.schools} biên bản</TableCell>
                <CountCells row={diffTotals.counts} />
                <TableCell className="pe-4 text-right tabular-nums">{diffTotals.surplus}</TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
