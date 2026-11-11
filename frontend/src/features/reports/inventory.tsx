import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ClipboardCheck, MapPin, PackageCheck, PackageMinus, PackagePlus, RefreshCw, School, Wrench } from "lucide-react";
import { useState, type ReactNode } from "react";

import type { InventoryReport } from "@/domains/report/types";
import { kyInstance } from "@/shared/api/data";
import { usePerspective } from "@/shared/hooks/use-perspective";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { ReportFilterToolbar } from "./report-filter-toolbar";
import { ReportPrintSheet } from "./report-print-sheet";

const ALL = "__all__";
const count = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 });
const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const fold = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/đ/g, "d");

export function InventoryReportPage() {
  const { perspective } = usePerspective();
  const [campaign, setCampaign] = useState(ALL);
  const [school, setSchool] = useState(ALL);
  const [search, setSearch] = useState("");
  const query = useQuery({
    queryKey: ["reports", "inventory", campaign, school],
    queryFn: () => kyInstance.get("reports/inventory", { searchParams: {
      ...(campaign !== ALL ? { campaignId: campaign } : {}),
      ...(school !== ALL ? { schoolId: school } : {}),
    } }).json<InventoryReport>(),
    placeholderData: keepPreviousData,
  });
  const report = query.data;
  const searchTerm = fold(search.trim());
  const visibleRows = (report?.rows ?? []).filter((row) => !searchTerm || fold(`${row.code} ${row.campaign} ${row.school}`).includes(searchTerm));
  const scope = report?.scope === "SCHOOL" ? "Trường của bạn" : report?.scope === "BODY" ? "Các trường thuộc đơn vị" : "Toàn thành phố";
  const exportData = {
    filename: "bao-cao-ket-qua-kiem-ke",
    title: "Báo cáo kết quả kiểm kê",
    subtitle: `${visibleRows.length} phiếu kiểm kê · Lọc theo đợt kiểm kê và trường`,
    columns: [
      { label: "Số phiếu", type: "text" as const }, { label: "Đợt kiểm kê", type: "text" as const },
      { label: "Trường", type: "text" as const }, { label: "Ngày kiểm kê", type: "date" as const },
      { label: "Trạng thái", type: "text" as const }, { label: "Số thiết bị theo sổ", type: "number" as const },
      { label: "Số khớp", type: "number" as const }, { label: "Số thiếu", type: "number" as const },
      { label: "Số thừa", type: "number" as const }, { label: "Số hỏng", type: "number" as const },
      { label: "Sai vị trí", type: "number" as const }, { label: "Giá trị chênh lệch ước tính (đ)", type: "money" as const },
    ],
    rows: visibleRows.map((row) => [row.code, row.campaign, row.school, row.inventoryDate, row.statusLabel,
      row.bookQuantity, row.matchedQuantity, row.shortageQuantity, row.surplusQuantity, row.damagedQuantity,
      row.wrongLocationQuantity, row.discrepancyValue]),
  };

  return <main className="space-y-4 p-4 md:p-6">
    {report && <ReportPrintSheet title={exportData.title} scope={scope} subtitle={exportData.subtitle} columns={exportData.columns} rows={exportData.rows} />}
    <div className="space-y-4 print:hidden">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-muted-foreground text-sm">{scope}</p>
        <h1 className="text-2xl font-semibold tracking-tight">Báo cáo kết quả kiểm kê</h1>
        <p className="text-muted-foreground mt-1 text-sm">Tổng hợp số thiết bị theo sổ, kết quả kiểm đếm và các chênh lệch theo từng đợt.</p>
      </div>
      <Button variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching}><RefreshCw className="mr-2 size-4" />Làm mới</Button>
    </header>

    <ReportFilterToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Tìm số phiếu, đợt hoặc trường"
      exportData={exportData}
      onReset={() => { setCampaign(ALL); setSchool(ALL); setSearch(""); }}
      filters={<>
        <Select value={campaign} onValueChange={setCampaign}><SelectTrigger aria-label="Đợt kiểm kê" className="h-9 w-48 rounded-full px-3 text-xs"><SelectValue placeholder="Mọi đợt kiểm kê" /></SelectTrigger>
          <SelectContent><SelectItem value={ALL}>Mọi đợt kiểm kê</SelectItem>{(report?.filters.campaigns ?? []).map((option) => <SelectItem key={option.id} value={String(option.id)}>{option.label}</SelectItem>)}</SelectContent>
        </Select>
        {perspective !== "school" && <Select value={school} onValueChange={setSchool}><SelectTrigger aria-label="Trường" className="h-9 w-40 rounded-full px-3 text-xs"><SelectValue placeholder="Mọi trường" /></SelectTrigger>
          <SelectContent><SelectItem value={ALL}>Mọi trường</SelectItem>{(report?.filters.schools ?? []).map((option) => <SelectItem key={option.id} value={String(option.id)}>{option.label}</SelectItem>)}</SelectContent>
        </Select>}
      </>} />

    {query.isError && !report && <Card className="border-destructive/40"><CardContent className="py-5 text-sm text-destructive-text">Không tải được báo cáo kiểm kê. Hãy tải lại hoặc kiểm tra quyền truy cập.</CardContent></Card>}
    {query.isError && report && <p className="text-sm text-destructive-text" role="status">Không cập nhật được bộ lọc mới. Đang giữ kết quả trước đó.</p>}
    {query.isFetching && report && <p className="text-muted-foreground text-xs" role="status">Đang cập nhật số liệu theo bộ lọc…</p>}
    {report && <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={<ClipboardCheck />} label="Phiên kiểm kê" value={count.format(report.summary.sessions)} />
        <Kpi icon={<School />} label="Thiết bị theo sổ" value={count.format(report.summary.bookQuantity)} />
        <Kpi icon={<PackageCheck />} label="Đã khớp" value={count.format(report.summary.matchedQuantity)} tone="text-success-text" />
        <Kpi icon={<PackageMinus />} label="Thiếu" value={count.format(report.summary.shortageQuantity)} tone="text-destructive-text" />
        <Kpi icon={<PackagePlus />} label="Thừa" value={count.format(report.summary.surplusQuantity)} />
        <Kpi icon={<Wrench />} label="Hỏng" value={count.format(report.summary.damagedQuantity)} tone="text-warning-text" />
        <Kpi icon={<MapPin />} label="Sai vị trí" value={count.format(report.summary.wrongLocationQuantity)} />
        <Kpi icon={<PackageMinus />} label="Giá trị chênh lệch ước tính" value={money.format(report.summary.discrepancyValue)} tone="text-warning-text" />
      </section>
      <Card>
        <CardHeader><CardTitle className="text-base">Kết quả theo phiếu kiểm kê</CardTitle><p className="text-muted-foreground text-xs">{count.format(visibleRows.length)} phiếu trong phạm vi dữ liệu của bạn</p></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table className="min-w-[1250px]"><TableHeader><TableRow>
            <TableHead>Số phiếu</TableHead><TableHead>Đợt kiểm kê</TableHead><TableHead>Trường</TableHead><TableHead>Ngày kiểm kê</TableHead><TableHead>Trạng thái</TableHead>
            <TableHead className="text-right">Theo sổ</TableHead><TableHead className="text-right">Khớp</TableHead><TableHead className="text-right">Thiếu</TableHead><TableHead className="text-right">Thừa</TableHead>
            <TableHead className="text-right">Hỏng</TableHead><TableHead className="text-right">Sai vị trí</TableHead><TableHead className="text-right">Giá trị chênh lệch</TableHead>
          </TableRow></TableHeader><TableBody>
            {visibleRows.length ? visibleRows.map((row) => <TableRow key={row.id}>
              <TableCell className="font-mono text-xs">{row.code}</TableCell><TableCell>{row.campaign}</TableCell><TableCell className="font-medium">{row.school}</TableCell><TableCell className="whitespace-nowrap">{row.inventoryDate}</TableCell>
              <TableCell><Badge variant={row.status === "COMPLETED" ? "default" : "secondary"}>{row.statusLabel}</Badge></TableCell>
              <TableCell className="text-right tabular-nums">{count.format(row.bookQuantity)}</TableCell><TableCell className="text-right tabular-nums">{count.format(row.matchedQuantity)}</TableCell>
              <TableCell className="text-right tabular-nums">{count.format(row.shortageQuantity)}</TableCell><TableCell className="text-right tabular-nums">{count.format(row.surplusQuantity)}</TableCell>
              <TableCell className="text-right tabular-nums">{count.format(row.damagedQuantity)}</TableCell><TableCell className="text-right tabular-nums">{count.format(row.wrongLocationQuantity)}</TableCell>
              <TableCell className="text-right tabular-nums">{money.format(row.discrepancyValue)}</TableCell>
            </TableRow>) : <TableRow><TableCell colSpan={12} className="h-24 text-center text-muted-foreground">Không có kết quả kiểm kê phù hợp với bộ lọc.</TableCell></TableRow>}
          </TableBody></Table>
        </CardContent>
      </Card>
    </>}
    </div>
  </main>;
}

function Kpi({ icon, label, value, tone = "text-primary" }: { icon: ReactNode; label: string; value: string; tone?: string }) {
  return <Card><CardContent className="flex min-h-24 items-center gap-3 p-4"><span className={`${tone} [&_svg]:size-5`}>{icon}</span><div className="min-w-0"><p className="text-muted-foreground text-xs">{label}</p><p className="mt-1 truncate text-xl font-semibold tabular-nums">{value}</p></div></CardContent></Card>;
}
