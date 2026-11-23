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
};

/**
 * Căn cứ chuẩn tối thiểu của các dòng (bước 7): mỗi dòng đề xuất / kế hoạch truy ngược về trường, điểm trường, chuẩn
 * thông tư, theo điều chỉnh, điều chỉnh + lý do, câu căn cứ; dòng ngoài thông tư gắn nhãn riêng. Không có căn cứ (đề
 * xuất lập tay) thì không vẽ gì.
 */
export function StandardTraceBlock({ proposalId, planId }: { proposalId?: number; planId?: number }) {
  const { data } = useQuery({
    queryKey: ["year_standards", "traces", proposalId ?? null, planId ?? null],
    enabled: proposalId != null || planId != null,
    queryFn: ({ signal }) => kyInstance.get("year_standards/traces", {
      signal, searchParams: proposalId != null ? { proposalId: String(proposalId) } : { planId: String(planId) },
    }).json<Trace[]>(),
  });
  if (!data?.length) return null;
  const many = planId != null;
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">Căn cứ chuẩn tối thiểu · {data[0].schoolYearName}</h3>
      <div className="bg-card shadow-e1 overflow-hidden rounded-lg border">
        <div className="max-h-[24rem] overflow-auto">
          <Table>
            <TableHeader>
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
                  {many ? <TableCell className="max-w-[14rem] truncate" title={t.schoolName}>{t.schoolName}</TableCell> : null}
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
