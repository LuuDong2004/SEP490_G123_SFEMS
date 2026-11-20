import { usePersistentState } from "@/shared/hooks/use-persistent-state";
import { useNotification } from "@refinedev/core";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CircleAlert, CircleCheck, CircleHelp, DoorOpen, Eye, EyeOff, FileSpreadsheet, FileText, GraduationCap, ListChecks, Loader2, PackagePlus, Printer, Settings, Users } from "lucide-react";
import { useCallback, useState, type ReactNode } from "react";
import { PrintSheet, type PrintSheetProps } from "@/shared/components/print/print-sheet";
import { AdequacyReportDialog, reportTitle } from "./adequacy-report";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu";
import { Link } from "react-router";

import { kyInstance, DOWNLOAD_TIMEOUT } from "@/shared/api/data";
import { StatTile } from "@/shared/components/charts/charts";
import { HelpHint } from "@/shared/components/form/help-hint";
import { usePerspective } from "@/shared/hooks/use-perspective";
import { errorMessage } from "@/shared/lib/api-error";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import type { SchoolAdequacy, StandardInputs } from "@/domains/procurement/types";

import { AdequacyTable, type AdequacyView } from "../purchase-proposals/adequacy-table";
import { GapActions, QuickAssignRooms, QuickAssignTeachers } from "./gap-actions";
import { QuickAddClasses } from "../resources/class-extra";
import { WithUnit } from "@/shared/components/charts/with-unit";
import { QueryError } from "@/shared/components/query-error";
import { CampusFilterButton } from "@/shared/components/campus/campus";


const num = new Intl.NumberFormat("vi-VN");

/** Gộp danh sách tên thành một câu ngắn: "Toán, Ngữ văn, Tiếng Anh và 9 môn khác". */
function names(items: string[], unit: string, max = 3): string {
  if (items.length <= max) return items.join(", ");
  return `${items.slice(0, max).join(", ")} và ${items.length - max} ${unit} khác`;
}

type SourceInfo = {
  key: string;
  icon: ReactNode;
  label: string;
  value: string;
  /** Còn thiếu gì, mỗi mục một câu ngắn — rỗng là đủ. */
  gaps: string[];
  /** Nút khai nhanh hiện khi còn gap — hộp thoại tại chỗ hoặc nhãn sang màn khai. */
  action: ReactNode;
};

/**
 * Ba nguồn dữ liệu mà chuẩn của trường được tính từ đó — lớp và sĩ số, giáo viên theo môn, phòng bộ môn.
 * `own` = người xem là người của chính trường đó: chỉ họ khai được lớp, giáo viên, phòng. Sở / UBND đang
 * xem chuẩn của một trường thì chỉ thấy còn thiếu gì, không có nút khai.
 */
function sourcesOf(schoolId: number, inputs: StandardInputs, own: boolean): SourceInfo[] {
  const classes = inputs.grades.reduce((s, g) => s + g.classes, 0);
  const students = inputs.grades.reduce((s, g) => s + g.students, 0);
  const missingStudents = inputs.grades.reduce((s, g) => s + g.missingStudents, 0);
  const noTeacher = inputs.subjects.filter((s) => s.perTeacher > 0 && s.teachers === 0);
  const needRooms = inputs.subjects.filter((s) => s.perRoom > 0);
  const noRoom = needRooms.filter((s) => s.rooms === 0);

  return [
    {
      key: "classes",
      icon: <GraduationCap />,
      label: "Lớp học",
      value: inputs.classesDeclared ? `${classes} lớp · ${num.format(students)} học sinh` : "chưa khai",
      gaps: [
        ...(inputs.classesDeclared ? [] : ["Chưa khai lớp của năm học này"]),
        ...(inputs.classesDeclared && inputs.grades.some((g) => g.classes === 0)
          ? [`Khối ${names(inputs.grades.filter((g) => g.classes === 0).map((g) => String(g.grade)), "khối")} chưa có lớp`] : []),
        ...(missingStudents ? [`${missingStudents} lớp chưa nhập sĩ số`] : []),
      ],
      action: own && (
        <GapActions>
          <QuickAddClasses schoolId={schoolId} label="Thêm lớp" linkStyle />
          {missingStudents ? (
            <Link to="/school-classes" className="text-primary text-xs font-medium hover:underline">Nhập sĩ số →</Link>
          ) : null}
        </GapActions>
      ),
    },
    {
      key: "teachers",
      icon: <Users />,
      label: "Giáo viên",
      value: `${inputs.teachers} người · ${inputs.subjects.filter((s) => s.teachers > 0).length}/${inputs.subjects.length} môn`,
      gaps: noTeacher.length
        ? [`${noTeacher.length} môn chưa có giáo viên: ${names(noTeacher.map((s) => s.subjectName), "môn")}`] : [],
      action: own && (
        <GapActions>
          <QuickAssignTeachers schoolId={schoolId} missing={noTeacher} />
        </GapActions>
      ),
    },
    {
      key: "rooms",
      icon: <DoorOpen />,
      label: "Phòng bộ môn",
      value: needRooms.length ? `${needRooms.reduce((n, s) => n + s.rooms, 0)} phòng · ${needRooms.length - noRoom.length}/${needRooms.length} môn` : "không cần",
      gaps: noRoom.length
        ? [`${noRoom.length} môn chưa có phòng bộ môn: ${names(noRoom.map((s) => s.subjectName), "môn")}`] : [],
      action: own && (
        <GapActions>
          <QuickAssignRooms schoolId={schoolId} missing={noRoom} />
        </GapActions>
      ),
    },
  ];
}

