import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { CircleCheck, ClipboardCheck, Clock, Wallet } from "lucide-react";
import { useSearchParams } from "react-router";

import { kyInstance } from "@/shared/api/data";
import { getAuthorities } from "@/shared/api/session";
import { ListView, ListViewHeader } from "@/shared/components/views/list-view";
import { usePerspective } from "@/shared/hooks/use-perspective";
import { StepTitle } from "@/shared/components/voucher/voucher-layout";
import { cn } from "@/shared/lib/utils";
import { Card } from "@/shared/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import type { ProcurementSummary } from "@/domains/procurement/types";

import { MinimumStandardBody } from "../minimum-standard/page";
import { LIFT_ROW } from "@/shared/lib/row-lift";
import { EmptyState } from "@/shared/components/data-table/table-empty";
import { useSchoolYear } from "@/shared/hooks/use-school-year";
import { SchoolProgress } from "./school-progress";
import { usePagedRows } from "@/shared/components/data-table/use-paged-rows";

const money = new Intl.NumberFormat("vi-VN");

/**
 * Tổng hợp đề xuất mua sắm theo năm ngân sách — phần riêng của phân hệ Mua sắm, chỉ có nghĩa với Sở (một trường thì
 * xem đề xuất của mình ở tab Đề xuất mua sắm). Hệ thống một Sở: không chọn Sở — luôn là Sở của người đăng nhập (quản trị
 * viên: mọi trường).
 *
 * <p>Thẻ đầu: năm ngân sách (mặc định theo năm học đang làm việc ở header: 2026-2027 → 2027) và bốn con số. Bên dưới hai
 * bảng cao bằng nhau, kéo tới cuối trang: thiết bị cần mua (phần chính) và theo trường.
 */
