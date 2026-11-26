import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { kyInstance } from "@/shared/api/data";
import { SCHOOL_ADJUST_LABELS, type SchoolAdjustKind } from "@/domains/school-year/types";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

type Trace = {
  proposalId: number; proposalCode: string | null; schoolName: string; schoolYearName: string; catalogId: number;
  catalogCode: string; catalogName: string; campusName: string | null; normCode: string | null; quantity: number;
  requiredTt: number | null; requiredAdjusted: number | null; current: number | null; adjustKind: string | null;
  adjustReason: string | null; basisText: string | null; outsideStandard: boolean;
  /** Trường đã xác nhận khai năm học của dòng chưa — chưa thì số thiếu còn đổi (không chặn trình, chỉ gắn nhãn). */
  yearConfirmed: boolean;
};

/** Căn cứ chuẩn tối thiểu của một đề xuất / mọi đề xuất trong một kế hoạch — một truy vấn, dùng chung cho khối và hộp trình. */
export function useStandardTraces({ proposalId, planId }: { proposalId?: number; planId?: number }) {
  return useQuery({
    queryKey: ["year_standards", "traces", proposalId ?? null, planId ?? null],
    enabled: proposalId != null || planId != null,
    queryFn: ({ signal }) => kyInstance.get("year_standards/traces", {
      signal, searchParams: proposalId != null ? { proposalId: String(proposalId) } : { planId: String(planId) },
    }).json<Trace[]>(),
  });
}

const OPEN_YEAR_HINT = "Trường chưa xác nhận đã khai năm học này: lớp, sĩ số, phân công còn đang khai nên số thiếu có thể đổi.";

/**
 * Căn cứ chuẩn tối thiểu của các dòng (bước 7): mỗi dòng đề xuất / kế hoạch truy ngược về trường, điểm trường, chuẩn
 * thông tư, theo điều chỉnh, điều chỉnh + lý do, câu căn cứ; dòng ngoài thông tư gắn nhãn riêng; trường chưa xác nhận
 * khai năm học gắn nhãn "Chưa xác nhận năm học" (không chặn trình). Khối mở ra ở trạng thái đóng, bấm mũi tên mới hiện (trưởng nhóm 24/11/2026). Không có căn cứ (đề xuất lập tay) thì không vẽ gì.
 */
export function StandardTraceBlock({ proposalId, planId }: { proposalId?: number; planId?: number }) {
  const { data } = useStandardTraces({ proposalId, planId });
  const [expanded, setExpanded] = useState(false);
  if (!data?.length) return null;
  const many = planId != null;
  const open = data.some((t) => !t.yearConfirmed);
  return (
    <section className="space-y-2">
      <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold">
        <button type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}
          title={expanded ? "Thu gọn khối này" : "Mở khối này"}
          className="hover:bg-muted -ms-1.5 flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 text-start">
          <ChevronDown className={cn("text-muted-foreground size-4 shrink-0 transition-transform", !expanded && "-rotate-90")} />
          Căn cứ chuẩn tối thiểu · {data[0].schoolYearName}
        </button>
        {expanded ? null : <span className="text-muted-foreground font-normal">{data.length} dòng thiết bị</span>}
        {open && !many ? <Badge variant="warning" title={OPEN_YEAR_HINT}>Chưa xác nhận năm học</Badge> : null}
      </h3>
      {expanded && open && !many ? <p className="text-muted-foreground text-xs">{OPEN_YEAR_HINT}</p> : null}
      {expanded ? (
        <div className="bg-card shadow-e1 overflow-hidden rounded-lg border">
          <div className="max-h-[24rem] overflow-auto [&>[data-slot=table-container]]:overflow-visible">
            <Table>
              <TableHeader className="bg-surface-subtle sticky top-0 z-10">
                <TableRow>
                  {many ? <TableHead>Trường</TableHead> : null}
                  <TableHead>Thiết bị</TableHead>
                  <TableHead>Điểm trường</TableHead>
                  <TableHead className="text-right">Chuẩn TT</TableHead>
                  <TableHead className="text-right">Theo điều chỉnh</TableHead>
                  <TableHead className="text-right">Đang có</TableHead>
                  <TableHead className="text-right">Đề xuất</TableHead>
                  <TableHead>Điều chỉnh, căn cứ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((t, i) => (
                  <TableRow key={`${t.proposalId}-${t.catalogId}-${t.campusName}-${i}`}>
                    {many ? (
                      <TableCell className="max-w-[14rem]">
                        <div className="truncate" title={t.schoolName}>{t.schoolName}</div>
                        {/* Kế hoạch gom nhiều trường: nhãn theo từng trường — trường nào chưa xác nhận năm thì số còn đổi được. */}
                        {!t.yearConfirmed ? <Badge variant="warning" className="mt-0.5" title={OPEN_YEAR_HINT}>Chưa xác nhận năm học</Badge> : null}
                      </TableCell>
                    ) : null}
                    <TableCell className="max-w-[18rem]">
                      <div className="truncate font-medium" title={t.catalogName}>{t.catalogName}</div>
                      <div className="text-muted-foreground font-mono text-xs">{t.catalogCode}</div>
                    </TableCell>
                    <TableCell>{t.campusName ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{t.requiredTt ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{t.requiredAdjusted ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{t.current ?? "—"}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{t.quantity}</TableCell>
                    <TableCell className="max-w-[22rem]">
                      {t.outsideStandard ? <Badge variant="warning">Ngoài thông tư</Badge>
                        : t.adjustKind ? <Badge variant="info">{SCHOOL_ADJUST_LABELS[t.adjustKind as SchoolAdjustKind] ?? t.adjustKind}</Badge> : null}
                      {t.adjustReason ? <div className="truncate text-xs" title={t.adjustReason}>{t.adjustReason}</div> : null}
                      {t.basisText ? <div className="text-muted-foreground truncate text-xs italic" title={t.basisText}>{t.basisText}</div> : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
