import { BookOpen, Boxes, GraduationCap, ListChecks, Printer } from "lucide-react";
import { useCallback, useMemo, useState, type ReactNode } from "react";

import { DetailTable, type DetailColumn, type DetailFilter } from "@/shared/components/data-table/detail-table";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import type { NormRow } from "@/domains/procurement/types";

import { STATUS_FILTERS, statusesOf, type AdequacyView, type StatusFilter } from "../purchase-proposals/adequacy-table";

const num = new Intl.NumberFormat("vi-VN");

const COLUMNS: DetailColumn[] = [
  { key: "code", label: "Mã DM thiết bị" },
  { key: "name", label: "Thiết bị" },
  { key: "subject", label: "Môn" },
  { key: "required", label: "Phải có", numeric: true },
  { key: "current", label: "Đang có", numeric: true },
  { key: "shortage", label: "Thiếu", numeric: true },
  { key: "surplus", label: "Thừa", numeric: true },
];

/** Tên tờ báo cáo theo tình trạng đang lọc — Còn thiếu = UC51, Thừa = UC52. */
export function reportTitle(status: StatusFilter): string {
  if (status === "short") return "Danh sách thiết bị còn thiếu";
  if (status === "surplus") return "Danh sách thiết bị vượt định mức";
  return "Đối chiếu danh mục thiết bị tối thiểu";
}

/**
 * Màu của bốn con số — cùng bộ với thẻ "Chuẩn tối thiểu" trên hồ sơ thiết bị: Phải có vàng đồng (định mức),
 * Đang có xanh dương, Thiếu đỏ, Thừa xanh lá.
 */
const TONE = {
  required: { chip: "bg-gold-subtle text-gold-text", text: "text-gold-text" },
  current: { chip: "bg-info-subtle text-info-text", text: "text-info-text" },
  shortage: { chip: "bg-destructive-subtle text-destructive-text", text: "text-destructive-text" },
  surplus: { chip: "bg-success-subtle text-success-text", text: "text-success-text" },
} as const;

const text = (r: NormRow, c: DetailColumn): string => {
  switch (c.key) {
    case "code": return r.catalogCode ?? r.normCode;
    case "name": return r.normName;
    case "subject": return r.subjectName ?? "—";
    case "required": return r.required == null || r.optional ? "—" : num.format(r.required);
    case "current": return num.format(r.current);
    // Có số thì in số, kể cả 0; trống (dòng tự chọn / chưa tính được) thì "—" như cột Phải có.
    case "shortage": return r.shortage == null ? "—" : num.format(r.shortage);
    case "surplus": return r.surplus == null ? "—" : num.format(r.surplus);
    default: return "";
  }
};

const cell = (r: NormRow, c: DetailColumn): ReactNode => {
  const v = text(r, c);
  if (c.key === "required" || c.key === "current") {
    return <span className={cn("font-semibold tabular-nums", v === "—" ? "text-muted-foreground" : TONE[c.key].text)}>{v}</span>;
  }
  if (c.key === "shortage" || c.key === "surplus") {
    // Chỉ số khác 0 mới tô chip; 0 và "—" in nhạt như số 0 của các cột khác.
    return r[c.key] ? (
      <span className={cn("inline-block rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums", TONE[c.key].chip)}>
        {v}
      </span>
    ) : <span className="text-muted-foreground tabular-nums">{v}</span>;
  }
  return v;
};

/** Khối của một dòng: "6,7" → ["6", "7"]. */
const gradesOf = (r: NormRow) => (r.gradeLevels ?? "").split(",").map((g) => g.trim()).filter(Boolean);

/**
 * "Xem báo cáo" của chuẩn tối thiểu một trường: xem ngay trên màn hình, kiểu bảng của ứng dụng (không phải tờ văn
 * bản) — tiêu đề, rồi hàng ô tìm + bốn nút lọc (tình trạng, môn, loại thiết bị, khối lớp) cùng dòng số LOẠI thiết bị
 * của cả trường (phải có / đã đủ / còn thiếu / thừa, cùng số với dải ô của màn) dạt phải, rồi bảng chi tiết. Không
 * cộng số lượng: định mức theo học sinh / lớp và đơn vị khác nhau (tờ, bộ, cái) cộng lại ra con số không đọc được.
 *
 * Hộp nhận MỌI dòng của trường và mở ra đúng tình trạng / môn / từ khoá đang chọn ngoài màn (`initial`); lọc lại trong
 * hộp thì tiêu đề và bản In đi theo (`onViewChange`). Tờ có quốc hiệu, chữ ký chỉ dùng khi In; Xuất báo cáo là tệp
 * máy chủ dựng.
 */
