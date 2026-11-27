import { useNotification } from "@refinedev/core";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Download, Loader2 } from "lucide-react";
import { Fragment, useState } from "react";

import { kyInstance, DOWNLOAD_TIMEOUT } from "@/shared/api/data";
import { QueryError } from "@/shared/components/query-error";
import { Segmented } from "@/shared/components/segmented";
import { errorMessage } from "@/shared/lib/api-error";
import { safeDownloadName } from "@/shared/lib/download-filename";
import { LIFT_ROW } from "@/shared/lib/row-lift";
import { STANDARD_STATUS_VARIANTS } from "@/shared/lib/status-variants";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { TableEmpty } from "@/shared/components/data-table/table-empty";
import {
  STANDARD_STATUS_LABELS,
  STANDARD_TIERS,
  type StandardEvaluation,
  type StandardStatus,
} from "@/domains/facility/standard";

const number = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2, useGrouping: false });

function StatusBadge({ status, bold }: { status: StandardStatus; bold?: boolean }) {
  if (status === "NONE") return <span className="text-muted-foreground">{STANDARD_STATUS_LABELS.NONE}</span>;
  return (
    <Badge variant={STANDARD_STATUS_VARIANTS[status]} className={cn("whitespace-nowrap", bold && "font-semibold")}>
      {STANDARD_STATUS_LABELS[status]}
    </Badge>
  );
}

/**
 * Đánh giá mức độ chuẩn CSVC của MỘT trường: ba mức theo TT 13/2020 sửa bởi TT 23/2024, chuẩn do Sở
 * khai ở Danh mục chung → Chuẩn CSVC. Bảng theo khối (dòng khối đậm), mỗi loại một dòng với kết quả ba mức và điều
 * kiện còn thiếu; nút tải bản Excel theo mẫu của Sở. Khung cao theo chỗ chứa nó (`min-h-0 flex-1`), bảng cuộn bên trong.
 */
export function FacilityStandardPanel({ schoolId, className }: { schoolId: number; className?: string }) {
  const { open: notify } = useNotification();
  const [scope, setScope] = useState<"rules" | "all">("rules");
  const [busy, setBusy] = useState(false);
  const query = useQuery({
    queryKey: ["facility-standard", schoolId],
    queryFn: ({ signal }) => kyInstance.get(`facility-standard/schools/${schoolId}`, { signal }).json<StandardEvaluation>(),
  });
  const data = query.data;

  async function download() {
    if (!data) return;
    setBusy(true);
    try {
      const blob = await kyInstance.get(`facility-standard/schools/${schoolId}/export`, { timeout: DOWNLOAD_TIMEOUT }).blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Danh gia muc do chuan - ${safeDownloadName(data.school.name)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      notify?.({ type: "error", message: await errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  if (query.isError) return <QueryError error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} />;

  const groups = (data?.groups ?? [])
    .map((g) => ({ ...g, items: scope === "rules" ? g.items.filter((i) => i.hasRules) : g.items }))
    .filter((g) => g.items.length > 0);
  const unruled = (data?.groups ?? []).reduce((n, g) => n + g.items.filter((i) => !i.hasRules).length, 0);

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        {data ? (
          <>
            {data.tiers.map((t) => (
              <Badge key={t.tier} variant={t.total === 0 ? "neutral" : t.reached ? "success" : "destructive"}
                className="whitespace-nowrap">
                {STANDARD_TIERS.find((x) => x.key === t.tier)?.short}: {t.total === 0 ? "chưa có chuẩn" : `${t.passed}/${t.total} đạt`}
              </Badge>
            ))}
            <Badge variant={data.reached ? "info" : "neutral"} className="whitespace-nowrap">Mức đạt: {data.reachedLabel}</Badge>
            <span className="text-muted-foreground text-xs whitespace-nowrap">
              {data.school.classes != null ? `${data.school.classes} lớp` : "Chưa khai số lớp"} · {data.school.students != null ? `${number.format(data.school.students)} học sinh` : "chưa khai số học sinh"}
            </span>
          </>
        ) : (
          <Skeleton className="h-6 w-72" />
        )}
        <div className="ms-auto flex items-center gap-2">
          <Segmented size="sm" label="Loại hiển thị" value={scope} onChange={setScope}
            options={[
              { value: "rules", label: "Có chuẩn" },
              { value: "all", label: "Tất cả", hint: unruled ? `Thêm ${unruled} loại chưa có chuẩn` : undefined },
            ]} />
          <Button type="button" variant="outline" size="sm" disabled={!data || busy} onClick={() => void download()}>
            {busy ? <Loader2 className="animate-spin" /> : <Download />}
            Tải Excel
          </Button>
        </div>
      </div>
      {data?.warnings.length ? (
        <div className="text-warning-text flex flex-col gap-1 text-xs">
          {data.warnings.map((w) => (
            <span key={w} className="flex items-center gap-1.5"><AlertTriangle className="size-3.5 shrink-0" />{w}</span>
          ))}
        </div>
      ) : null}
      <div className="bg-card shadow-e1 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
        <div className="min-h-0 flex-1 overflow-auto">
          <Table>
            <TableHeader className="bg-surface-subtle sticky top-0 z-10">
              <TableRow>
                <TableHead className="w-14 text-center">STT</TableHead>
                <TableHead>Hạng mục</TableHead>
                <TableHead className="text-right whitespace-nowrap">Hiện có</TableHead>
                {STANDARD_TIERS.map((t) => (
                  <TableHead key={t.key} className="w-24 text-center whitespace-nowrap">{t.short}</TableHead>
                ))}
                <TableHead className="min-w-56">Cảnh báo thiếu</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!data ? (
                Array.from({ length: 6 }, (_, i) => (
                  <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-5" /></TableCell></TableRow>
                ))
              ) : groups.length === 0 ? (
                <TableEmpty colSpan={7} title={data.school.levelCode ? "Chưa có chuẩn CSVC cho cấp học của trường." : "Trường chưa có cấp học."} />
              ) : groups.map((g, gi) => (
                <Fragment key={g.code ?? gi}>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableCell className="text-center font-semibold">{gi + 1}</TableCell>
                    <TableCell colSpan={2} className="font-semibold">{g.name}</TableCell>
                    {STANDARD_TIERS.map((t) => (
                      <TableCell key={t.key} className="text-center"><StatusBadge status={g.status[t.key]} bold /></TableCell>
                    ))}
                    <TableCell />
                  </TableRow>
                  {g.items.map((item, ii) => (
                    <TableRow key={item.roomTypeId} className={cn("group/row", LIFT_ROW)}>
                      <TableCell className="text-muted-foreground text-center tabular-nums">{gi + 1}.{ii + 1}</TableCell>
                      <TableCell className="whitespace-normal">
                        <div className="flex flex-col">
                          <span>{item.name}</span>
                          {item.requirements.length ? (
                            <span className="text-muted-foreground text-xs">{item.requirements.join(" · ")}</span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap tabular-nums">
                        {item.count}
                        {item.count > 0 && Number(item.totalArea) > 0 ? (
                          <span className="text-muted-foreground"> · {number.format(Number(item.totalArea))} m²</span>
                        ) : null}
                      </TableCell>
                      {STANDARD_TIERS.map((t) => (
                        <TableCell key={t.key} className="text-center"><StatusBadge status={item.status[t.key]} /></TableCell>
                      ))}
                      <TableCell className="text-muted-foreground text-xs whitespace-pre-line">
                        {item.shortfalls.length ? item.shortfalls.join("\n") : ""}
                      </TableCell>
                    </TableRow>
                  ))}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
