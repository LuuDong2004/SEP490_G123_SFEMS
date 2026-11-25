import { useQuery } from "@tanstack/react-query";
import { BookOpen, Briefcase, GraduationCap, CircleHelp, Download, Dumbbell, Hotel, LayoutGrid, Library, MapPin, Shapes, SquareStack, Utensils, Warehouse, type LucideIcon } from "lucide-react";
import { useRef, useState } from "react";

import { kyInstance } from "@/shared/api/data";
import { CsvcStatisticsNotes, CsvcStatisticsTable } from "@/shared/components/facility/csvc-statistics";
import { errorMessage } from "@/shared/lib/api-error";
import { SLIDE_TRANSITION, trackedStyle, useTrackedBox } from "@/shared/hooks/use-tracked-box";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/shared/ui/select";
import type { Report } from "@/domains/report/types";
import { useFacilityInfo } from "@/features/organization/explorer/facility-info";
import { LoadingText } from "@/shared/components/spinner";

/** Mục của cột trái; `g:<id>` là một khối CSVC, `g:none` là hạng mục chưa phân loại. */
type NavItem = { value: string; label: string; icon: LucideIcon; tone: string; count?: number | null; warn?: boolean };

const num = new Intl.NumberFormat("vi-VN", { useGrouping: false });

/**
 * Biểu tượng và MÀU theo khối CSVC (mã khối của Sở) — nhìn là biết khối nào. Màu lấy từ token của theme (chart-*,
 * success, warning…) nên đổi theme sáng / tối vẫn đúng; component không tự giữ mã màu.
 */
export const GROUP_ICONS: Record<string, { icon: LucideIcon; tone: string }> = {
  "03": { icon: Warehouse, tone: "text-chart-2" }, // phụ trợ: y tế, kho, cổng, để xe, vệ sinh
  "04": { icon: Briefcase, tone: "text-chart-1" }, // hành chính quản trị
  "05": { icon: BookOpen, tone: "text-success-text" }, // phòng học tập
  "06": { icon: Library, tone: "text-chart-3" }, // hỗ trợ học tập: thư viện, thiết bị
  "07": { icon: Dumbbell, tone: "text-chart-5" }, // sân chơi, thể dục thể thao
  "08": { icon: Utensils, tone: "text-warning-text" }, // phục vụ sinh hoạt: bếp, nhà ăn, nội trú
  "09": { icon: Shapes, tone: "text-chart-4" }, // phòng khác
};

/**
 * Cột trái của tab Cơ sở vật chất — bố trí như phần mềm CSDL HCM của Sở: khai báo theo KHỐI, thêm khối nhà / điểm
 * trường. Số đếm cạnh từng mục; khối chưa có hạng mục nào nhạt đi. Màn hẹp thành một ô chọn. Báo cáo, chuẩn ở tab
 * Đánh giá CSVC; số liệu chung ở tab Hồ sơ trường.
 */
