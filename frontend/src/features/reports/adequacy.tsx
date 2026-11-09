import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Gauge, School, ClipboardList, RefreshCw } from "lucide-react";
import { useState, type ReactNode } from "react";

import type { AdequacyReport } from "@/domains/report/types";
import { ChartCard, DonutBreakdown, GroupedBars } from "@/shared/components/charts/charts";
import { kyInstance } from "@/shared/api/data";
import { ReportFilterToolbar } from "./report-filter-toolbar";
import { usePerspective } from "@/shared/hooks/use-perspective";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Progress } from "@/shared/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

const ALL = "all";
const count = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });

function DimensionFilter({ label, value, onChange, options }: {
  label: string; value: string; onChange: (value: string) => void; options: { id: number; label: string }[];
}) {
  const allLabel = label === "Trường" ? "Mọi trường" : label === "Khối lớp" ? "Mọi khối lớp" : label === "Loại thiết bị" ? "Mọi loại thiết bị" : "Mọi môn học";
  const width = "w-36";
  return <Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label} className={`h-9 min-w-32 rounded-full ${width} px-3 text-xs`}><SelectValue placeholder={allLabel} /></SelectTrigger>
      <SelectContent><SelectItem value={ALL}>{allLabel}</SelectItem>{options.map((option) => <SelectItem key={option.id} value={String(option.id)}>{option.label}</SelectItem>)}</SelectContent>
    </Select>
}

const fold = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/đ/g, "d");