export function AdequacyReportDialog({ open, onOpenChange, rows, initial, counts, onViewChange, actions }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Mọi dòng đối chiếu của trường. */
  rows: NormRow[];
  /** Bộ lọc ngoài màn lúc bấm "Xem báo cáo". */
  initial: AdequacyView;
  /** Số loại thiết bị của cả trường — cùng số với dải ô trên màn Chuẩn tối thiểu. */
  counts: { norms: number; met: number; shortItems: number; surplusItems: number };
  /** Các dòng và tên bộ lọc đang xem trong hộp — màn chứa hộp dựng bản In từ đó. */
  onViewChange: (view: AdequacyView) => void;
  actions?: ReactNode;
}) {
  const [status, setStatus] = useState<StatusFilter>(initial.status);
  const totals: { key: keyof typeof TONE; label: string; value: number; unit: string }[] = [
    { key: "required", label: "Phải có", value: counts.norms, unit: "loại thiết bị" },
    { key: "current", label: "Đã đủ", value: counts.met, unit: "loại" },
    { key: "shortage", label: "Còn thiếu", value: counts.shortItems, unit: "loại" },
    { key: "surplus", label: "Thừa", value: counts.surplusItems, unit: "loại" },
  ];

  // Cùng một mảng giữa các lần vẽ (DetailTable dựa vào đó). Giá trị chọn sẵn chỉ có tác dụng lúc mở hộp.
  const filters = useMemo<DetailFilter<NormRow>[]>(() => {
    // Dòng không ghi khối là dùng cho mọi lớp của cấp: khớp khối nào cũng được.
    const allGrades = [...new Set(rows.flatMap(gradesOf))].sort((a, b) => a.localeCompare(b, "vi", { numeric: true }));
    // Hộp "Bộ lọc" xếp hai ô một hàng: hai danh sách ngắn (tình trạng, khối) trên, hai danh sách dài (môn, loại) dưới.
    return [
      { key: "status", label: "tình trạng", icon: ListChecks, values: statusesOf, options: STATUS_FILTERS.map((f) => ({ key: f.value, label: f.label })),
        initial: initial.status === "all" ? null : initial.status },
      { key: "grade", label: "khối lớp", icon: GraduationCap, values: (r) => (r.gradeLevels ? gradesOf(r) : allGrades),
        options: allGrades.map((g) => ({ key: g, label: `Lớp ${g}` })) },
      { key: "subject", label: "môn", icon: BookOpen, values: (r) => [r.subjectName ?? "Chưa gắn môn"], initial: initial.subject ?? null },
      { key: "type", label: "loại thiết bị", icon: Boxes, values: (r) => (r.typeName ? [r.typeName] : []) },
    ];
  }, [rows, initial]);

  const report = useCallback((shown: NormRow[], picked: Record<string, string | null>) => {
    const next = (picked.status ?? "all") as StatusFilter;
    setStatus(next);
    const parts = [
      STATUS_FILTERS.find((f) => f.value === next)?.label ?? "Tất cả",
      picked.subject, picked.type, picked.grade ? `Lớp ${picked.grade}` : null,
    ].filter(Boolean);
    onViewChange({ rows: shown, filterLabel: parts.join(" · "), status: next, subject: picked.subject ?? undefined });
  }, [onViewChange]);

  const print = () => {
    onOpenChange(false);
    // Đợi hộp đóng hẳn, kẻo lớp phủ của hộp lọt vào bản in.
    window.setTimeout(() => window.print(), 300);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="wide" className="gap-4">
        <DialogHeader>
          <DialogTitle>{reportTitle(status)}</DialogTitle>
          <DialogDescription className="sr-only">Danh sách đối chiếu thiết bị tối thiểu theo bộ lọc đang chọn</DialogDescription>
        </DialogHeader>
        {/* Số loại thiết bị gọn một dòng, cùng hàng với ô tìm và các nút lọc, dạt về bên phải. */}
        <DetailTable columns={COLUMNS} rows={rows} text={text} cell={cell} filters={filters} initialSearch={initial.term}
          onView={report} searchPlaceholder="Tìm thiết bị, mã DM thiết bị…"
          toolbarEnd={
            <dl className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
              {totals.map((t) => (
                <div key={t.key} className="flex items-baseline gap-1.5">
                  <dt className="text-muted-foreground">{t.label}:</dt>
                  <dd><span className={cn("font-semibold tabular-nums", TONE[t.key].text)}>{num.format(t.value)}</span> {t.unit}</dd>
                </div>
              ))}
            </dl>
          } />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Đóng</Button>
          {actions}
          <Button type="button" onClick={print}>
            <Printer />
            In
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