export function FacilityNav({ schoolId, value, onChange, counts }: {
  schoolId: number;
  value: string;
  onChange: (v: string) => void;
  counts?: { rooms?: number | null; buildings?: number | null; campuses?: number | null; classes?: number | null };
}) {
  const { data } = useFacilityInfo(schoolId);
  const navRef = useRef<HTMLElement>(null);
  const pill = useTrackedBox(navRef, `[data-nav-item="${value}"]`);
  const groups: NavItem[] = (data?.groups ?? []).map((g) => ({
    value: `g:${g.id ?? "none"}`,
    label: g.name.replace(/^Khối phòng |^Khối /, (m) => (m === "Khối phòng " ? "Phòng " : "")).replace(/^./, (c) => c.toUpperCase()),
    icon: g.id == null ? CircleHelp : GROUP_ICONS[g.code ?? ""]?.icon ?? SquareStack,
    tone: g.id == null ? "text-warning-text" : GROUP_ICONS[g.code ?? ""]?.tone ?? "text-neutral-text",
    count: g.count,
    warn: g.id == null,
  }));
  const sections: { title: string; items: NavItem[] }[] = [
    {
      title: "Khai báo",
      items: [
        { value: "rooms", label: "Tất cả hạng mục", icon: LayoutGrid, tone: "text-primary", count: counts?.rooms },
        ...groups,
      ],
    },
    {
      title: "Công trình",
      items: [
        { value: "buildings", label: "Khối nhà", icon: Hotel, tone: "text-chart-1", count: counts?.buildings },
        { value: "campuses", label: "Điểm trường", icon: MapPin, tone: "text-destructive-text", count: counts?.campuses },
      ],
    },
    {
      // Lớp gắn với phòng học: quản lý lớp (sĩ số, GV chủ nhiệm, phòng) ở đây, không còn tab riêng.
      title: "Sử dụng",
      items: [{ value: "classes", label: "Lớp học", icon: GraduationCap, tone: "text-chart-3", count: counts?.classes }],
    },
  ];
  return (
    <>
      {/* Màn hẹp: một ô chọn thay cho cột trái. */}
      <div className="lg:hidden">
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="w-full"><SelectValue placeholder="Chọn mục" /></SelectTrigger>
          <SelectContent>
            {sections.map((s) => (
              <SelectGroup key={s.title}>
                <SelectLabel>{s.title}</SelectLabel>
                {s.items.map((i) => (
                  <SelectItem key={i.value} value={i.value}>{i.label}{i.count != null ? ` (${num.format(i.count)})` : ""}</SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>
      <nav ref={navRef} aria-label="Cơ sở vật chất" className="relative hidden min-h-0 overflow-y-auto border-r pr-3 lg:block">
        {/* Vệt chọn TRƯỢT giữa các mục, kiểu iOS (trưởng nhóm 13/11/2026) — cùng chuyển động với cột mục của hộp hồ sơ. */}
        {pill.box ? (
          <span aria-hidden className={cn("bg-primary/10 pointer-events-none absolute top-0 left-0 rounded-md", pill.animate && SLIDE_TRANSITION)}
            style={trackedStyle(pill.box)} />
        ) : null}
        {sections.map((s) => (
          <div key={s.title} className="mb-4">
            <p className="text-muted-foreground mb-1 px-2 text-[0.6875rem] font-semibold tracking-wide uppercase">{s.title}</p>
            <ul className="grid grid-cols-[minmax(0,1fr)] gap-0.5">
              {s.items.map((i) => {
                const on = i.value === value;
                return (
                  <li key={i.value}>
                    <button type="button" onClick={() => onChange(i.value)} aria-current={on ? "page" : undefined} data-nav-item={i.value}
                      className={cn("relative z-[1] flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors duration-300",
                        on ? "text-primary font-medium" : "hover:bg-foreground/[0.04] text-foreground",
                        i.count === 0 && !on && "text-muted-foreground")}>
                      {/* Mỗi khối một màu; khối chưa có hạng mục nào thì icon nhạt đi cùng chữ. */}
                      <i.icon className={cn("size-4 shrink-0", i.tone, i.count === 0 && !on && "opacity-45")} />
                      <span className="min-w-0 flex-1 truncate" title={i.label}>{i.label}</span>
                      {i.count != null ? (
                        <span className={cn("rounded-full px-1.5 text-[0.6875rem] tabular-nums",
                          i.warn ? "bg-warning-subtle text-warning-text" : "bg-foreground/[0.06] text-muted-foreground")}>
                          {num.format(i.count)}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </>
  );
}

/** Tên của một mục (tiêu đề trên bảng bên phải). */
export function useFacilitySectionTitle(schoolId: number, value: string): string | null {
  const { data } = useFacilityInfo(schoolId);
  if (!value.startsWith("g:")) return null;
  const id = value.slice(2);
  return (data?.groups ?? []).find((g) => String(g.id ?? "none") === id)?.name ?? null;
}

/**
 * Biểu số liệu CSVC của một trường ngay trong tab: cùng bảng với Báo cáo → Biểu số liệu CSVC, cùng tệp
 * Excel mẫu Sở. Trường lập biểu không phải sang phân hệ Báo cáo.
 */
export function CsvcStatisticsPanel({ schoolId }: { schoolId: number }) {
  const params = { schoolId: String(schoolId) };
  const { data, isLoading, error } = useQuery({
    queryKey: ["reports", "csvc-statistics", schoolId],
    queryFn: ({ signal }) => kyInstance.get("reports/csvc-statistics", { signal,  searchParams: params }).json<Report>(),
  });
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  async function exportXlsx() {
    setBusy(true);
    setProblem(null);
    try {
      const blob = await kyInstance.get("reports/csvc-statistics/export", { searchParams: params, timeout: 120_000 }).blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Bieu-so-lieu-CSVC.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setProblem(await errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  if (isLoading) return <LoadingText className="py-6" />;
  if (error || !data) return <p className="text-destructive-text py-6 text-sm">Không tải được biểu số liệu.</p>;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void exportXlsx()}>
          <Download />
          {busy ? "Đang xuất…" : "Tải Excel"}
        </Button>
      </div>
      {problem ? <p role="alert" className="text-destructive-text text-xs">{problem}</p> : null}
      {/* Cao theo khung chứa (hộp thoại), chỉ thân bảng cuộn — tiêu đề ba tầng đứng yên, không bị cắt. */}
      <div className="bg-card flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
        <div className="min-h-0 flex-1 overflow-auto">
          <CsvcStatisticsTable report={data} />
        </div>
        <CsvcStatisticsNotes report={data} />
      </div>
    </div>
  );
}
