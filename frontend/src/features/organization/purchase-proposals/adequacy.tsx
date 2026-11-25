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
import { TableEmpty } from "@/shared/components/data-table/table-empty";
import { usePagedRows } from "@/shared/components/data-table/use-paged-rows";

const money = new Intl.NumberFormat("vi-VN");
const ALL = "__all__";

/**
 * Tổng hợp đề xuất mua sắm theo năm ngân sách — phần riêng của phân hệ Mua sắm, chỉ có nghĩa với
 * cơ quan quản lý (một trường thì xem đề xuất của mình ở tab Đề xuất mua sắm).
 *
 * <p>Một thẻ đầu: chọn năm ngân sách và bốn con số (cùng khuôn dải chỉ số ở các màn khác). Bên dưới
 * hai bảng có tiêu đề: thiết bị cần mua (phần chính) và theo cơ quan quản lý.
 */
function ProcurementSummaryCard() {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(String(thisYear + 1));
  // Mỗi cơ quan lập kế hoạch mua sắm của RIÊNG mình (Sở cho trường THPT, UBND cho trường trên địa bàn):
  // mặc định xem cơ quan của chính người đăng nhập, chọn được cơ quan khác hoặc "Mọi cơ quan".
  const ownBody = getAuthorities()?.managingBodyId ?? null;
  const [body, setBody] = useState<string>(ownBody != null ? String(ownBody) : ALL);
  const all = useQuery({
    queryKey: ["procurement_plans", "summary", year],
    queryFn: ({ signal }) => kyInstance.get("procurement_plans/summary", { signal,  searchParams: { year } }).json<ProcurementSummary>(),
  });
  const one = useQuery({
    queryKey: ["procurement_plans", "summary", year, body],
    enabled: body !== ALL,
    queryFn: ({ signal }) => kyInstance.get("procurement_plans/summary", { signal,  searchParams: { year, body } }).json<ProcurementSummary>(),
  });
  const bodies = all.data && "bodies" in all.data ? all.data.bodies : [];
  const source = body === ALL ? all.data : one.data;
  const p = source && "bodies" in source ? source : undefined;
  const bodyName = body === ALL ? "mọi cơ quan" : (bodies.find((b) => String(b.bodyId) === body)?.bodyName ?? p?.bodies[0]?.bodyName);
  const sum = (key: "proposals" | "pending" | "approved" | "planned") => (p?.bodies ?? []).reduce((n, b) => n + b[key], 0);
  // Tên trùng (máy chiếu của danh mục THCS và THPT là hai thiết bị) thì kèm mã để phân biệt.
  const dupNames = new Set((p?.catalogs ?? []).map((c) => c.catalogName).filter((n, i, all) => all.indexOf(n) !== i));
  const head = "text-overline text-muted-foreground";
  const paged = usePagedRows(p?.catalogs ?? [], { resetKey: `${year}|${body}`, sizeKey: "procurementSummary", pageSizeLabel: "Số thiết bị mỗi trang" });

  return (
    <div className="space-y-4">
      <Card className="gap-0 py-0">
        <div className="flex flex-wrap items-center gap-3 border-b px-5 py-3">
          <span className="text-sm font-medium">Năm ngân sách</span>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="h-8 w-28" aria-label="Năm ngân sách"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[thisYear - 1, thisYear, thisYear + 1, thisYear + 2].map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm font-medium">Cơ quan</span>
          <Select value={body} onValueChange={setBody}>
            <SelectTrigger className="h-8 w-80 max-w-full" aria-label="Cơ quan quản lý"><SelectValue placeholder="Vui lòng chọn cơ quan" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Mọi cơ quan</SelectItem>
              {/* Cơ quan của người xem luôn có trong danh sách, kể cả khi năm này nó chưa có đề xuất nào. */}
              {ownBody != null && !bodies.some((b) => b.bodyId === ownBody) ? (
                <SelectItem value={String(ownBody)}>Cơ quan của tôi</SelectItem>
              ) : null}
              {bodies.map((b) => (
                <SelectItem key={b.bodyId ?? "none"} value={String(b.bodyId)}>{b.bodyName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid divide-y sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
          <Figure icon={<Wallet />} label="Tổng dự toán đề xuất" value={p ? `${money.format(p.amount)} đ` : "…"} hint={p ? `${money.format(sum("proposals"))} đề xuất` : undefined} />
          <Figure icon={<CircleCheck />} tone="text-success-text" label="Đã được duyệt" value={p ? `${money.format(p.approvedAmount)} đ` : "…"} hint={p ? `${money.format(sum("approved"))} đề xuất` : undefined} />
          <Figure icon={<Clock />} tone="text-warning-text" label="Đang chờ duyệt" value={p ? money.format(sum("pending")) : "…"} hint="đề xuất" />
          <Figure icon={<ClipboardCheck />} label="Đã vào kế hoạch" value={p ? money.format(sum("planned")) : "…"} hint="đề xuất" />
        </div>
      </Card>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card className="gap-0 overflow-hidden py-0">
          <div className="border-b px-4 py-3">
            <StepTitle title="Thiết bị cần mua" aside={p ? `${money.format(p.catalogs.length)} thiết bị · ${bodyName ?? ""}` : undefined} />
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
              {!p || p.catalogs.length === 0 ? (
                <TableEmpty colSpan={4} loading={!p} title="Chưa có đề xuất cho năm này." />
              ) : paged.visible.map((c) => (
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
          {paged.pager}
        </Card>

        <Card className="gap-0 overflow-hidden py-0">
          <div className="border-b px-4 py-3">
            <StepTitle title="Theo cơ quan quản lý" />
          </div>
          <Table>
            <TableHeader className="bg-surface-subtle">
              <TableRow>
                <TableHead className={cn(head, "ps-4")}>Cơ quan</TableHead>
                <TableHead className={cn(head, "w-20 text-right")} title="Chờ duyệt / đã duyệt / vào kế hoạch">Đề xuất</TableHead>
                <TableHead className={cn(head, "w-36 pe-4 text-right")}>Dự toán</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bodies.length === 0 ? (
                <TableEmpty colSpan={3} loading={!all.data} title="Chưa có đề xuất cho năm này." />
              ) : bodies.map((b) => (
                <TableRow key={b.bodyId ?? 0} className={cn("group/row", LIFT_ROW, "cursor-pointer", String(b.bodyId) === body && "bg-primary/10 hover:bg-primary/10")}
                  onClick={() => setBody(String(b.bodyId))} title="Xem đề xuất của cơ quan này">
                  <TableCell className="ps-4 whitespace-normal">
                    <span className="block font-medium">{b.bodyName}</span>
                    <span className="text-muted-foreground text-xs">
                      {b.schools} trường · {b.pending} chờ duyệt · {b.approved} đã duyệt · {b.planned} vào kế hoạch
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{b.proposals}</TableCell>
                  <TableCell className="pe-4 text-right font-medium tabular-nums">{money.format(b.amount)} đ</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
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
 * phân hệ Thiết bị — một trường thấy chuẩn của mình, cơ quan quản lý thấy tổng hợp địa bàn — và với
 * cơ quan quản lý thêm bảng tổng hợp đề xuất mua sắm theo năm ngân sách ở dưới.
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
