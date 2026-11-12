import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Boxes, CalendarPlus, CircleDollarSign, PackageCheck, PackageSearch, Warehouse } from "lucide-react";
import { useEffect, useState } from "react";

import type { AssetReport, ReportOption } from "@/domains/report/types";
import { kyInstance } from "@/shared/api/data";
import { usePerspective } from "@/shared/hooks/use-perspective";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { ReportFilterToolbar } from "./report-filter-toolbar";
import { ReportPrintSheet } from "./report-print-sheet";

const ALL = "__all__";
const today = new Date().toISOString().slice(0, 10);
const number = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 });
const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });

function FilterSelect({ label, value, options, onChange, useKey = false }: {
  label: string; value: string; options: ReportOption[]; onChange: (value: string) => void; useKey?: boolean;
}) {
  const allLabel = label === "Trường" ? "Mọi trường"
    : label === "Môn học" ? "Mọi môn học"
    : label === "Loại thiết bị" ? "Mọi loại thiết bị"
    : label === "Trạng thái" ? "Mọi trạng thái"
    : "Mọi nguồn hình thành";
  const width = label === "Nguồn hình thành"
    ? "min-w-[175px]"
    : label === "Trường"
      ? "min-w-[150px]"
      : "min-w-[135px]";

  return <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className={`h-9 rounded-full ${width} px-3 text-xs`}><SelectValue placeholder={allLabel} /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((option) => {
          const optionValue = useKey ? option.key : option.id == null ? null : String(option.id);
          return optionValue ? <SelectItem key={optionValue} value={optionValue}>{option.label}</SelectItem> : null;
        })}
      </SelectContent>
    </Select>;
}

const fold = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/đ/g, "d");

