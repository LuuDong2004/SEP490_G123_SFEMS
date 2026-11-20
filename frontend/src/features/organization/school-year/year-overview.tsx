import { useQuery } from "@tanstack/react-query";
import { CircleDot, Gauge, GraduationCap, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { kyInstance } from "@/shared/api/data";
import { IconFilter } from "@/shared/components/data-table/icon-filter";
import { TableEmpty, TableSkeletonRows } from "@/shared/components/data-table/table-empty";
import { LIFT_ROW } from "@/shared/lib/row-lift";
import { PROFILE_STATUS_VARIANTS } from "@/shared/lib/status-variants";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Input } from "@/shared/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { PROFILE_STATUS_LABELS, type YearOverviewRow } from "@/domains/school-year/types";

import { YearFilter, useYearParam } from "./year-filter";

const num = new Intl.NumberFormat("vi-VN");
const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/gi, "d").toLowerCase();
/** Từ bao nhiêu điểm phần trăm giữa hai tỷ lệ thì gọi là chênh lệch lớn. */
const BIG_GAP = 30;

type Pick = "adjusted" | "outside" | "gap" | "noData";

/**
 * Chuẩn tối thiểu theo năm học của các trường (Sở): tỷ lệ đáp ứng theo thông tư và theo điều chỉnh, số dòng điều
 * chỉnh, số dòng ngoài thông tư; lọc trường có điều chỉnh, có dòng ngoài thông tư, chênh lệch lớn. Bấm một trường mở chuẩn
 * của trường đó.
 */
export function YearOverview({ onOpenSchool }: { onOpenSchool: (id: number) => void }) {
  const { id: yearId, setId, years, current } = useYearParam();
  const [q, setQ] = useState("");
  const [pick, setPick] = useState<Pick | null>(null);
  const [level, setLevel] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["year_standards", "overview", yearId],
    enabled: yearId != null,
    queryFn: ({ signal }) => kyInstance.get("year_standards/overview", { signal, timeout: 120_000, searchParams: { yearId: String(yearId) } })
      .json<YearOverviewRow[]>(),
  });
  const rows = useMemo(() => data ?? [], [data]);
  const levels = useMemo(() => [...new Set(rows.map((r) => r.levelName).filter(Boolean) as string[])], [rows]);
  const big = (r: YearOverviewRow) => r.percentAdjusted - r.percentTt >= BIG_GAP;
  const term = fold(q.trim());
  const shown = rows
    .filter((r) => !level || r.levelName === level)
    .filter((r) => !pick || (pick === "adjusted" ? r.adjusted > 0 : pick === "outside" ? r.outside > 0 : pick === "gap" ? big(r) : !r.hasEquipment))
    .filter((r) => !term || fold(r.schoolName).includes(term))
    // Trường đã có thiết bị trước, chênh lệch lớn trước.
    .sort((a, b) => Number(b.hasEquipment) - Number(a.hasEquipment) || (b.percentAdjusted - b.percentTt) - (a.percentAdjusted - a.percentTt));
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <YearFilter value={yearId} onChange={setId} years={years} current={current} />
        <div className="relative w-full min-w-0 sm:w-72">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm trường…" className="ps-9" />
        </div>
        <IconFilter icon={<CircleDot />} label="lọc trường" allLabel="Mọi trường" total={rows.length} value={pick}
          onChange={(v) => setPick(v as Pick | null)}
          groups={[{ items: [
            { key: "adjusted", label: "Có điều chỉnh", count: rows.filter((r) => r.adjusted > 0).length },
            { key: "outside", label: "Có dòng ngoài thông tư", count: rows.filter((r) => r.outside > 0).length },
            { key: "gap", label: `Chênh lệch từ ${BIG_GAP} điểm`, count: rows.filter(big).length },
            { key: "noData", label: "Chưa nhập thiết bị", count: rows.filter((r) => !r.hasEquipment).length },
          ] }]} />
        {levels.length > 1 ? (
          <IconFilter icon={<GraduationCap />} label="cấp học" allLabel="Mọi cấp học" value={level} onChange={setLevel}
            groups={[{ items: levels.map((l) => ({ key: l, label: l })) }]} />
        ) : null}
      </div>
      <div className="bg-card shadow-e1 min-h-0 flex-1 overflow-hidden rounded-lg border">
        <div className="h-full overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[12rem]">Trường</TableHead>
                <TableHead className="w-32">Hồ sơ năm học</TableHead>
                <TableHead className="text-right">Đáp ứng theo TT</TableHead>
                <TableHead className="text-right">Theo điều chỉnh</TableHead>
                <TableHead className="text-right">Điều chỉnh</TableHead>
                <TableHead className="text-right">Ngoài TT</TableHead>
                <TableHead className="text-right">Còn thiếu</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableSkeletonRows cols={7} /> : shown.length === 0 ? (
                <TableEmpty colSpan={7} icon={<Gauge />} filtered={rows.length > 0}
                  title={rows.length ? "Không có trường khớp bộ lọc" : "Chưa có trường nào"} />
              ) : shown.map((r) => (
                <TableRow key={r.schoolId} className={cn("group/row cursor-pointer", LIFT_ROW)} onClick={() => onOpenSchool(r.schoolId)}>
                  <TableCell className="max-w-[24rem]">
                    <div className="truncate font-medium" title={r.schoolName}>{r.schoolName}</div>
                    <div className="text-muted-foreground truncate text-xs">{r.levelName}</div>
                  </TableCell>
                  <TableCell><Badge variant={PROFILE_STATUS_VARIANTS[r.status]}>{PROFILE_STATUS_LABELS[r.status]}</Badge></TableCell>
                  {r.hasEquipment ? (
                    <>
                      <TableCell className="text-right tabular-nums">{r.percentTt}%</TableCell>
                      <TableCell className={cn("text-right tabular-nums", big(r) && "text-warning-text font-semibold")}>{r.percentAdjusted}%</TableCell>
                      <TableCell className="text-right tabular-nums">{r.adjusted || ""}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.outside || ""}</TableCell>
                      <TableCell className="text-right tabular-nums">{num.format(r.shortageAdjusted)}</TableCell>
                    </>
                  ) : (
                    <TableCell colSpan={5} className="text-muted-foreground text-right">Chưa nhập thiết bị</TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