/**
 * "Con số này tính từ đâu" — dấu "?" cạnh nhãn "Phải có". Dữ liệu nền đã đủ thì chỉ cần đọc một lần,
 * nên không chiếm một hàng của thẻ; chỗ còn THIẾU là trạng thái, vẫn hiện thẳng ở {@link SourceGaps}.
 */
function SourcesHint({ sources }: { sources: SourceInfo[] }) {
  return (
    <HelpHint label="Số phải có tính từ đâu">
      <span className="block font-medium">Tính từ dữ liệu của trường:</span>
      {sources.map((s) => (
        <span key={s.key} className="block tabular-nums">
          {s.label}: {s.value}
          {s.gaps.length ? " (còn thiếu)" : ""}
        </span>
      ))}
    </HelpHint>
  );
}

/**
 * Hàng chân của thẻ kết quả, CHỈ khi còn thiếu dữ liệu: mỗi loại một dòng — thiếu gì (một câu, danh sách dài thì
 * gộp "và N môn khác", rê chuột xem đủ) và nút khai ngay bên phải.
 */
function SourceGaps({ sources, noEquipment }: { sources: SourceInfo[]; noEquipment?: ReactNode }) {
  const lacking = sources.filter((s) => s.gaps.length > 0);
  if (lacking.length === 0 && !noEquipment) return null;
  const row = (key: string, icon: ReactNode, label: string, text: ReactNode, title: string | undefined, action: ReactNode) => (
    <li key={key} className="flex min-w-0 items-center gap-3 px-5 py-2">
      <span className="text-warning-text flex w-28 shrink-0 items-center gap-2 font-medium [&_svg]:size-4">
        {icon}
        {label}
      </span>
      {/* Nút khai đứng ngay sau chữ — đẩy ra mép phải là để trống cả khoảng giữa. */}
      <span className="text-muted-foreground min-w-0 truncate" title={title}>{text}</span>
      {action ? <span className="shrink-0">{action}</span> : null}
    </li>
  );
  return (
    <ul className="divide-y border-t text-sm">
      {noEquipment ? row("equipment", <PackagePlus />, "Thiết bị", "Chưa nhập thiết bị nào nên tất cả đang tính là thiếu", undefined, noEquipment) : null}
      {lacking.map((s) => row(s.key, s.icon, s.label, s.gaps.join(" · "), s.gaps.join("\n"), s.action))}
    </ul>
  );
}

/**
 * Thiết bị dạy học tối thiểu của MỘT trường, đọc từ trên xuống: dải chỉ số (đủ / thiếu / thừa; dấu "?"
 * cạnh "Phải có" nói con số tính từ dữ liệu gì), dữ liệu nền còn thiếu gì nếu có, rồi danh sách từng
 * thiết bị theo môn. Trường thấy màn này cho mình; cơ quan quản lý mở nó từ bảng tổng hợp
 * ({@code onBack}).
 */