export function AssetsReport() {
  const { perspective } = usePerspective();
  const [fromDate, setFromDate] = useState("");
  const [defaultFromDate, setDefaultFromDate] = useState("");
  const [toDate, setToDate] = useState(today);
  const [schoolId, setSchoolId] = useState(ALL);
  const [search, setSearch] = useState("");
  const [subjectId, setSubjectId] = useState(ALL);
  const [equipmentTypeId, setEquipmentTypeId] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [originId, setOriginId] = useState(ALL);
  const query = useQuery({
    queryKey: ["reports", "assets", fromDate, toDate, schoolId, subjectId, equipmentTypeId, status, originId],
    queryFn: () => kyInstance.get("reports/assets", { searchParams: {
      fromDate, toDate,
      ...(schoolId !== ALL ? { schoolId } : {}),
      ...(subjectId !== ALL ? { subjectId } : {}),
      ...(equipmentTypeId !== ALL ? { equipmentTypeId } : {}),
      ...(status !== ALL ? { status } : {}),
      ...(originId !== ALL ? { originId } : {}),
    } }).json<AssetReport>(),
    placeholderData: keepPreviousData,
  });
  useEffect(() => {
    if (!defaultFromDate && query.data?.fromDate) setDefaultFromDate(query.data.fromDate);
    if (!fromDate && query.data?.fromDate) setFromDate(query.data.fromDate);
  }, [defaultFromDate, fromDate, query.data?.fromDate]);
  const report = query.data;
  const searchTerm = fold(search.trim());
  const visibleRows = (report?.rows ?? []).filter((row) => !searchTerm || fold(`${row.code} ${row.name} ${row.schoolName}`).includes(searchTerm));
  const scopeName = report?.scope === "SCHOOL" ? "Trường của bạn" : report?.scope === "BODY" ? "Các trường thuộc đơn vị" : "Toàn thành phố";
  const stats = report ? [
    { label: "Số lượng thiết bị", value: number.format(report.summary.quantity), icon: <Boxes />, tone: "text-primary" },
    { label: "Nguyên giá", value: money.format(report.summary.originalValue), icon: <CircleDollarSign />, tone: "text-success-text" },
    { label: "Đang sử dụng", value: number.format(report.summary.inUse), icon: <PackageCheck />, tone: "text-primary" },
    { label: "Trong kho", value: number.format(report.summary.inStorage), icon: <Warehouse />, tone: "text-primary" },
    { label: "Hỏng / đang sửa", value: number.format(report.summary.broken), icon: <AlertTriangle />, tone: "text-warning-text" },
    { label: "Báo mất", value: number.format(report.summary.missing), icon: <PackageSearch />, tone: "text-destructive-text" },
    { label: "Ghi tăng trong kỳ", value: number.format(report.summary.recordedInPeriod), icon: <CalendarPlus />, tone: "text-primary" },
  ] : [];
  const exportData = {
    filename: "bao-cao-tai-san-thiet-bi",
    title: "Báo cáo tài sản thiết bị",
    subtitle: `${report ? `${report.fromDate} — ${report.toDate}` : ""} · ${visibleRows.length} thiết bị`,
    columns: [
      { label: "Mã thiết bị", type: "text" as const }, { label: "Tên thiết bị", type: "text" as const },
      { label: "Trường", type: "text" as const }, { label: "Môn học", type: "text" as const },
      { label: "Loại thiết bị", type: "text" as const }, { label: "Trạng thái", type: "text" as const },
      { label: "Nguồn hình thành", type: "text" as const }, { label: "Tình trạng", type: "text" as const },
      { label: "Số lượng", type: "number" as const }, { label: "Nguyên giá", type: "money" as const },
      { label: "Ngày ghi tăng", type: "date" as const },
    ],
    rows: visibleRows.map((row) => [row.code, row.name, row.schoolName, row.subjectName, row.equipmentTypeName,
      row.statusLabel, row.originName, row.condition, row.quantity, row.originalValue, row.receivedDate]),
  };

  return <main className="space-y-5 p-4 md:p-6">
    {report && <ReportPrintSheet title={exportData.title} scope={scopeName} subtitle={exportData.subtitle} columns={exportData.columns} rows={exportData.rows} />}
    <div className="space-y-5 print:hidden">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-muted-foreground text-sm">{scopeName}</p>
        <h1 className="text-2xl font-semibold tracking-tight">Báo cáo tài sản thiết bị</h1>
        <p className="text-muted-foreground mt-1 text-sm">Thống kê tài sản ghi tăng trong khoảng ngày đã chọn, theo trạng thái hiện tại.</p>
      </div>
      <Button variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching}>
        {query.isFetching ? "Đang tải…" : "Làm mới"}
      </Button>
    </header>

    <ReportFilterToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Tìm thiết bị, mã hoặc trường"
      exportQuery={{ report: "ASSETS", search, fromDate, toDate,
        ...(schoolId !== ALL ? { schoolId } : {}), ...(subjectId !== ALL ? { subjectId } : {}),
        ...(equipmentTypeId !== ALL ? { equipmentTypeId } : {}), ...(status !== ALL ? { status } : {}),
        ...(originId !== ALL ? { originId } : {}) }}
      onReset={() => { setFromDate(defaultFromDate); setToDate(today); setSchoolId(ALL); setSubjectId(ALL); setEquipmentTypeId(ALL); setStatus(ALL); setOriginId(ALL); setSearch(""); }}
      firstRow={<>
        <div className="flex shrink-0 items-center gap-2"><span className="text-muted-foreground shrink-0 text-xs">Từ</span><Input aria-label="Từ ngày" title="Từ ngày" className="h-9 w-40 rounded-full px-3 text-xs" type="date" value={fromDate} max={toDate} onChange={(event) => setFromDate(event.target.value)} /></div>
        <div className="flex shrink-0 items-center gap-2"><span className="text-muted-foreground shrink-0 text-xs">Đến</span><Input aria-label="Đến ngày" title="Đến ngày" className="h-9 w-40 rounded-full px-3 text-xs" type="date" value={toDate} min={fromDate} onChange={(event) => setToDate(event.target.value)} /></div>
      </>}
      secondRow={<>
        {perspective !== "school" && <FilterSelect label="Trường" value={schoolId} options={report?.filters.schools ?? []} onChange={setSchoolId} />}
        <FilterSelect label="Môn học" value={subjectId} options={report?.filters.subjects ?? []} onChange={setSubjectId} />
        <FilterSelect label="Loại thiết bị" value={equipmentTypeId} options={report?.filters.equipmentTypes ?? []} onChange={setEquipmentTypeId} />
        <FilterSelect label="Trạng thái" value={status} options={report?.filters.statuses ?? []} onChange={setStatus} useKey />
        <FilterSelect label="Nguồn hình thành" value={originId} options={report?.filters.origins ?? []} onChange={setOriginId} />
      </>} />

    {query.isError && !report && <Card className="border-destructive/40"><CardContent className="py-5 text-sm text-destructive-text">Không tải được báo cáo. Hãy thử tải lại hoặc kiểm tra quyền truy cập.</CardContent></Card>}
    {query.isFetching && report && <p className="text-muted-foreground text-xs" role="status">Đang cập nhật số liệu theo bộ lọc…</p>}
    {report && <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => <Card key={item.label}><CardContent className="flex items-center gap-3 p-4">
          <span className={`${item.tone} [&_svg]:size-5`}>{item.icon}</span>
          <div className="min-w-0"><p className="text-muted-foreground truncate text-xs">{item.label}</p><p className="mt-1 truncate text-xl font-semibold tabular-nums">{item.value}</p></div>
        </CardContent></Card>)}
      </section>
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <div><CardTitle className="text-base">Danh sách tài sản</CardTitle><p className="text-muted-foreground mt-1 text-xs">{number.format(visibleRows.length)} thiết bị đang hiển thị · {report.fromDate} — {report.toDate}</p></div>
          {report.truncated && <Badge variant="secondary">Đang hiển thị 1.000 dòng đầu</Badge>}
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table className="min-w-[1480px]">
            <TableHeader><TableRow>
              <TableHead>Mã thiết bị</TableHead><TableHead>Tên thiết bị</TableHead><TableHead className="min-w-[150px] whitespace-nowrap">Ngày ghi tăng</TableHead>
              {report.scope !== "SCHOOL" && <TableHead>Trường</TableHead>}
              <TableHead>Môn học</TableHead><TableHead>Loại thiết bị</TableHead><TableHead>Trạng thái</TableHead>
              <TableHead>Nguồn hình thành</TableHead><TableHead className="text-right">Số lượng</TableHead>
              <TableHead className="text-right">Nguyên giá</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {visibleRows.length ? visibleRows.map((row) => <TableRow key={row.id}>
                <TableCell className="font-medium">{row.code}</TableCell><TableCell>{row.name}</TableCell><TableCell className="whitespace-nowrap">{row.receivedDate ?? "—"}</TableCell>
                {report.scope !== "SCHOOL" && <TableCell>{row.schoolName}</TableCell>}
                <TableCell>{row.subjectName ?? "—"}</TableCell><TableCell>{row.equipmentTypeName ?? "—"}</TableCell>
                <TableCell><Badge variant={row.status === "BROKEN" || row.status === "MISSING" ? "destructive" : "secondary"}>{row.statusLabel}</Badge></TableCell>
                <TableCell>{row.originName ?? "—"}</TableCell><TableCell className="text-right tabular-nums">{number.format(row.quantity)}</TableCell>
                <TableCell className="text-right tabular-nums">{row.originalValue == null ? "—" : money.format(row.originalValue)}</TableCell>
              </TableRow>) : <TableRow><TableCell colSpan={report.scope === "SCHOOL" ? 9 : 10} className="h-24 text-center text-muted-foreground">Không có tài sản phù hợp với bộ lọc.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>}
    </div>
  </main>;
}