function ProcurementSummaryCard() {
  const { year: working, years } = useSchoolYear();
  const budgetOf = (endDate?: string | null) => (endDate ? Number(endDate.slice(0, 4)) : null);
  const defaultYear = budgetOf(working?.endDate) ?? new Date().getFullYear() + 1;
  const [picked, setPicked] = useState<string | null>(null);
  const year = picked ?? String(defaultYear);
  // Năm ngân sách chọn được: năm kết thúc của các năm học trong danh mục, cộng năm đang xem.
  const yearOptions = [...new Set([...years.map((y) => budgetOf(y.endDate)).filter((y): y is number => y != null), defaultYear])]
    .sort((a, b) => b - a);
  const ownBody = getAuthorities()?.managingBodyId ?? null;
  const { data: p, isLoading } = useQuery({
    queryKey: ["procurement_plans", "summary", year, ownBody],
    queryFn: ({ signal }) => kyInstance.get("procurement_plans/summary", {
      signal, searchParams: ownBody != null ? { year, body: ownBody } : { year },
    }).json<ProcurementSummary>(),
  });
  const sum = (key: "proposals" | "pending" | "approved" | "planned") => (p?.bodies ?? []).reduce((n, b) => n + b[key], 0);
  // Tên trùng (máy chiếu của danh mục THCS và THPT là hai thiết bị) thì kèm mã để phân biệt.
  const dupNames = new Set((p?.catalogs ?? []).map((c) => c.catalogName).filter((n, i, all) => all.indexOf(n) !== i));
  const head = "text-overline text-muted-foreground";
  const catalogs = p?.catalogs ?? [];
  const schools = p?.schools ?? [];
  const pagedCatalogs = usePagedRows(catalogs, { resetKey: year, sizeKey: "procurementSummary", pageSizeLabel: "Số thiết bị mỗi trang" });
  const empty = (
    <EmptyState loading={isLoading} title="Chưa có đề xuất cho năm này."
      description="Đề xuất đã trình của các trường, cùng năm ngân sách, sẽ hiện ở đây." />
  );

  return (
    <div className="flex flex-col gap-4">
      <Card className="gap-0 py-0">
        <div className="flex flex-wrap items-center gap-3 border-b px-5 py-3">
          <span className="text-sm font-medium">Năm ngân sách</span>
          <Select value={year} onValueChange={setPicked}>
            <SelectTrigger className="h-8 w-28 rounded-full" aria-label="Năm ngân sách"><SelectValue /></SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid divide-y sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
          <Figure icon={<Wallet />} label="Tổng dự toán đề xuất" value={p ? `${money.format(p.amount)} đ` : "…"} hint={p ? `${money.format(sum("proposals"))} đề xuất` : undefined} />
          <Figure icon={<CircleCheck />} tone="text-success-text" label="Đã được duyệt" value={p ? `${money.format(p.approvedAmount)} đ` : "…"} hint={p ? `${money.format(sum("approved"))} đề xuất` : undefined} />
          <Figure icon={<Clock />} tone="text-warning-text" label="Đang chờ duyệt" value={p ? money.format(sum("pending")) : "…"} hint="đề xuất" />
          <Figure icon={<ClipboardCheck />} label="Đã vào kế hoạch" value={p ? money.format(sum("planned")) : "…"} hint="đề xuất · kế hoạch đã duyệt" />
        </div>
      </Card>

      {/* Hai bảng cùng cao (lưới kéo giãn), tới gần cuối khung nhìn — trống thì chữ "chưa có" nằm giữa thẻ. */}
      <div className="grid gap-4 xl:min-h-[calc(100dvh-19rem)] xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card className="flex min-h-80 flex-col gap-0 overflow-hidden py-0">
          <div className="border-b px-4 py-3">
            <StepTitle title="Thiết bị cần mua" aside={p ? `${money.format(catalogs.length)} thiết bị` : undefined} />
          </div>
          <Table>
            <TableHeader className="bg-surface-subtle">
              <TableRow>
                <TableHead className={cn(head, "ps-4")}>Thiết bị</TableHead>
                <TableHead className={cn(head, "w-28 text-right")}>Số lượng</TableHead>
                <TableHead className={cn(head, "w-24 text-right")}>Số trường</TableHead>
                <TableHead className={cn(head, "w-36 pe-4 text-right")}>Dự toán</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedCatalogs.visible.map((c) => (
                <TableRow key={c.catalogId} className={cn("group/row", LIFT_ROW)}>
                  <TableCell className="ps-4 whitespace-normal">
                    <span className="font-medium">{c.catalogName}</span>
                    {dupNames.has(c.catalogName) ? <span className="text-muted-foreground ms-2 font-mono text-xs">{c.catalogCode}</span> : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{money.format(c.quantity)} <span className="text-muted-foreground">{c.unitName ?? ""}</span></TableCell>
                  <TableCell className="text-right tabular-nums">{c.schools}</TableCell>
                  <TableCell className="pe-4 text-right font-medium tabular-nums">{money.format(c.amount)} đ</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {catalogs.length ? <div className="flex-1" /> : empty}
          {pagedCatalogs.pager}
        </Card>

        <SchoolProgress schools={schools} loading={isLoading} year={year} empty={empty} />
      </div>
    </div>
  );
}

function Figure({ icon, label, value, hint, tone }: { icon: ReactNode; label: string; value: ReactNode; hint?: string; tone?: string }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <span className={cn("shrink-0 [&_svg]:size-5", tone ?? "text-primary")}>{icon}</span>
      <div className="min-w-0">
        <p className="text-muted-foreground truncate text-xs">{label}</p>
        <p className="text-xl leading-tight font-bold tabular-nums">{value}</p>
        {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
      </div>
    </div>
  );
}

/**
 * Mức đáp ứng định mức và nhu cầu mua sắm (phân hệ Mua sắm): cùng màn Thiết bị dạy học tối thiểu của
 * phân hệ Thiết bị — một trường thấy chuẩn của mình, Sở thấy tổng hợp các trường — và với
 * Sở thêm bảng tổng hợp đề xuất mua sắm theo năm ngân sách ở dưới.
 */
export const EquipmentAdequacy = () => {
  const { perspective } = usePerspective();
  const [params] = useSearchParams();
  return (
    <ListView>
      <ListViewHeader />
      {/* Góc nhìn quản lý đã có "Thiết bị tối thiểu các trường" trong nhóm Thiết bị: ở đây chỉ còn phần
          riêng của mua sắm, không vẽ lại cả màn kia lần nữa. */}
      {perspective === "management" && !params.get("school") ? null : <MinimumStandardBody />}
      {perspective !== "school" && !params.get("school") ? <ProcurementSummaryCard /> : null}
    </ListView>
  );
};
