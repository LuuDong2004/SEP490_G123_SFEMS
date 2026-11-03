import { useQuery } from "@tanstack/react-query";
import { useGetIdentity } from "@refinedev/core";
import { AlertCircle, Boxes, CalendarDays, CheckCircle2, ClipboardCheck, FileClock, RefreshCw, School, Wallet } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Skeleton } from "@/shared/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { kyInstance } from "@/shared/api/data";

type SchoolYear = { id: number; label: string };

type DashboardSummary = {
  total: number;
  inUse?: number;
  inStorage?: number;
  broken?: number;
  missing?: number;
  disposed?: number;
};

type DashboardData = {
  scope: "CITY" | "BODY" | "SCHOOL" | "NONE";
  schoolName?: string;
  schoolYears: SchoolYear[];
  selectedSchoolYearId: number | null;
  city?: {
    devices: DashboardSummary & { originalValue: number };
    minimumStandard: { schoolsMeeting: number; schoolCount: number; rate: number };
    proposalsAwaitingDepartmentApproval: number;
    procurementPlan: { year: number; status: string; plannedValue: number } | null;
    inventory: { campaignName: string; submittedSchools: number; schoolCount: number; dueDate: string | null } | null;
    schoolsNeedingAttention: { id: number; name: string; reason: string }[];
  };
  school?: {
    devices: DashboardSummary;
    minimumStandard: { met: number; required: number; rate: number };
    pendingVouchers: number;
    inventory: { campaignName: string; dueDate: string | null; submitted: boolean } | null;
  };
};

const number = new Intl.NumberFormat("vi-VN");
const currency = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const percent = (value: number) => `${Math.max(0, Math.min(100, value))}%`;

function Metric({
  title,
  value,
  detail,
  icon: Icon,
}: {
  title: string;
  value: string;
  detail?: string;
  icon: typeof Boxes;
}) {
  return (
    <Card className="gap-3 py-5">
      <CardHeader className="flex grid-cols-[1fr_auto] items-start gap-3 px-5">
        <CardDescription>{title}</CardDescription>
        <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg"><Icon className="size-4" /></span>
      </CardHeader>
      <CardContent className="px-5">
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        {detail ? <p className="text-muted-foreground mt-1 text-xs">{detail}</p> : null}
      </CardContent>
    </Card>
  );
}

