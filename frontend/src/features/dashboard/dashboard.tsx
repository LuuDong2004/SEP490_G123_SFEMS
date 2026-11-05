import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Boxes,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Gauge,
  PackageX,
  School,
  Wrench,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { ChartCard, DonutBreakdown, GroupedBars, RangeSelect, type Slice } from "@/shared/components/charts/charts";
import { kyInstance } from "@/shared/api/data";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

type DashboardStatus = { key: string; label: string; count: number };
type DashboardMonth = { month: string; intake: number; allocation: number; damage: number; disposal: number };
type PendingTask = { key: string; label: string; count: number };
type DashboardDevices = {
  total: number;
  originalValue: number;
  inUse: number;
  inStorage: number;
  broken: number;
  missing: number;
  disposed: number;
  pendingLiquidation: number;
};

type DashboardData = {
  scope: "CITY" | "BODY" | "SCHOOL" | "NONE";
  schoolName?: string;
  schoolYears: { id: number; label: string }[];
  selectedSchoolYearId: number | null;
  city?: {
    devices: DashboardDevices;
    minimumStandard: { schoolsMeeting: number; schoolCount: number; rate: number };
    proposalsAwaitingDepartmentApproval: number;
    procurementPlan: { year: number; status: string; plannedValue: number } | null;
    inventory: { campaignName: string; submittedSchools: number; schoolCount: number; dueDate: string | null } | null;
    schoolsNeedingAttention: { id: number; name: string; reason: string; equipment: number; broken: number; missing: number; pending: number }[];
    statuses: DashboardStatus[];
    months: DashboardMonth[];
    pendingByType: PendingTask[];
  };
  school?: {
    devices: DashboardDevices;
    minimumStandard: { met: number; required: number; rate: number };
    pendingVouchers: number;
    inventory: { campaignName: string; dueDate: string | null; submitted: boolean } | null;
    statuses: DashboardStatus[];
    vouchers: DashboardStatus[];
    months: DashboardMonth[];
    pendingByType: PendingTask[];
  };
};

const number = new Intl.NumberFormat("vi-VN");
const currency = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const percent = (value: number) => `${Math.max(0, Math.min(100, value))}%`;
const PERIODS = [
  { value: "month", label: "Tháng này" },
  { value: "quarter", label: "Quý này" },
  { value: "year", label: "Năm nay" },
  { value: "all", label: "Mọi lúc" },
];
const PENDING_FILTER = "filters[0][field]=status&filters[0][operator]=eq&filters[0][value]=PENDING";
const VOUCHER_ROUTES: Record<string, string> = {
  equipment_intakes: "/equipment-intakes",
  purchase_proposals: "/purchase-proposals",
  inventory_sessions: "/inventory-sessions",
};

function SummaryCard({
  label,
  value,
  unit,
  detail,
  icon: Icon,
  tone = "primary",
  meter,
  to,
}: {
  label: string;
  value: string;
  unit?: string;
  detail?: string;
  icon: typeof Boxes;
  tone?: "primary" | "warning" | "destructive" | "success";
  meter?: { value: number; label: string };
  to?: string;
}) {
  const content = (
    <Card className="group h-full gap-3 p-4 transition-[border-color,box-shadow] hover:border-primary/40 hover:shadow-e2">
      <div className="flex items-start justify-between gap-3">
        <p className="text-muted-foreground text-sm">{label}</p>
        <span className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          tone === "primary" && "bg-primary/10 text-primary",
          tone === "warning" && "bg-warning-subtle text-warning-text",
          tone === "destructive" && "bg-destructive/10 text-destructive",
          tone === "success" && "bg-success-subtle text-success-text",
        )}><Icon className="size-4" /></span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold tracking-tight tabular-nums">{value}</span>
        {unit ? <span className="text-muted-foreground text-sm">{unit}</span> : null}
      </div>
      {meter ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground truncate">{meter.label}</span>
            <span className="font-semibold tabular-nums">{percent(meter.value)}</span>
          </div>
          <div className="bg-muted h-1.5 overflow-hidden rounded-full"><div className="bg-primary h-full rounded-full" style={{ width: percent(meter.value) }} /></div>
        </div>
      ) : detail ? <p className="text-muted-foreground text-xs">{detail}</p> : null}
    </Card>
  );
  return to ? <Link to={to} className="block">{content}</Link> : content;
}