export function SchoolStandard({ schoolId, onBack }: {
  schoolId?: number | null;
  onBack?: () => void;
}) {
  const { open: notify } = useNotification();
  const { perspective } = usePerspective();
  const [exporting, setExporting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  // Ẩn dải năm ô số cho bảng rộng chỗ hơn; nhớ theo máy.
  const [hideStats, setHideStats] = usePersistentState<boolean>("adequacy.hideStats", false, "local");
  // Các dòng bảng đang hiện — bản in theo đúng bộ lọc đang chọn (Còn thiếu = UC51, Thừa = UC52).
  const [view, setView] = useState<AdequacyView>();
  // Bộ lọc riêng trong hộp "Xem báo cáo" — In từ hộp in theo nó; đổi lọc ngoài màn hay In từ màn thì bỏ.
  const [reportView, setReportView] = useState<AdequacyView>();
  const showView = useCallback((v: AdequacyView) => {
    setView(v);
    setReportView(undefined);
  }, []);
  // Cơ sở (trường nhiều cơ sở, tài khoản cả trường / Sở): định mức tính trên lớp, giáo viên, phòng, thiết bị của cơ sở.
  const [campusId, setCampusId] = useState<number | null>(null);
  const params = {
    ...(schoolId ? { schoolId: String(schoolId) } : {}),
    ...(campusId != null ? { campusId: String(campusId) } : {}),
  };
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["purchase_proposals", "adequacy", schoolId ?? "own", campusId],
    queryFn: ({ signal }) => kyInstance.get("purchase_proposals/adequacy", { signal,  searchParams: params }).json<SchoolAdequacy>(),
  });
  const d = data && "rows" in data ? data : undefined;

  const exportXlsx = async () => {
    setExporting(true);
    try {
      const blob = await kyInstance.get("purchase_proposals/adequacy.xlsx", { searchParams: params, timeout: DOWNLOAD_TIMEOUT }).blob();
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement("a"), { href: url, download: `Báo cáo thiết bị tối thiểu - ${d?.schoolName ?? "trường"} - ${fileDate()}.xlsx` });
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      notify?.({ type: "error", message: await errorMessage(error), description: "Không xuất được Excel" });
    } finally {
      setExporting(false);
    }
  };

  if (isError && !d) return <QueryError error={error} onRetry={() => void refetch()} retrying={isFetching} />;
  if (isLoading || !d) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }
  const own = perspective === "school";
  const sources = sourcesOf(d.schoolId, d.inputs, own);

  // Cấp học chưa có danh mục tối thiểu: nói thẳng thay vì
  // vẽ "0 / 0 thiết bị", trông như một trường đã đủ hoặc chưa khai gì.
  if (d.norms === 0 && d.rows.length === 0) {
    return (
      <Card className="gap-2 px-5 py-6">
        <div className="flex items-center gap-2">
          {onBack ? (
            <Button type="button" variant="ghost" size="icon-sm" onClick={onBack} aria-label="Về bảng tổng hợp">
              <ArrowLeft />
            </Button>
          ) : null}
          <h3 className="text-base font-semibold">Chưa có danh mục thiết bị tối thiểu cho cấp {d.level ?? "học này"}</h3>
        </div>
        <p className="text-muted-foreground text-sm">
          {d.schoolName} chưa có chuẩn để so đủ hay thiếu. Thiết bị của trường vẫn ghi tăng, kiểm kê bình thường.
        </p>
      </Card>
    );
  }

  // Một tờ báo cáo cho cả ba đường: Xem báo cáo (hộp trên màn hình), In, và theo đúng các dòng đang lọc
  // (Còn thiếu = UC51, Thừa = UC52).
  const printed = reportView ?? view;
  const sheet: PrintSheetProps | undefined = printed ? {
    unit: d.schoolName,
    title: reportTitle(printed.status),
    subtitle: `${d.level ? `Cấp ${d.level} · ` : ""}Lọc: ${printed.filterLabel} · ${printed.rows.length} loại thiết bị`,
    table: {
      headers: ["STT", "Mã DM thiết bị", "Thiết bị", "Môn", "Phải có", "Đang có", "Thiếu", "Thừa"],
      alignRight: [0, 4, 5, 6, 7],
      rows: printed.rows.map((r, i) => [
        String(i + 1), r.catalogCode ?? r.normCode, r.normName, r.subjectName ?? "—",
        r.required == null || r.optional ? "—" : num.format(r.required), num.format(r.current),
        r.shortage == null ? "—" : num.format(r.shortage), r.surplus == null ? "—" : num.format(r.surplus),
      ]),
    },
    signers: ["Người lập biểu", "Thủ trưởng đơn vị"],
  } : undefined;
  const excelButton = (
    <Button type="button" variant="outline" disabled={exporting} onClick={() => void exportXlsx()}>
      {exporting ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
      Xuất báo cáo
    </Button>
  );

  return (
    <>
    {sheet ? <PrintSheet {...sheet} /> : null}
    {view ? (
      <AdequacyReportDialog open={previewing} onOpenChange={setPreviewing} rows={d.rows} initial={view}
        counts={d} onViewChange={setReportView} actions={excelButton} />
    ) : null}
    <div className="space-y-4 print:hidden">
      {/* MỘT thẻ, đọc như dải chỉ số của trang tổng quan: năm ô số; hàng chân chỉ có khi dữ liệu nền
          còn thiếu. */}
      {hideStats && !onBack ? null : (
      <Card className="gap-0 overflow-hidden py-0">
        {onBack ? (
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Button type="button" variant="ghost" size="icon-sm" onClick={onBack} aria-label="Về bảng tổng hợp">
              <ArrowLeft />
            </Button>
            <span className="text-sm font-semibold">{d.schoolName}</span>
          </div>
        ) : null}
        {hideStats ? null : (<>
        <div className="grid divide-y sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-5 lg:divide-x">
          <StatTile flat icon={<ListChecks />} label={<>Phải có <SourcesHint sources={sources} /></>} value={<WithUnit value={num.format(d.norms)} unit="loại thiết bị" />} />
          <StatTile flat tone="success" icon={<CircleCheck />} label="Đã đủ" value={<WithUnit value={num.format(d.met)} unit="loại thiết bị" />} />
          <StatTile flat tone="destructive" icon={<CircleAlert />} label="Còn thiếu" value={<WithUnit value={num.format(d.shortItems)} unit="loại thiết bị" />} />
          <StatTile flat tone="warning" icon={<PackagePlus />} label="Thừa" value={<WithUnit value={num.format(d.surplusItems)} unit="loại thiết bị" />} />
          <StatTile flat tone="warning" icon={<CircleHelp />} label="Chưa tính được" value={<WithUnit value={num.format(d.unknown)} unit="loại thiết bị" />} />
        </div>
        <SourceGaps sources={sources} noEquipment={d.hasEquipment ? undefined : own
          ? <Link to="/equipment-intakes/create" className="text-primary text-xs font-medium hover:underline">Ghi tăng →</Link>
          : true} />
        </>)}
      </Card>
      )}

      <AdequacyTable
        aside
        data={d}
        onView={showView}
        actions={
          <>
            <CampusFilterButton schoolId={schoolId} value={campusId} onChange={setCampusId} />
            {/* Xem ngay trên màn hình đúng các dòng đang lọc — không phải tải về mới xem được. */}
            <Button type="button" variant="outline" size="sm" disabled={!sheet} onClick={() => setPreviewing(true)}>
              <FileText />
              Xem báo cáo
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="icon" aria-label="Thao tác khác" title="Thao tác khác">
                  <Settings />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem disabled={exporting} onSelect={() => void exportXlsx()}>
                  {exporting ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
                  Xuất Excel
                </DropdownMenuItem>
                {/* In đúng các dòng đang lọc: chọn "Còn thiếu" hay "Thừa" rồi bấm In. */}
                <DropdownMenuItem disabled={!sheet} onSelect={() => {
                  setReportView(undefined);
                  window.setTimeout(() => window.print(), 100);
                }}>
                  <Printer />
                  In
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setHideStats(!hideStats)}>
                  {hideStats ? <Eye /> : <EyeOff />}
                  {hideStats ? "Hiện số liệu tổng" : "Ẩn số liệu tổng"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />
    </div>
    </>
  );
}

/** Ngày trong tên tệp: dd-MM-yyyy (tên tệp Windows không nhận dấu "/"). */
function fileDate() {
  const t = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(t.getDate())}-${p(t.getMonth() + 1)}-${t.getFullYear()}`;
}