function ProgressMetric({ title, detail, rate }: { title: string; detail: string; rate: number }) {
  const bounded = Math.max(0, Math.min(100, rate));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
        <CardDescription>{detail}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-2xl font-semibold tabular-nums">{percent(bounded)}</span>
          <span className="text-muted-foreground text-xs">Mức đáp ứng</span>
        </div>
        <div className="bg-muted h-2 overflow-hidden rounded-full" role="progressbar" aria-label={title} aria-valuemin={0} aria-valuemax={100} aria-valuenow={bounded}>
          <div className="bg-primary h-full rounded-full transition-[width]" style={{ width: percent(bounded) }} />
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingDashboard() {
  return (
    <div className="space-y-6" aria-label="Đang tải bảng điều khiển">
      <div className="flex items-center justify-between gap-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-9 w-40" /></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-32 rounded-lg" />)}</div>
      <div className="grid gap-4 xl:grid-cols-2"><Skeleton className="h-72 rounded-lg" /><Skeleton className="h-72 rounded-lg" /></div>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-80 flex-col items-center justify-center gap-3 text-center">
      <span className="bg-destructive/10 text-destructive flex size-11 items-center justify-center rounded-full"><AlertCircle className="size-5" /></span>
      <div><h2 className="font-semibold">Chưa tải được bảng điều khiển</h2><p className="text-muted-foreground mt-1 text-sm">Hãy thử tải lại sau ít phút.</p></div>
      <Button variant="outline" onClick={onRetry}><RefreshCw />Tải lại</Button>
    </div>
  );
}

function EmptyCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function SchoolDashboard({ data }: { data: DashboardData }) {
  const school = data.school;
  if (!school) return <EmptyCard title="Bảng điều khiển trường"><p className="text-muted-foreground text-sm">Dữ liệu thiết bị, định mức, phiếu chờ xử lý và kiểm kê chưa được tích hợp vào bản đồ án.</p></EmptyCard>;

  const statuses = [
    ["Đang sử dụng", school.devices.inUse],
    ["Trong kho", school.devices.inStorage],
    ["Hỏng", school.devices.broken],
    ["Mất", school.devices.missing],
  ] as const;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="Tổng số thiết bị" value={number.format(school.devices.total)} detail={`${number.format(school.devices.broken ?? 0)} thiết bị hỏng`} icon={Boxes} />
        <Metric title="Phiếu chờ xử lý" value={number.format(school.pendingVouchers)} detail="Theo phạm vi được giao" icon={ClipboardCheck} />
        <ProgressMetric title="Đáp ứng danh mục tối thiểu" detail={`${number.format(school.minimumStandard.met)} / ${number.format(school.minimumStandard.required)} tiêu chí`} rate={school.minimumStandard.rate} />
        <Metric title="Đợt kiểm kê đang mở" value={school.inventory ? "Đang thực hiện" : "Không có"} detail={school.inventory?.dueDate ? `Hạn nộp ${school.inventory.dueDate}` : school.inventory?.campaignName} icon={CalendarDays} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Thiết bị theo trạng thái</CardTitle><CardDescription>Tổng cộng {number.format(school.devices.total)} thiết bị</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            {statuses.map(([label, value]) => {
              const count = value ?? 0;
              const width = school.devices.total ? (count / school.devices.total) * 100 : 0;
              return <div key={label} className="space-y-1.5"><div className="flex justify-between text-sm"><span>{label}</span><span className="font-medium tabular-nums">{number.format(count)}</span></div><div className="bg-muted h-2 overflow-hidden rounded-full"><div className="bg-primary/75 h-full rounded-full" style={{ width: percent(width) }} /></div></div>;
            })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Kiểm kê</CardTitle><CardDescription>Đợt kiểm kê hiện tại của trường</CardDescription></CardHeader>
          <CardContent>
            {school.inventory ? (
              <div className="flex items-start gap-3"><span className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg"><FileClock className="size-5" /></span><div><p className="font-medium">{school.inventory.campaignName}</p><p className="text-muted-foreground mt-1 text-sm">{school.inventory.submitted ? "Trường đã nộp kết quả kiểm kê" : "Trường chưa nộp kết quả kiểm kê"}</p>{school.inventory.dueDate ? <p className="mt-2 text-sm">Hạn nộp: <strong>{school.inventory.dueDate}</strong></p> : null}</div></div>
            ) : <p className="text-muted-foreground text-sm">Hiện không có đợt kiểm kê đang mở.</p>}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function CityDashboard({ data }: { data: DashboardData }) {
  const city = data.city;
  if (!city) return <EmptyCard title="Bảng điều khiển tổng hợp"><p className="text-muted-foreground text-sm">Dữ liệu thiết bị, định mức, mua sắm và kiểm kê chưa được tích hợp vào bản đồ án.</p></EmptyCard>;
  const rate = city.minimumStandard.rate;
  const inventoryProgress = city.inventory ? `${number.format(city.inventory.submittedSchools)} / ${number.format(city.inventory.schoolCount)} trường` : "Không có đợt đang mở";

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Metric title="Tổng số thiết bị" value={number.format(city.devices.total)} detail={`Nguyên giá ${currency.format(city.devices.originalValue)}`} icon={Boxes} />
        <ProgressMetric title="Trường đạt định mức tối thiểu" detail={`${number.format(city.minimumStandard.schoolsMeeting)} / ${number.format(city.minimumStandard.schoolCount)} trường`} rate={rate} />
        <Metric title="Đề xuất chờ Sở duyệt" value={number.format(city.proposalsAwaitingDepartmentApproval)} icon={ClipboardCheck} />
        <Metric title="Kế hoạch mua sắm năm hiện tại" value={city.procurementPlan ? currency.format(city.procurementPlan.plannedValue) : "Chưa lập"} detail={city.procurementPlan?.status} icon={Wallet} />
        <Metric title="Tiến độ kiểm kê" value={inventoryProgress} detail={city.inventory?.dueDate ? `Hạn nộp ${city.inventory.dueDate}` : city.inventory?.campaignName} icon={CalendarDays} />
        <Metric title="Trường cần chú ý" value={number.format(city.schoolsNeedingAttention.length)} detail="Theo tình trạng dữ liệu hiện có" icon={School} />
      </div>

      <Card>
        <CardHeader><CardTitle>Trường cần chú ý</CardTitle><CardDescription>Các trường cần theo dõi trong phạm vi năm học đã chọn</CardDescription></CardHeader>
        <CardContent>
          {city.schoolsNeedingAttention.length ? (
            <Table>
              <TableHeader><TableRow><TableHead>Trường</TableHead><TableHead>Thông tin cần chú ý</TableHead></TableRow></TableHeader>
              <TableBody>{city.schoolsNeedingAttention.map((school) => <TableRow key={school.id}><TableCell className="font-medium">{school.name}</TableCell><TableCell>{school.reason}</TableCell></TableRow>)}</TableBody>
            </Table>
          ) : <p className="text-muted-foreground flex items-center gap-2 py-2 text-sm"><CheckCircle2 className="text-success size-4" />Không có trường cần chú ý.</p>}
        </CardContent>
      </Card>
    </>
  );
}

export function Dashboard() {
  const { data: identity } = useGetIdentity<{ fullName?: string }>();
  const [schoolYearId, setSchoolYearId] = useState<string>();
  const query = useQuery({
    queryKey: ["dashboard", schoolYearId ?? "current"],
    queryFn: async () => kyInstance.get("reports/dashboard", { searchParams: schoolYearId ? { schoolYearId } : {} }).json<DashboardData>(),
    staleTime: 60_000,
    retry: 1,
  });

  if (query.isLoading) return <LoadingDashboard />;
  if (query.isError || !query.data) return <ErrorState onRetry={() => void query.refetch()} />;

  const data = query.data;
  const currentYearId = data.selectedSchoolYearId == null ? undefined : String(data.selectedSchoolYearId);
  const selectedYear = schoolYearId ?? currentYearId;
  const isSchool = data.scope === "SCHOOL";
  const scopeLabel = isSchool ? data.schoolName ?? "Trường học"
    : data.scope === "BODY" ? "Cơ quan quản lý"
      : data.scope === "NONE" ? "Chưa xác định phạm vi" : "Toàn Thành phố";

  return (
    <main className="space-y-5 pb-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-muted-foreground text-sm">{scopeLabel}</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Bảng điều khiển</h1><p className="text-muted-foreground mt-1 text-sm">Xin chào{identity?.fullName ? `, ${identity.fullName}` : ""}. Đây là tình hình tổng hợp theo năm học.</p></div>
        <div className="flex items-center gap-2"><CalendarDays className="text-muted-foreground size-4" /><Select value={selectedYear} onValueChange={setSchoolYearId}><SelectTrigger aria-label="Chọn năm học" className="w-44"><SelectValue placeholder="Năm học hiện tại" /></SelectTrigger><SelectContent>{data.schoolYears.map((year) => <SelectItem key={year.id} value={String(year.id)}>{year.label}</SelectItem>)}</SelectContent></Select></div>
      </div>
      {isSchool ? <SchoolDashboard data={data} /> : <CityDashboard data={data} />}
      {query.isFetching ? <p className="text-muted-foreground text-right text-xs">Đang cập nhật số liệu…</p> : null}
    </main>
  );
}