function LoadingDashboard() {
  return <div className="space-y-4" role="status" aria-label="Đang tải bảng điều khiển">
    <div className="h-8 w-64 animate-pulse rounded bg-muted" />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />)}</div>
    <div className="grid gap-4 xl:grid-cols-2">{Array.from({ length: 4 }, (_, i) => <div key={i} className="h-64 animate-pulse rounded-xl bg-muted" />)}</div>
  </div>;
}

function DashboardError({ onRetry }: { onRetry: () => void }) {
  return <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 text-center">
    <span className="bg-warning-subtle text-warning-text flex size-12 items-center justify-center rounded-full"><AlertTriangle className="size-6" /></span>
    <h1 className="font-semibold">Chưa tải được bảng điều khiển</h1>
    <p className="text-muted-foreground text-sm">Máy chủ chưa phản hồi. Hãy thử tải lại sau ít phút.</p>
    <Button variant="outline" onClick={onRetry}>Tải lại</Button>
  </div>;
}

function assetSlices(statuses: DashboardStatus[]): Slice[] {
  return statuses.map((status) => ({ key: status.key, label: status.label, count: status.count }));
}

function TrendChart({ months }: { months: DashboardMonth[] }) {
  return <GroupedBars height="h-64" data={months} xKey="month" xFormatter={(month) => month.slice(0, 2) + "/" + month.slice(5)} series={[
    { key: "intake", label: "Ghi tăng" },
    { key: "allocation", label: "Cấp phát, điều chuyển" },
    { key: "damage", label: "Báo hỏng" },
    { key: "disposal", label: "Thanh lý, mất" },
  ]} />;
}

function PendingList({ items, title }: { items: PendingTask[]; title: string }) {
  const total = items.reduce((sum, item) => sum + item.count, 0);
  return <ChartCard title={total ? `${title} (${number.format(total)})` : title}>
    {items.length === 0 ? <div className="text-muted-foreground flex flex-col items-center gap-2 py-8 text-center text-sm">
      <span className="bg-success-subtle text-success-text flex size-10 items-center justify-center rounded-full"><CheckCircle2 className="size-5" /></span>
      Không có việc nào đang chờ.
    </div> : <ul className="-mx-2 -my-1">
      {items.map((item) => {
        const route = VOUCHER_ROUTES[item.key];
        const row = <>
          <span className="bg-warning-subtle text-warning-text flex size-8 shrink-0 items-center justify-center rounded-lg"><ClipboardCheck className="size-4" /></span>
          <span className="min-w-0 flex-1 truncate text-sm">{item.label} chờ duyệt</span>
          <Badge variant="warning">{number.format(item.count)}</Badge>
          <ChevronRight className="text-muted-foreground size-4 shrink-0" />
        </>;
        return <li key={item.key}>{route
          ? <Link to={`${route}?${PENDING_FILTER}`} className="group hover:bg-muted/60 flex items-center gap-3 rounded-md px-2 py-2">{row}</Link>
          : <div className="flex items-center gap-3 px-2 py-2">{row}</div>}
        </li>;
      })}
    </ul>}
  </ChartCard>;
}

