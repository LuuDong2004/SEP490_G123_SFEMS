import { useQuery } from "@tanstack/react-query";

import { kyInstance } from "@/shared/api/data";
import { SCHOOL_ADJUST_LABELS, type SchoolAdjustKind } from "@/domains/school-year/types";
import { Badge } from "@/shared/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

type Trace = {
  proposalId: number; proposalCode: string | null; schoolName: string; schoolYearName: string; catalogId: number;
  catalogCode: string; catalogName: string; campusName: string | null; normCode: string | null; quantity: number;
  requiredTt: number | null; requiredAdjusted: number | null; current: number | null; adjustKind: string | null;
  adjustReason: string | null; basisText: string | null; outsideStandard: boolean;
  /** Năm học của dòng đã chốt chưa — chưa chốt thì số thiếu còn đổi được (không chặn trình, chỉ gắn nhãn). */
  yearClosed: boolean;
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

const OPEN_YEAR_HINT = "Trường chưa chốt năm học này: lớp, phân công, điều chỉnh còn sửa được nên số thiếu có thể đổi.";

/**
 * Căn cứ chuẩn tối thiểu của các dòng (bước 7): mỗi dòng đề xuất / kế hoạch truy ngược về trường, điểm trường, chuẩn
 * thông tư, theo điều chỉnh, điều chỉnh + lý do, câu căn cứ; dòng ngoài thông tư gắn nhãn riêng; năm học chưa chốt gắn
 * nhãn "Năm học chưa chốt" (không chặn trình). Không có căn cứ (đề xuất lập tay) thì không vẽ gì.
 */
export function StandardTraceBlock({ proposalId, planId }: { proposalId?: number; planId?: number }) {
  const { data } = useStandardTraces({ proposalId, planId });
  if (!data?.length) return null;
  const many = planId != null;
  const open = data.some((t) => !t.yearClosed);
  return (
    <section className="space-y-2">
      <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold">
        Căn cứ chuẩn tối thiểu · {data[0].schoolYearName}
        {open && !many ? <Badge variant="warning" title={OPEN_YEAR_HINT}>Năm học chưa chốt</Badge> : null}
      </h3>
      {open && !many ? <p className="text-muted-foreground text-xs">{OPEN_YEAR_HINT}</p> : null}
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
                      {/* Kế hoạch gom nhiều trường: nhãn theo từng trường — trường nào chưa chốt năm thì số còn đổi được. */}
                      {!t.yearClosed ? <Badge variant="warning" className="mt-0.5" title={OPEN_YEAR_HINT}>Năm học chưa chốt</Badge> : null}
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
    </section>
  );
}
