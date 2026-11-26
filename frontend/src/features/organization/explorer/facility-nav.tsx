import { useQuery } from "@tanstack/react-query";
import { Backpack, BookOpen, Briefcase, GraduationCap, CircleHelp, Download, Dumbbell, Hotel, LayoutGrid, Library, MapPin, Shapes, SquareStack, Utensils, Warehouse, type LucideIcon } from "lucide-react";
import { useRef, useState } from "react";

import { kyInstance } from "@/shared/api/data";
import { errorMessage } from "@/shared/lib/api-error";
import { SLIDE_TRANSITION, trackedStyle, useTrackedBox } from "@/shared/hooks/use-tracked-box";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { useFacilityInfo } from "@/features/organization/explorer/facility-info";
import { LoadingText } from "@/shared/components/spinner";
import { LIFT_ROW } from "@/shared/lib/row-lift";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

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
export function FacilityNav({ schoolId, value, onChange, counts, showStudents }: {
  schoolId: number;
  value: string;
  onChange: (v: string) => void;
  counts?: { rooms?: number | null; buildings?: number | null; campuses?: number | null; classes?: number | null; students?: number | null };
  /** Có mục Học sinh — chỉ tài khoản được xem danh sách học sinh (vai loại trường). */
  showStudents?: boolean;
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
      // Học sinh cạnh Lớp học: lớp có danh sách học sinh thì sĩ số tự đếm từ đó.
      items: [
        { value: "classes", label: "Lớp học", icon: GraduationCap, tone: "text-chart-3", count: counts?.classes },
        ...(showStudents
          ? [{ value: "students", label: "Học sinh", icon: Backpack, tone: "text-chart-4", count: counts?.students }]
          : []),
      ],
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

/** Một dòng của biểu theo từng phòng (`GET reports/csvc-statistics/rooms`). */
type RoomRow = {
  kind: "group" | "item" | "room";
  stt?: string;
  text: string;
  unit?: string | null;
  count?: number;
  area?: number | null;
  code?: string;
  type?: string;
  structure?: string | null;
  building?: string | null;
  campus?: string | null;
};

const areaFmt = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });

/**
 * Biểu số liệu CSVC của một trường ngay trong tab, THEO TỪNG PHÒNG: cùng khối, cùng dòng loại với mẫu Sở, dưới mỗi loại
 * là từng phòng / khu (mã, kết cấu, diện tích, nhà, cơ sở) — đọc nhanh, đối chiếu được từng phòng. Tải Excel đúng bảng này.
 * Biểu tổng hợp theo mẫu Sở vẫn ở phân hệ Báo cáo.
 */
export function CsvcStatisticsPanel({ schoolId }: { schoolId: number }) {
  const params = { schoolId: String(schoolId) };
  const rooms = useQuery({
    queryKey: ["reports", "csvc-statistics", "rooms", schoolId],
    queryFn: ({ signal }) => kyInstance.get("reports/csvc-statistics/rooms", { signal, searchParams: params }).json<RoomRow[]>(),
  });
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  async function exportXlsx() {
    setBusy(true);
    setProblem(null);
    try {
      const blob = await kyInstance.get("reports/csvc-statistics/rooms/export", { searchParams: params, timeout: 120_000 }).blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Bieu-so-lieu-CSVC-theo-phong.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setProblem(await errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void exportXlsx()}>
          <Download />
          {busy ? "Đang xuất…" : "Tải Excel"}
        </Button>
      </div>
      {problem ? <p role="alert" className="text-destructive-text text-xs">{problem}</p> : null}
      {rooms.isLoading ? <LoadingText className="py-6" /> : rooms.error ? (
        <p className="text-destructive-text py-6 text-sm">Không tải được biểu số liệu.</p>
      ) : (
        // Khung này là chỗ cuộn duy nhất (khung bọc riêng của Table để tràn ra), nên tiêu đề cột `sticky` đứng yên khi cuộn.
        <div className="bg-card min-h-0 flex-1 overflow-auto rounded-lg border [&>[data-slot=table-container]]:overflow-visible">
          <CsvcRoomsTable rows={rooms.data ?? []} />
        </div>
      )}
    </div>
  );
}

/** Bảng theo từng phòng: dòng khối (đậm, nền nhạt), dòng loại (số lượng, tổng diện tích), rồi từng phòng. */
function CsvcRoomsTable({ rows }: { rows: RoomRow[] }) {
  const head = "text-overline text-muted-foreground";
  return (
    <Table>
      <TableHeader className="bg-surface-subtle sticky top-0 z-10">
        <TableRow>
          <TableHead className={cn(head, "w-16")}>STT</TableHead>
          <TableHead className={head}>Hạng mục / phòng</TableHead>
          <TableHead className={cn(head, "w-24")}>Mã</TableHead>
          <TableHead className={cn(head, "w-32")}>Kết cấu</TableHead>
          <TableHead className={cn(head, "w-28 text-right")}>Diện tích (m²)</TableHead>
          <TableHead className={cn(head, "w-40")}>Nhà / khối nhà</TableHead>
          <TableHead className={cn(head, "w-36")}>Cơ sở</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r, i) => r.kind === "group" ? (
          <TableRow key={i} className="bg-primary/[0.04] hover:bg-primary/[0.04]">
            <TableCell className="font-semibold tabular-nums">{r.stt}</TableCell>
            <TableCell className="font-semibold">
              {r.text}
              <span className="text-muted-foreground ms-2 text-xs font-normal">
                {r.count ? `${r.count} hạng mục` : "Chưa có hạng mục nào"}
              </span>
            </TableCell>
            <TableCell colSpan={2} />
            <TableCell className="text-right font-semibold tabular-nums">{r.count ? areaFmt.format(Number(r.area ?? 0)) : null}</TableCell>
            <TableCell colSpan={2} />
          </TableRow>
        ) : r.kind === "item" ? (
          <TableRow key={i} className="hover:bg-transparent">
            <TableCell className="text-muted-foreground tabular-nums">{r.stt}</TableCell>
            <TableCell className="font-medium whitespace-normal">
              {r.text}
              <span className="text-muted-foreground ms-2 text-xs font-normal">{r.count} {r.unit ?? "phòng"}</span>
            </TableCell>
            <TableCell colSpan={2} />
            <TableCell className="text-right font-medium tabular-nums">{areaFmt.format(Number(r.area ?? 0))}</TableCell>
            <TableCell colSpan={2} />
          </TableRow>
        ) : (
          <TableRow key={i} className={cn("group/row", LIFT_ROW)}>
            <TableCell />
            <TableCell className="ps-8 whitespace-normal">{r.text}</TableCell>
            <TableCell className="font-mono text-xs">{r.code}</TableCell>
            <TableCell>{r.structure ?? <span className="text-warning-text text-xs">Chưa khai</span>}</TableCell>
            <TableCell className="text-right tabular-nums">
              {r.area != null ? areaFmt.format(Number(r.area)) : <span className="text-warning-text text-xs">Chưa khai</span>}
            </TableCell>
            <TableCell className="whitespace-normal">{r.building ?? <span className="text-muted-foreground">Không thuộc nhà nào</span>}</TableCell>
            <TableCell className="whitespace-normal">{r.campus ?? "Cơ sở chính"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
