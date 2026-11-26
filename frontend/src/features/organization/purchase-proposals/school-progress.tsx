import { useState } from "react";
import { BarChart3, Table2 } from "lucide-react";

import { usePagedRows } from "@/shared/components/data-table/use-paged-rows";
import { StepTitle } from "@/shared/components/voucher/voucher-layout";
import { count, seriesColor, seriesGradient } from "@/shared/lib/chart-palette";
import { LIFT_ROW } from "@/shared/lib/row-lift";
import { cn } from "@/shared/lib/utils";
import { Card } from "@/shared/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import type { ProcurementSummary } from "@/domains/procurement/types";

const money = new Intl.NumberFormat("vi-VN");

type School = ProcurementSummary["schools"][number];

/**
 * Ba chặng của một đề xuất sau khi trình, theo thứ tự luồng — màu gán theo thứ tự cố định của bảng màu biểu đồ
 * (`chart-palette`, đã qua bộ kiểm màu), không theo nghĩa: đây là nhận diện chặng, không phải trạng thái tốt / xấu.
 * "Đã duyệt" ở đây là đã duyệt mà kế hoạch chứa nó CHƯA được duyệt, để ba đoạn cộng đúng bằng tổng đề xuất.
 */
const STAGES = [
  { key: "pending", label: "Chờ duyệt", of: (s: School) => s.pending },
  // Gồm cả đề xuất đang nằm trong kế hoạch Sở còn lập / chờ duyệt — chưa là quyết định mua.
  { key: "approved", label: "Đã duyệt", of: (s: School) => Math.max(0, s.approved - s.planned) },
  { key: "planned", label: "Kế hoạch đã duyệt", of: (s: School) => s.planned },
] as const;

/**
 * "Theo trường" của màn tổng hợp đề xuất: mỗi trường một thanh ngang dài theo số đề xuất (so với trường nhiều nhất),
 * chia ba đoạn theo chặng — nhìn là thấy trường nào xin nhiều, phần nào còn kẹt ở bước duyệt. Rê chuột vào một đoạn
 * thấy số của chặng đó. Có dạng bảng cho ai cần đọc số (và cho trình đọc màn hình).
 */
export function SchoolProgress({ schools, loading, year, empty }: {
  schools: School[];
  loading: boolean;
  year: string;
  empty: React.ReactNode;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const paged = usePagedRows(schools, { resetKey: year, sizeKey: "procurementSummarySchools", pageSizeLabel: "Số trường mỗi trang" });
  const max = Math.max(0, ...schools.map((s) => s.proposals));
  const head = "text-overline text-muted-foreground";

  return (
    <Card className="flex min-h-80 flex-col gap-0 overflow-hidden py-0">
      <div className="flex items-center gap-3 border-b px-4 py-2.5">
        <StepTitle title="Theo trường" aside={loading ? undefined : `${count.format(schools.length)} trường`} />
        <ToggleGroup type="single" size="sm" variant="outline" value={view} className="ms-auto"
          onValueChange={(v) => v && setView(v as "chart" | "table")}>
          <ToggleGroupItem value="chart" aria-label="Xem dạng biểu đồ"><BarChart3 /></ToggleGroupItem>
          <ToggleGroupItem value="table" aria-label="Xem dạng bảng"><Table2 /></ToggleGroupItem>
        </ToggleGroup>
      </div>

      {!schools.length ? empty : view === "chart" ? (
        <div className="flex flex-1 flex-col px-4 py-3">
          {/* Chú giải: ba chặng, ô màu cùng dải với đoạn thanh — tên chặng không chỉ nằm ở màu. */}
          <ul className="text-muted-foreground mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {STAGES.map((st, i) => (
              <li key={st.key} className="flex items-center gap-1.5">
                <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: seriesGradient(seriesColor(i), 135) }} />
                {st.label}
              </li>
            ))}
          </ul>
          <ul className="flex-1 space-y-0.5">
            {paged.visible.map((s) => (
              <li key={s.schoolId} className="hover:bg-muted/40 -mx-2 grid grid-cols-[minmax(0,38%)_minmax(0,1fr)_auto] items-center gap-3 rounded-md px-2 py-1.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{s.schoolName}</p>
                  <p className="text-muted-foreground truncate text-xs tabular-nums">
                    {s.amount > 0 ? `Dự toán ${money.format(s.amount)} đ` : "Chưa có giá"}
                  </p>
                </div>
                {/* Rãnh xám đủ dài; phần tô dài theo số đề xuất so với trường nhiều nhất, khe 2px giữa các đoạn. */}
                <div className="bg-muted relative h-2.5 min-w-0 overflow-hidden rounded-full">
                  <div className="absolute inset-y-0 left-0 flex gap-[2px] transition-[width] duration-700 ease-out"
                    style={{ width: `${max ? (s.proposals / max) * 100 : 0}%` }}>
                    {STAGES.map((st, i) => {
                      const n = st.of(s);
                      if (!n) return null;
                      return (
                        <Tooltip key={st.key}>
                          <TooltipTrigger asChild>
                            <span className="h-full min-w-1 rounded-full" tabIndex={0}
                              style={{ flexGrow: n, flexBasis: 0, background: seriesGradient(seriesColor(i), 90) }} />
                          </TooltipTrigger>
                          <TooltipContent>
                            <span className="font-medium">{s.schoolName}</span>
                            <span className="block">{st.label}: {count.format(n)} đề xuất</span>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
                <span className="w-16 text-right text-sm font-semibold tabular-nums">
                  {count.format(s.proposals)} <span className="text-muted-foreground text-xs font-normal">đề xuất</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <>
          <Table>
            <TableHeader className="bg-surface-subtle">
              <TableRow>
                <TableHead className={cn(head, "ps-4")}>Trường</TableHead>
                {STAGES.map((st) => (
                  <TableHead key={st.key} className={cn(head, "w-20 text-right whitespace-normal")}>{st.label}</TableHead>
                ))}
                <TableHead className={cn(head, "w-32 pe-4 text-right")}>Dự toán</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.visible.map((s) => (
                <TableRow key={s.schoolId} className={cn("group/row", LIFT_ROW)}>
                  <TableCell className="ps-4 font-medium whitespace-normal">{s.schoolName}</TableCell>
                  {STAGES.map((st) => (
                    <TableCell key={st.key} className="text-right tabular-nums">{count.format(st.of(s))}</TableCell>
                  ))}
                  <TableCell className="pe-4 text-right font-medium tabular-nums">{money.format(s.amount)} đ</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex-1" />
        </>
      )}
      {schools.length ? paged.pager : null}
    </Card>
  );
}