function DashboardHeader({
  scope,
  schoolName,
  years,
  selectedYear,
  onYearChange,
}: {
  scope: DashboardData["scope"];
  schoolName?: string;
  years: DashboardData["schoolYears"];
  selectedYear?: string;
  onYearChange: (value: string) => void;
}) {
  const scopeLabel = scope === "SCHOOL" ? schoolName ?? "Trường của tôi"
    : scope === "BODY" ? "Cơ quan quản lý" : scope === "NONE" ? "Chưa xác định phạm vi" : "Toàn ngành";
  return <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
    <h1 className="text-2xl font-semibold tracking-tight">Tổng hợp <span className="text-muted-foreground ms-3 text-base font-normal">{scopeLabel}</span></h1>
    <div className="flex flex-wrap items-center gap-3">
      <p className="text-muted-foreground text-sm first-letter:uppercase">{new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}</p>
      <div className="flex items-center gap-2"><CalendarDays className="text-muted-foreground size-4" />
        <Select value={selectedYear} onValueChange={onYearChange}><SelectTrigger aria-label="Chọn năm học" className="h-8 w-44"><SelectValue placeholder="Năm học hiện tại" /></SelectTrigger>
          <SelectContent>{years.map((year) => <SelectItem key={year.id} value={String(year.id)}>{year.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
    </div>
  </div>;
}

function SchoolDashboard({ data, period, setPeriod }: { data: DashboardData; period: string; setPeriod: (value: string) => void }) {
  const school = data.school;
  if (!school) return null;
  const devices = school.devices;
  const useRate = devices.total ? Math.round(devices.inUse * 100 / devices.total) : 0;
  const pendingTotal = school.pendingByType.reduce((sum, item) => sum + item.count, 0);
  const taskItems = [...school.pendingByType];
  if (school.inventory && !school.inventory.submitted) taskItems.push({ key: "inventory_due", label: `Nộp kiểm kê: ${school.inventory.campaignName}`, count: 1 });

  return <div className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryCard to="/equipment" label="Tài sản trên sổ" value={number.format(devices.total)} unit="tài sản" icon={Boxes}
        meter={{ value: useRate, label: `Đang sử dụng ${number.format(devices.inUse)} / ${number.format(devices.total)}` }} />
      <SummaryCard to="/equipment-intakes" label="Phiếu chờ duyệt" value={number.format(pendingTotal)} unit="phiếu" icon={ClipboardCheck}
        tone={pendingTotal ? "warning" : "success"} />
      <SummaryCard to="/equipment" label="Hỏng, đang sửa" value={number.format(devices.broken)} unit="tài sản" icon={Wrench}
        tone={devices.broken ? "destructive" : "success"} />
      <SummaryCard to="/equipment" label="Chờ ghi giảm" value={number.format(devices.missing + devices.pendingLiquidation)} unit="tài sản" icon={PackageX}
        tone={devices.missing + devices.pendingLiquidation ? "warning" : "success"} />
    </div>

    <div className="grid gap-4 xl:grid-cols-2">
      <ChartCard title="Tài sản theo trạng thái">
        <DonutBreakdown items={assetSlices(school.statuses)} unit="tài sản" />
      </ChartCard>
      <ChartCard title={<span className="flex items-center gap-2">Phiếu trong kỳ <span className="text-muted-foreground text-xs font-normal">Chỉ tính phiếu được lập trong kỳ</span></span>}
        action={<RangeSelect value={period} onChange={setPeriod} options={PERIODS} />}>
        <DonutBreakdown items={assetSlices(school.vouchers)} unit="phiếu" emptyText="Chưa có phiếu nào trong kỳ" />
      </ChartCard>
    </div>

    <div className="grid gap-4 xl:grid-cols-3">
      <ChartCard className="xl:col-span-2" title="Biến động tài sản 12 tháng"><TrendChart months={school.months} /></ChartCard>
      <PendingList items={taskItems} title="Cần xử lý" />
    </div>

    {school.inventory ? <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div><p className="font-medium">{school.inventory.campaignName}</p><p className="text-muted-foreground mt-1 text-sm">{school.inventory.submitted ? "Trường đã nộp kết quả kiểm kê" : "Trường chưa nộp kết quả kiểm kê"}{school.inventory.dueDate ? ` · Hạn nộp ${school.inventory.dueDate}` : ""}</p></div>
      <Badge variant={school.inventory.submitted ? "success" : "warning"}>{school.inventory.submitted ? "Đã nộp" : "Chưa nộp"}</Badge>
    </Card> : null}
  </div>;
}

function CityDashboard({ data }: { data: DashboardData }) {
  const city = data.city;
  if (!city) return null;
  const devices = city.devices;
  const affected = devices.broken + devices.missing;
  return <div className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryCard to="/schools" label="Trường trong phạm vi" value={number.format(city.minimumStandard.schoolCount)} unit="trường" icon={School} />
      <SummaryCard to="/equipment" label="Tài sản trên sổ" value={number.format(devices.total)} unit="tài sản" icon={Boxes} />
      <SummaryCard to="/catalogs/equipment-standards" label="Đáp ứng tối thiểu" value={`${Math.round(city.minimumStandard.rate)}%`} icon={Gauge}
        tone={city.minimumStandard.rate < 80 ? "warning" : "success"}
        meter={{ value: city.minimumStandard.rate, label: `${number.format(city.minimumStandard.schoolsMeeting)} / ${number.format(city.minimumStandard.schoolCount)} trường đạt` }} />
      <SummaryCard to="/equipment" label="Hỏng, báo mất" value={number.format(affected)} unit="tài sản" icon={PackageX}
        tone={affected ? "destructive" : "success"} />
    </div>

    <div className="grid gap-4 xl:grid-cols-3">
      <ChartCard className="xl:col-span-2" title={<span className="flex items-center gap-2"><AlertTriangle className="text-warning-text size-4" />Trường cần chú ý</span>}>
        {city.schoolsNeedingAttention.length === 0 ? <p className="text-muted-foreground py-8 text-center text-sm">Không có trường nào có thiết bị hỏng, mất hoặc cần bổ sung hồ sơ.</p> : <Table>
          <TableHeader><TableRow><TableHead>Trường</TableHead><TableHead className="text-right">Tài sản</TableHead><TableHead className="text-right">Hỏng</TableHead><TableHead className="text-right">Mất</TableHead><TableHead className="text-right">Phiếu chờ duyệt</TableHead></TableRow></TableHeader>
          <TableBody>{city.schoolsNeedingAttention.map((school) => <TableRow key={school.id}>
            <TableCell className="font-medium">{school.name}<p className="text-muted-foreground mt-0.5 text-xs">{school.reason}</p></TableCell>
            <TableCell className="text-right tabular-nums">{number.format(school.equipment)}</TableCell>
            <TableCell className="text-right tabular-nums">{number.format(school.broken)}</TableCell>
            <TableCell className="text-right tabular-nums">{number.format(school.missing)}</TableCell>
            <TableCell className="text-right tabular-nums">{school.pending ? <Badge variant="warning">{number.format(school.pending)}</Badge> : "0"}</TableCell>
          </TableRow>)}</TableBody>
        </Table>}
      </ChartCard>
      <PendingList items={city.pendingByType} title="Phiếu đang chờ Sở duyệt" />
    </div>

    <div className="grid gap-4 xl:grid-cols-2">
      <ChartCard title="Tài sản toàn địa bàn theo trạng thái"><DonutBreakdown items={assetSlices(city.statuses)} unit="tài sản" spread /></ChartCard>
      <ChartCard title="Biến động tài sản 12 tháng"><TrendChart months={city.months} /></ChartCard>
    </div>
    {city.inventory || city.procurementPlan ? <div className="grid gap-4 md:grid-cols-2">
      {city.inventory ? <Card className="flex items-center justify-between gap-4 p-4"><div><p className="font-medium">{city.inventory.campaignName}</p><p className="text-muted-foreground mt-1 text-sm">Tiến độ kiểm kê · Hạn nộp {city.inventory.dueDate}</p></div><Badge variant="warning">{number.format(city.inventory.submittedSchools)} / {number.format(city.inventory.schoolCount)} trường</Badge></Card> : null}
      {city.procurementPlan ? <Card className="flex items-center justify-between gap-4 p-4"><div><p className="font-medium">Kế hoạch mua sắm {city.procurementPlan.year}</p><p className="text-muted-foreground mt-1 text-sm">{city.procurementPlan.status}</p></div><strong className="text-lg tabular-nums">{currency.format(city.procurementPlan.plannedValue)}</strong></Card> : null}
    </div> : null}
  </div>;
}

export function Dashboard() {
  const [schoolYearId, setSchoolYearId] = useState<string>();
  const [period, setPeriod] = useState("month");
  const query = useQuery({
    queryKey: ["dashboard", schoolYearId ?? "current", period],
    queryFn: async () => kyInstance.get("reports/dashboard", { searchParams: {
      ...(schoolYearId ? { schoolYearId } : {}), period,
    } }).json<DashboardData>(),
    staleTime: 60_000,
    retry: 1,
  });

  if (query.isLoading) return <LoadingDashboard />;
  if (query.isError || !query.data) return <DashboardError onRetry={() => void query.refetch()} />;
  const data = query.data;
  const selectedYear = schoolYearId ?? (data.selectedSchoolYearId == null ? undefined : String(data.selectedSchoolYearId));
  const isSchool = data.scope === "SCHOOL";

  return <main className="space-y-4 pb-6">
    <DashboardHeader scope={data.scope} schoolName={data.schoolName} years={data.schoolYears} selectedYear={selectedYear} onYearChange={setSchoolYearId} />
    {isSchool ? <SchoolDashboard data={data} period={period} setPeriod={setPeriod} /> : <CityDashboard data={data} />}
    {query.isFetching ? <p className="text-muted-foreground text-right text-xs">Đang cập nhật số liệu…</p> : null}
  </main>;
}