export function AdequacyReportPage() {
  const { perspective } = usePerspective();
  const [school, setSchool] = useState(ALL);
  const [subject, setSubject] = useState(ALL);
  const [grade, setGrade] = useState(ALL);
  const [type, setType] = useState(ALL);
  const [search, setSearch] = useState("");
  const query = useQuery({
    queryKey: ["reports", "adequacy", school, subject, grade, type],
    queryFn: () => kyInstance.get("reports/adequacy", { searchParams: {
      ...(school !== ALL ? { schoolId: school } : {}),
      ...(subject !== ALL ? { subjectId: subject } : {}),
      ...(grade !== ALL ? { gradeId: grade } : {}),
      ...(type !== ALL ? { equipmentTypeId: type } : {}),
    } }).json<AdequacyReport>(),
    placeholderData: keepPreviousData,
  });
  const report = query.data;
  const searchTerm = fold(search.trim());
  const visibleRows = (report?.rows ?? []).filter((row) => !searchTerm || fold(`${row.schoolCode} ${row.schoolName}`).includes(searchTerm));
  const summary = report?.summary;
  const bands = (report?.distribution ?? []).map((band) => ({ key: band.key, label: band.label, count: band.count }));
  const lowest = [...(report?.rows ?? [])].filter((row) => row.percent != null).sort((a, b) => a.percent! - b.percent!).slice(0, 10)
    .map((row) => ({ school: row.schoolName, percent: row.percent ?? 0 }));

  return <main className="space-y-4 p-4 md:p-6">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-muted-foreground text-sm">{report?.scope === "SCHOOL" ? "Trường của bạn" : report?.scope === "BODY" ? "Các trường thuộc đơn vị" : "Toàn thành phố"}</p>
        <h1 className="text-2xl font-semibold tracking-tight">Đáp ứng danh mục thiết bị tối thiểu</h1>
        <p className="text-muted-foreground mt-1 text-sm">So sánh số thiết bị hiện có với định mức đang áp dụng cho từng trường.</p>
      </div>
      <Button variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching}><RefreshCw className="mr-2 size-4" />Làm mới</Button>
    </header>

    <ReportFilterToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Tìm trường hoặc mã trường"
      onReset={() => { setSchool(ALL); setSubject(ALL); setGrade(ALL); setType(ALL); setSearch(""); }}
      filters={<>
        {perspective !== "school" && <DimensionFilter label="Trường" value={school} onChange={setSchool} options={report?.filters.schools ?? []} />}
        <DimensionFilter label="Môn học" value={subject} onChange={setSubject} options={report?.filters.subjects ?? []} />
        <DimensionFilter label="Khối lớp" value={grade} onChange={setGrade} options={report?.filters.grades ?? []} />
        <DimensionFilter label="Loại thiết bị" value={type} onChange={setType} options={report?.filters.equipmentTypes ?? []} />
      </>} />

    {query.isError && !report && <Card className="border-destructive/40"><CardContent className="py-5 text-sm text-destructive-text">Không tải được báo cáo mức đáp ứng. Hãy tải lại trang hoặc kiểm tra quyền truy cập.</CardContent></Card>}
    {query.isError && report && <p className="text-sm text-destructive-text" role="status">Không cập nhật được bộ lọc mới. Đang giữ kết quả trước đó.</p>}
    {query.isFetching && report && <p className="text-muted-foreground text-xs" role="status">Đang cập nhật số liệu theo bộ lọc…</p>}
    {report && <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={<School />} label="Trường" value={count.format(summary!.schools)} />
        <Kpi icon={<Gauge />} label="Đáp ứng trung bình" value={`${summary!.averagePercent}%`} detail={`${count.format(summary!.countedSchools)} trường tính được`} />
        <Kpi icon={<AlertTriangle />} label="Thiết bị còn thiếu" value={count.format(summary!.shortageTotal)} tone="text-destructive-text" />
        <Kpi icon={<ClipboardList />} label="Định mức chưa tính được" value={count.format(summary!.unknownNorms)} detail="Thiếu số lớp / số học sinh hoặc dữ liệu giáo viên" />
      </section>
      <section className="grid gap-3 lg:grid-cols-2">
        <Card><CardHeader><CardTitle className="text-base">Đáp ứng trung bình</CardTitle><p className="text-muted-foreground text-xs">Tỷ lệ định mức đã đạt tại các trường tính được</p></CardHeader>
          <CardContent className="flex min-h-52 flex-col justify-center gap-4"><div className="text-center text-5xl font-bold tabular-nums">{summary!.averagePercent}%</div><Progress value={summary!.averagePercent} className="h-3" /><p className="text-muted-foreground text-center text-sm">{count.format(summary!.shortageTotal)} thiết bị còn thiếu</p></CardContent>
        </Card>
        <ChartCard title="Phân bố mức đáp ứng" description="Số trường theo tỷ lệ định mức đạt"><DonutBreakdown items={bands} unit="trường" /></ChartCard>
      </section>
      {lowest.length > 1 && <ChartCard title="Trường đáp ứng thấp nhất" description="Tỷ lệ định mức đạt · 10 trường thấp nhất">
        <GroupedBars data={lowest} xKey="school" series={[{ key: "percent", label: "Đạt (%)" }]} />
      </ChartCard>}
      <Card><CardHeader><CardTitle className="text-base">Số liệu chi tiết</CardTitle><p className="text-muted-foreground text-xs">{count.format(visibleRows.length)} trường đang hiển thị trong phạm vi dữ liệu của bạn</p></CardHeader>
        <CardContent className="overflow-x-auto"><Table className="min-w-[1050px]"><TableHeader><TableRow>
          <TableHead>Mã trường</TableHead><TableHead>Trường</TableHead><TableHead>Cấp học</TableHead><TableHead className="text-right">Số định mức</TableHead><TableHead className="text-right">Đã đạt</TableHead><TableHead className="text-right">Chưa tính</TableHead><TableHead className="text-right">Định mức thiếu</TableHead><TableHead className="text-right">Thiết bị thiếu</TableHead><TableHead className="text-right">Thiết bị thừa</TableHead><TableHead className="text-right">Tỷ lệ đạt</TableHead>
        </TableRow></TableHeader><TableBody>
          {visibleRows.length ? visibleRows.map((row) => <TableRow key={row.schoolId}>
            <TableCell className="font-mono text-xs">{row.schoolCode}</TableCell><TableCell className="font-medium">{row.schoolName}</TableCell><TableCell>{row.educationLevel ?? "—"}</TableCell>
            <TableCell className="text-right tabular-nums">{count.format(row.norms)}</TableCell><TableCell className="text-right tabular-nums">{count.format(row.met)}</TableCell><TableCell className="text-right tabular-nums">{count.format(row.unknown)}</TableCell><TableCell className="text-right tabular-nums">{count.format(row.shortageNorms)}</TableCell><TableCell className="text-right tabular-nums">{count.format(row.shortageTotal)}</TableCell><TableCell className="text-right tabular-nums">{count.format(row.surplusTotal)}</TableCell><TableCell className="text-right tabular-nums">{row.percent == null ? "—" : `${row.percent}%`}</TableCell>
          </TableRow>) : <TableRow><TableCell colSpan={10} className="h-24 text-center text-muted-foreground">Không có trường hoặc định mức phù hợp với bộ lọc.</TableCell></TableRow>}
        </TableBody></Table></CardContent>
      </Card>
    </>}
  </main>;
}

function Kpi({ icon, label, value, detail, tone = "text-primary" }: { icon: ReactNode; label: string; value: string; detail?: string; tone?: string }) {
  return <Card><CardContent className="flex min-h-24 items-center gap-3 p-4"><span className={`${tone} [&_svg]:size-5`}>{icon}</span><div className="min-w-0"><p className="text-muted-foreground text-xs">{label}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>{detail && <p className="text-muted-foreground text-xs">{detail}</p>}</div></CardContent></Card>;
}
