import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Banknote, CheckCircle2, FileCheck2, PackageCheck, RefreshCw, ShoppingCart } from "lucide-react";
import { useState, type ReactNode } from "react";

import type { PurchaseReport } from "@/domains/report/types";
import { ChartCard, GroupedBars } from "@/shared/components/charts/charts";
import { kyInstance } from "@/shared/api/data";
import { usePerspective } from "@/shared/hooks/use-perspective";
import { ReportFilterToolbar } from "./report-filter-toolbar";
import { ReportPrintSheet } from "./report-print-sheet";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

const ALL = "all";
const count = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });
const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const compactMoney = new Intl.NumberFormat("vi-VN", { notation: "compact", maximumFractionDigits: 1 });
const fold = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/đ/g, "d");

export function PurchaseReportPage() {
  const { perspective } = usePerspective();
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [school, setSchool] = useState(ALL);
  const [equipment, setEquipment] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [search, setSearch] = useState("");
  const query = useQuery({
    queryKey: ["reports", "purchase", year, school, equipment, status],
    queryFn: () => kyInstance.get("reports/purchase", { searchParams: {
      year,
      ...(school !== ALL ? { schoolId: school } : {}),
      ...(equipment !== ALL ? { equipmentId: equipment } : {}),
      ...(status !== ALL ? { status } : {}),
    } }).json<PurchaseReport>(),
    placeholderData: keepPreviousData,
  });
  const report = query.data;
  const searchTerm = fold(search.trim());
  const visibleRows = (report?.rows ?? []).filter((row) => !searchTerm || fold(row.name).includes(searchTerm));
  const amountChart = (report?.rows ?? []).slice(0, 12).map((row) => ({
    name: row.name,
    requested: Number(row.amount) / 1_000_000,
    approved: Number(row.approvedAmount) / 1_000_000,
  }));
  const selectedYearLabel = report?.filters.years.find((option) => option.key === year)?.label ?? year;
  const visibleTotals = visibleRows.reduce((totals, row) => ({
    schools: totals.schools + row.schools,
    proposals: totals.proposals + row.proposals,
    pending: totals.pending + row.pending,
    approved: totals.approved + row.approved,
    planned: totals.planned + row.planned,
    quantity: totals.quantity + row.quantity,
    receivedQuantity: totals.receivedQuantity + row.receivedQuantity,
    amount: totals.amount + row.amount,
    approvedAmount: totals.approvedAmount + row.approvedAmount,
  }), { schools: 0, proposals: 0, pending: 0, approved: 0, planned: 0, quantity: 0, receivedQuantity: 0, amount: 0, approvedAmount: 0 });
  const exportData = {
    filename: "bao-cao-nhu-cau-va-ke-hoach-mua-sam",
    title: "Nhu cầu và kế hoạch mua sắm",
    subtitle: `Năm ngân sách ${selectedYearLabel} · ${visibleRows.length} đơn vị`,
    columns: [
      { label: "Trường / cơ quan quản lý", type: "text" as const }, { label: "Số trường", type: "number" as const },
      { label: "Số đề xuất", type: "number" as const }, { label: "Chờ duyệt", type: "number" as const },
      { label: "Đã duyệt", type: "number" as const }, { label: "Đã vào kế hoạch", type: "number" as const },
      { label: "Số lượng đề xuất", type: "number" as const }, { label: "Số đã nhập về", type: "number" as const },
      { label: "Dự toán (đ)", type: "money" as const }, { label: "Dự toán đã duyệt (đ)", type: "money" as const },
    ],
    rows: visibleRows.map((row) => [row.name, row.schools, row.proposals, row.pending, row.approved, row.planned,
      row.quantity, row.receivedQuantity, row.amount, row.approvedAmount]),
  };

  return <main className="space-y-4 p-4 md:p-6">
    {report && <ReportPrintSheet title={exportData.title} scope={report.scope === "SCHOOL" ? "Trường của bạn" : report.scope === "BODY" ? "Các trường thuộc đơn vị" : "Toàn thành phố"} subtitle={exportData.subtitle} columns={exportData.columns} rows={exportData.rows} />}
    <div className="space-y-4 print:hidden">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-muted-foreground text-sm">{report?.scope === "SCHOOL" ? "Trường của bạn" : report?.scope === "BODY" ? "Các trường thuộc đơn vị" : "Toàn thành phố"}</p>
        <h1 className="text-2xl font-semibold tracking-tight">Nhu cầu và kế hoạch mua sắm</h1>
        <p className="text-muted-foreground mt-1 text-sm">Tổng hợp đề xuất, dự toán và tình hình đưa vào kế hoạch theo năm ngân sách.</p>
      </div>
      <Button variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching}><RefreshCw className="mr-2 size-4" />Làm mới</Button>
    </header>

      <ReportFilterToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Tìm trường hoặc cơ quan quản lý"
      exportData={exportData}
      onReset={() => { setYear(String(new Date().getFullYear())); setSchool(ALL); setEquipment(ALL); setStatus(ALL); setSearch(""); }}
      filters={<>
          <Select value={year} onValueChange={setYear}><SelectTrigger aria-label="Năm ngân sách" className="h-9 w-24 rounded-full px-3 text-xs"><SelectValue placeholder={selectedYearLabel} /></SelectTrigger><SelectContent>{(report?.filters.years ?? [{ key: year, label: year }]).map((option) => <SelectItem key={option.key} value={option.key}>{option.label}</SelectItem>)}</SelectContent></Select>
          {perspective !== "school" && <OptionFilter label="Mọi trường" value={school} onChange={setSchool} options={report?.filters.schools ?? []} className="w-36" />}
          <OptionFilter label="Mọi thiết bị" value={equipment} onChange={setEquipment} options={report?.filters.equipment ?? []} className="w-36" />
          <OptionFilter label="Mọi trạng thái" value={status} onChange={setStatus} options={report?.filters.statuses ?? []} className="w-32" />
      </>} />

    {query.isError && !report && <Card className="border-destructive/40"><CardContent className="py-5 text-sm text-destructive-text">Không tải được báo cáo nhu cầu mua sắm. Hãy tải lại trang hoặc kiểm tra quyền truy cập.</CardContent></Card>}
    {query.isError && report && <p className="text-sm text-destructive-text" role="status">Không cập nhật được bộ lọc mới. Đang giữ kết quả trước đó.</p>}
    {query.isFetching && report && <p className="text-muted-foreground text-xs" role="status">Đang cập nhật số liệu theo bộ lọc…</p>}
    {report && <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi icon={<ShoppingCart />} label="Đề xuất" value={count.format(report.summary.proposals)} detail={`${count.format(report.summary.pending)} chờ duyệt`} />
        <Kpi icon={<CheckCircle2 />} label="Đã duyệt" value={count.format(report.summary.approved)} detail={`${count.format(report.summary.planned)} đã vào kế hoạch`} tone="text-success-text" />
        <Kpi icon={<Banknote />} label="Dự toán đề xuất" value={`${compactMoney.format(report.summary.amount)} đ`} />
        <Kpi icon={<FileCheck2 />} label="Dự toán đã duyệt" value={`${compactMoney.format(report.summary.approvedAmount)} đ`} tone="text-success-text" />
        <Kpi icon={<PackageCheck />} label="Số đã nhập về" value={count.format(report.summary.receivedQuantity)} detail={`trên ${count.format(report.summary.quantity)} thiết bị đề xuất`} tone="text-success-text" />
      </section>

      <section className="grid overflow-hidden rounded-xl border lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <ChartCard bare title="Dự toán được duyệt" description="Trên tổng dự toán đề xuất">
          <div className="flex min-h-64 flex-col items-center justify-center gap-4 px-4">
            <div className="relative grid size-44 place-items-center rounded-full" style={{ background: `conic-gradient(var(--chart-2) ${Math.min(100, report.summary.amount ? report.summary.approvedAmount / report.summary.amount * 100 : 0)}%, var(--muted) 0)` }}>
              <div className="grid size-32 place-items-center rounded-full bg-card text-center"><span className="text-3xl font-bold">{report.summary.amount ? Math.round(report.summary.approvedAmount / report.summary.amount * 100) : 0}%</span></div>
            </div>
            <p className="text-center text-sm font-semibold">{money.format(report.summary.approvedAmount)} / {money.format(report.summary.amount)}</p>
            <p className="text-muted-foreground text-center text-xs">{count.format(report.summary.approved)} / {count.format(report.summary.proposals)} đề xuất đã duyệt · {selectedYearLabel}</p>
          </div>
        </ChartCard>
        <ChartCard bare title="Dự toán theo cơ quan quản lý" description="Triệu đồng · nhóm có dự toán lớn nhất">
          {amountChart.length ? <GroupedBars data={amountChart} xKey="name" series={[{ key: "requested", label: "Đề xuất" }, { key: "approved", label: "Đã duyệt" }]} /> : <div className="text-muted-foreground grid min-h-64 place-items-center text-sm">Chưa có đề xuất trong năm ngân sách này.</div>}
        </ChartCard>
      </section>

      <Card><CardHeader><CardTitle className="text-base">Số liệu chi tiết</CardTitle><p className="text-muted-foreground text-xs">{visibleRows.length} nhóm đang hiển thị · năm ngân sách {selectedYearLabel}</p></CardHeader>
        <CardContent className="overflow-x-auto"><Table className="min-w-[1120px]"><TableHeader><TableRow>
          <TableHead>{report.scope === "SCHOOL" ? "Trường" : "Cơ quan quản lý (địa bàn)"}</TableHead><TableHead className="text-right">Số trường</TableHead><TableHead className="text-right">Số đề xuất</TableHead><TableHead className="text-right">Chờ duyệt</TableHead><TableHead className="text-right">Đã duyệt</TableHead><TableHead className="text-right">Đã vào kế hoạch</TableHead><TableHead className="text-right">Số lượng đề xuất</TableHead><TableHead className="text-right">Số đã nhập về</TableHead><TableHead className="text-right">Dự toán (đ)</TableHead><TableHead className="text-right">Dự toán đã duyệt (đ)</TableHead>
        </TableRow></TableHeader><TableBody>
          {visibleRows.length ? <>{visibleRows.map((row) => <TableRow key={row.key}>
            <TableCell className="font-medium">{row.name}</TableCell><TableCell className="text-right tabular-nums">{count.format(row.schools)}</TableCell><TableCell className="text-right tabular-nums">{count.format(row.proposals)}</TableCell><TableCell className="text-right tabular-nums">{count.format(row.pending)}</TableCell><TableCell className="text-right tabular-nums">{count.format(row.approved)}</TableCell><TableCell className="text-right tabular-nums">{count.format(row.planned)}</TableCell><TableCell className="text-right tabular-nums">{count.format(row.quantity)}</TableCell><TableCell className="text-right tabular-nums">{count.format(row.receivedQuantity)}</TableCell><TableCell className="text-right tabular-nums">{money.format(row.amount)}</TableCell><TableCell className="text-right tabular-nums">{money.format(row.approvedAmount)}</TableCell>
          </TableRow>)}<TableRow className="bg-surface-subtle font-semibold"><TableCell>Tổng đang hiển thị</TableCell><TableCell className="text-right">{count.format(visibleTotals.schools)}</TableCell><TableCell className="text-right">{count.format(visibleTotals.proposals)}</TableCell><TableCell className="text-right">{count.format(visibleTotals.pending)}</TableCell><TableCell className="text-right">{count.format(visibleTotals.approved)}</TableCell><TableCell className="text-right">{count.format(visibleTotals.planned)}</TableCell><TableCell className="text-right">{count.format(visibleTotals.quantity)}</TableCell><TableCell className="text-right">{count.format(visibleTotals.receivedQuantity)}</TableCell><TableCell className="text-right">{money.format(visibleTotals.amount)}</TableCell><TableCell className="text-right">{money.format(visibleTotals.approvedAmount)}</TableCell></TableRow></> : <TableRow><TableCell colSpan={10} className="h-24 text-center text-muted-foreground">Không có đề xuất phù hợp với bộ lọc.</TableCell></TableRow>}
        </TableBody></Table></CardContent>
      </Card>
    </>}
    </div>
  </main>;
}

function OptionFilter({ label, value, onChange, options, className = "w-44" }: { label: string; value: string; onChange: (value: string) => void; options: { key: string; label: string }[]; className?: string }) {
    return <Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label} className={`h-9 min-w-32 rounded-full ${className} px-3 text-xs`}><SelectValue placeholder={label} /></SelectTrigger><SelectContent>
      <SelectItem value={ALL}>{label}</SelectItem>{options.map((option) => <SelectItem key={option.key} value={option.key}>{option.label}</SelectItem>)}
    </SelectContent></Select>;
}

function Kpi({ icon, label, value, detail, tone = "text-primary" }: { icon: ReactNode; label: string; value: string; detail?: string; tone?: string }) {
  return <Card><CardContent className="flex min-h-24 items-center gap-3 p-4"><span className={`${tone} [&_svg]:size-5`}>{icon}</span><div className="min-w-0"><p className="text-muted-foreground text-xs">{label}</p><p className="mt-1 truncate text-2xl font-semibold tabular-nums">{value}</p>{detail && <p className="text-muted-foreground text-xs">{detail}</p>}</div></CardContent></Card>;
}
