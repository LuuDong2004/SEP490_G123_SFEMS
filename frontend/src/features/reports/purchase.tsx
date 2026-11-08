import { useQuery } from "@tanstack/react-query";
import { Banknote, CheckCircle2, FileCheck2, PackageCheck, RefreshCw, ShoppingCart } from "lucide-react";
import { useState, type ReactNode } from "react";

import type { PurchaseReport } from "@/domains/report/types";
import { ChartCard, GroupedBars } from "@/shared/components/charts/charts";
import { kyInstance } from "@/shared/api/data";
import { usePerspective } from "@/shared/hooks/use-perspective";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

const ALL = "all";
const count = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });
const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const compactMoney = new Intl.NumberFormat("vi-VN", { notation: "compact", maximumFractionDigits: 1 });

export function PurchaseReportPage() {
  const { perspective } = usePerspective();
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [school, setSchool] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const query = useQuery({
    queryKey: ["reports", "purchase", year, school, status],
    queryFn: () => kyInstance.get("reports/purchase", { searchParams: {
      year,
      ...(school !== ALL ? { schoolId: school } : {}),
      ...(status !== ALL ? { status } : {}),
    } }).json<PurchaseReport>(),
  });
  const report = query.data;
  const amountChart = (report?.rows ?? []).slice(0, 12).map((row) => ({
    name: row.name,
    requested: Number(row.amount) / 1_000_000,
    approved: Number(row.approvedAmount) / 1_000_000,
  }));
  const selectedYearLabel = report?.filters.years.find((option) => option.key === year)?.label ?? year;

  return <main className="space-y-4 p-4 md:p-6">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-muted-foreground text-sm">{report?.scope === "SCHOOL" ? "Trường của bạn" : report?.scope === "BODY" ? "Các trường thuộc đơn vị" : "Toàn thành phố"}</p>
        <h1 className="text-2xl font-semibold tracking-tight">Nhu cầu và kế hoạch mua sắm</h1>
        <p className="text-muted-foreground mt-1 text-sm">Tổng hợp đề xuất, dự toán và tình hình đưa vào kế hoạch theo năm ngân sách.</p>
      </div>
      <Button variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching}><RefreshCw className="mr-2 size-4" />Làm mới</Button>
    </header>

    <Card><CardContent className={`grid grid-cols-2 items-end gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4 xl:gap-2 ${perspective === "school" ? "xl:grid-cols-3" : "xl:grid-cols-4"}`}>
      <label className="grid min-w-0 gap-1 text-xs text-muted-foreground">Năm ngân sách
        <div className="flex min-w-0 items-center gap-1"><Button variant="outline" size="icon" className="size-9 shrink-0" aria-label="Năm trước" onClick={() => setYear(String(Number(year) - 1))}>‹</Button>
          <Select value={year} onValueChange={setYear}><SelectTrigger className="h-9 min-w-0 flex-1"><SelectValue placeholder={selectedYearLabel} /></SelectTrigger><SelectContent>{(report?.filters.years ?? [{ key: year, label: year }]).map((option) => <SelectItem key={option.key} value={option.key}>{option.label}</SelectItem>)}</SelectContent></Select>
          <Button variant="outline" size="icon" className="size-9 shrink-0" aria-label="Năm sau" onClick={() => setYear(String(Number(year) + 1))}>›</Button>
        </div>
      </label>
      {perspective !== "school" && <OptionFilter label="Trường" value={school} onChange={setSchool} options={report?.filters.schools ?? []} />}
      <OptionFilter label="Trạng thái duyệt" value={status} onChange={setStatus} options={report?.filters.statuses ?? []} />
      <Button className="h-9" variant="ghost" onClick={() => { setYear(String(new Date().getFullYear())); setSchool(ALL); setStatus(ALL); }}>Xóa lọc</Button>
    </CardContent></Card>

    {query.isError && <Card className="border-destructive/40"><CardContent className="py-5 text-sm text-destructive-text">Không tải được báo cáo nhu cầu mua sắm. Hãy tải lại trang hoặc kiểm tra quyền truy cập.</CardContent></Card>}
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

      <Card><CardHeader><CardTitle className="text-base">Số liệu chi tiết</CardTitle><p className="text-muted-foreground text-xs">{report.rows.length} nhóm · năm ngân sách {selectedYearLabel}</p></CardHeader>
        <CardContent className="overflow-x-auto"><Table className="min-w-[1120px]"><TableHeader><TableRow>
          <TableHead>{report.scope === "SCHOOL" ? "Trường" : "Cơ quan quản lý (địa bàn)"}</TableHead><TableHead className="text-right">Số trường</TableHead><TableHead className="text-right">Số đề xuất</TableHead><TableHead className="text-right">Chờ duyệt</TableHead><TableHead className="text-right">Đã duyệt</TableHead><TableHead className="text-right">Đã vào kế hoạch</TableHead><TableHead className="text-right">Số lượng đề xuất</TableHead><TableHead className="text-right">Số đã nhập về</TableHead><TableHead className="text-right">Dự toán (đ)</TableHead><TableHead className="text-right">Dự toán đã duyệt (đ)</TableHead>
        </TableRow></TableHeader><TableBody>
          {report.rows.length ? <>{report.rows.map((row) => <TableRow key={row.key}>
            <TableCell className="font-medium">{row.name}</TableCell><TableCell className="text-right tabular-nums">{count.format(row.schools)}</TableCell><TableCell className="text-right tabular-nums">{count.format(row.proposals)}</TableCell><TableCell className="text-right tabular-nums">{count.format(row.pending)}</TableCell><TableCell className="text-right tabular-nums">{count.format(row.approved)}</TableCell><TableCell className="text-right tabular-nums">{count.format(row.planned)}</TableCell><TableCell className="text-right tabular-nums">{count.format(row.quantity)}</TableCell><TableCell className="text-right tabular-nums">{count.format(row.receivedQuantity)}</TableCell><TableCell className="text-right tabular-nums">{money.format(row.amount)}</TableCell><TableCell className="text-right tabular-nums">{money.format(row.approvedAmount)}</TableCell>
          </TableRow>)}<TableRow className="bg-surface-subtle font-semibold"><TableCell>Tổng</TableCell><TableCell className="text-right">{count.format(report.rows.reduce((s, row) => s + row.schools, 0))}</TableCell><TableCell className="text-right">{count.format(report.summary.proposals)}</TableCell><TableCell className="text-right">{count.format(report.summary.pending)}</TableCell><TableCell className="text-right">{count.format(report.summary.approved)}</TableCell><TableCell className="text-right">{count.format(report.summary.planned)}</TableCell><TableCell className="text-right">{count.format(report.summary.quantity)}</TableCell><TableCell className="text-right">{count.format(report.summary.receivedQuantity)}</TableCell><TableCell className="text-right">{money.format(report.summary.amount)}</TableCell><TableCell className="text-right">{money.format(report.summary.approvedAmount)}</TableCell></TableRow></> : <TableRow><TableCell colSpan={10} className="h-24 text-center text-muted-foreground">Không có đề xuất phù hợp với bộ lọc.</TableCell></TableRow>}
        </TableBody></Table></CardContent>
      </Card>
    </>}
  </main>;
}

function OptionFilter({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { key: string; label: string }[] }) {
  return <label className="grid min-w-0 gap-1 text-xs text-muted-foreground">{label}
    <Select value={value} onValueChange={onChange}><SelectTrigger className="h-9 min-w-0"><SelectValue /></SelectTrigger><SelectContent>
      <SelectItem value={ALL}>Tất cả</SelectItem>{options.map((option) => <SelectItem key={option.key} value={option.key}>{option.label}</SelectItem>)}
    </SelectContent></Select>
  </label>;
}

function Kpi({ icon, label, value, detail, tone = "text-primary" }: { icon: ReactNode; label: string; value: string; detail?: string; tone?: string }) {
  return <Card><CardContent className="flex min-h-24 items-center gap-3 p-4"><span className={`${tone} [&_svg]:size-5`}>{icon}</span><div className="min-w-0"><p className="text-muted-foreground text-xs">{label}</p><p className="mt-1 truncate text-2xl font-semibold tabular-nums">{value}</p>{detail && <p className="text-muted-foreground text-xs">{detail}</p>}</div></CardContent></Card>;
}
