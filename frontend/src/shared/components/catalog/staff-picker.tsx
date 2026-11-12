import { ChevronDown, Search, X, Users } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { LEADERSHIP_POSITIONS, POSITION_LABELS, STAFF_TYPE_LABELS } from "@/domains/staff/types";
import { CrossLink } from "@/shared/components/cross-link";
import { IconFilter } from "@/shared/components/data-table/icon-filter";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { LIFT_ROW } from "@/shared/lib/row-lift";

export type StaffRow = {
  id: number;
  name: string;
  code?: string | null;
  staffType?: string | null;
  position?: string | null;
  department?: string | null;
  mainSubject?: { name: string } | null;
};

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").toLowerCase();

const positionOf = (r: StaffRow) => (r.position ? (POSITION_LABELS[r.position] ?? r.position) : null);

/** Dòng phụ dưới tên: chức vụ, rồi tổ / môn dạy — thứ phân biệt hai người trùng tên. */
const detailOf = (r: StaffRow) => [positionOf(r), r.department, r.mainSubject?.name].filter(Boolean).join(" · ");

/** Màu nhãn chức vụ: lãnh đạo, giáo viên, còn lại là nhân viên — nhìn cột là biết ai thuộc nhóm nào. */
const positionVariant = (r: StaffRow) =>
  LEADERSHIP_POSITIONS.has(r.position ?? "") ? "info" : r.staffType === "teacher" || r.position === "GIAO_VIEN" || r.position === "TO_TRUONG" ? "success" : "neutral";

/**
 * Ô hồ sơ còn trống, tô đỏ: người chọn thấy ngay hồ sơ cán bộ nào khai chưa đủ, và ai sửa được thì đi
 * thẳng sang màn sửa của đúng người đó — tab mới, vì hộp này nằm trên một phiếu đang gõ dở.
 */
const Missing = ({ staffId }: { staffId: number }) => (
  <CrossLink to={`/staff/edit/${staffId}`} resource="staff" newTab title="Mở hồ sơ cán bộ ở tab mới để khai" className="text-destructive-text text-xs font-medium">
    Chưa khai
  </CrossLink>
);

/**
 * Nhóm người hay được chọn nhất ở một ô — đưa LÊN ĐẦU danh sách khi mở hộp (không lọc bỏ ai): người
 * mượn thường là giáo viên, thủ kho thường là thủ kho / cán bộ thiết bị, chủ tịch hội đồng là lãnh đạo.
 */
export type StaffPrefer = "teacher" | "staff" | "keeper" | "leader";

const PREFERRED: Record<StaffPrefer, (r: StaffRow) => boolean> = {
  teacher: (r) => r.staffType === "teacher",
  staff: (r) => r.staffType === "staff" && !LEADERSHIP_POSITIONS.has(r.position ?? ""),
  keeper: (r) => r.position === "THU_KHO" || r.position === "CAN_BO_THIET_BI",
  leader: (r) => LEADERSHIP_POSITIONS.has(r.position ?? ""),
};

/** Một trang của hộp chọn — vừa đúng chiều cao bảng, không phải cuộn trong cuộn. */
const PAGE_SIZE = 8;
const TYPES = [
  { value: "", label: "Tất cả" },
  { value: "teacher", label: STAFF_TYPE_LABELS.teacher },
  { value: "staff", label: STAFF_TYPE_LABELS.staff },
];

/**
 * Chọn một cán bộ bằng HỘP THOẠI có ô tìm và BẢNG, thay cho danh sách xổ xuống chỉ có tên: mỗi dòng
 * hiện mã, chức vụ, tổ và môn dạy, nên hai người trùng tên vẫn phân biệt được và người chọn biết mình
 * đang giao việc cho ai. Dùng chung cho mọi ô "cán bộ" (`RefField` với `resource="staff"`, ô cán bộ
 * của phần chứng từ phiếu).
 */
export function StaffPicker({
  rows,
  value,
  onChange,
  loading,
  label = "cán bộ",
  disabledHint,
  invalid,
  trigger,
  prefer,
}: {
  rows: StaffRow[];
  /** Người đang chọn — chỉ cần `id`; tên lấy từ `rows`, không có thì lấy `name` kèm theo. */
  value: { id: number; name?: string } | null;
  onChange: (row: StaffRow | null) => void;
  loading?: boolean;
  /** Tên ô, viết thường — vào câu nhắc và tiêu đề hộp thoại. */
  label?: string;
  /** Có giá trị = ô bị khoá, hiện câu nhắc này ("Chọn trường trước"). */
  disabledHint?: string;
  invalid?: boolean;
  /** Thay ô bấm mặc định bằng nút riêng (vd. "Thêm phụ trách" trong một dòng) — nhận hàm mở hộp chọn. */
  trigger?: (open: () => void) => ReactNode;
  /** Nhóm xếp lên đầu danh sách — xem {@link StaffPrefer}. */
  prefer?: StaffPrefer;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [type, setType] = useState("");

  const selected: StaffRow | null = value
    ? (rows.find((r) => r.id === value.id) ?? { id: value.id, name: value.name ?? `#${value.id}` })
    : null;

  const shown = useMemo(() => {
    const n = fold(q.trim());
    const list = rows.filter((r) => {
      if (type && r.staffType !== type) return false;
      return !n || fold(`${r.name} ${r.code ?? ""} ${detailOf(r)}`).includes(n);
    });
    if (!prefer) return list;
    // Sắp ổn định: nhóm hay chọn lên đầu, trong mỗi nhóm giữ nguyên thứ tự danh sách.
    const first = PREFERRED[prefer];
    return [...list.filter(first), ...list.filter((r) => !first(r))];
  }, [rows, q, type, prefer]);

  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const pageRows = shown.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  // Mở hộp ở đúng trang có người đang chọn — không thì người ta tưởng ô đang trống.
  const openDialog = () => {
    const at = selected ? shown.findIndex((r) => r.id === selected.id) : -1;
    setPage(at < 0 ? 1 : Math.floor(at / PAGE_SIZE) + 1);
    setOpen(true);
  };

  const pick = (r: StaffRow | null) => {
    onChange(r);
    setOpen(false);
  };

  return (
    <>
      {trigger ? trigger(openDialog) : (
      <button
        type="button"
        onClick={openDialog}
        disabled={!!disabledHint}
        aria-invalid={invalid || undefined}
        className="bg-field hover:border-primary/40 aria-invalid:border-destructive flex h-9 w-full min-w-0 items-center gap-2 overflow-hidden rounded-md border px-3 text-left text-sm transition-colors disabled:opacity-60"
      >
        {selected ? (
          <>
            <span className="min-w-0 truncate">{selected.name}</span>
            {positionOf(selected) ? <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">{positionOf(selected)}</span> : <span className="flex-1" />}
          </>
        ) : (
          <span className="text-muted-foreground min-w-0 flex-1 truncate">{disabledHint ?? `Vui lòng chọn ${label}`}</span>
        )}
        <ChevronDown className="text-muted-foreground size-4 shrink-0 opacity-60" />
      </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        {/* Cùng khuôn với hộp chọn thiết bị từ danh mục: hàng lọc, bảng trong khung cao cố định, thanh chân. */}
        <DialogContent size="picker">
          <DialogHeader>
            <DialogTitle>Chọn {label}</DialogTitle>
            <DialogDescription className="sr-only">Tìm theo tên, mã, chức vụ hoặc tổ rồi bấm một dòng để chọn.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-80 max-w-full">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
              <Input
                autoFocus
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                // Hộp này mở TRONG form của màn: Enter ở ô tìm không được submit form bên ngoài.
                onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                placeholder="Tìm tên, mã, chức vụ, tổ…"
                className="rounded-full pl-8"
                aria-label="Tìm cán bộ"
              />
            </div>
            <IconFilter icon={<Users />} label="loại cán bộ" allLabel={TYPES.find((t) => !t.value)?.label} value={type || null}
              onChange={(v) => {
                setType(v ?? "");
                setPage(1);
              }}
              groups={[{ items: TYPES.filter((t) => t.value).map((t) => ({ key: t.value, label: t.label })) }]} />
          </div>

          {/* `table-fixed` + độ rộng từng cột: cột không nhảy chỗ khi sang trang, chữ dài cắt ba chấm. */}
          <div className="min-h-0 flex-1 overflow-auto rounded-md border [&>[data-slot=table-container]]:overflow-visible [&_tbody_tr:last-child]:border-b">
            <Table className="table-fixed">
              <colgroup>
                <col className="w-36" />
                <col />
                <col className="w-40" />
                <col className="w-52" />
                <col className="w-44" />
              </colgroup>
              <TableHeader sticky>
                <TableRow>
                  <TableHead className="px-4">Mã</TableHead>
                  <TableHead className="px-4">Họ tên</TableHead>
                  <TableHead className="px-4">Chức vụ</TableHead>
                  <TableHead className="px-4">Tổ</TableHead>
                  <TableHead className="px-4">Môn dạy</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading || shown.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground py-6 text-center">
                      {loading ? "Đang tải…" : q || type ? "Không có ai khớp." : (
                        <>
                          Trường chưa khai báo cán bộ nào.{" "}
                          <CrossLink to="/staff" resource="staff" action="create" newTab className="text-primary font-medium">Khai cán bộ</CrossLink>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  pageRows.map((r) => {
                    const active = r.id === selected?.id;
                    return (
                      <TableRow key={r.id} className={cn("group/row", LIFT_ROW, "h-12 cursor-pointer", active && "bg-primary/10 hover:bg-primary/10")} onClick={() => pick(r)}>
                        <TableCell className="text-muted-foreground truncate px-4 font-mono text-xs">{r.code ?? "—"}</TableCell>
                        <TableCell className={cn("truncate px-4 font-medium", active && "text-primary")} title={r.name}>{r.name}</TableCell>
                        <TableCell className="truncate px-4">
                          {positionOf(r) ? <Badge variant={positionVariant(r)}>{positionOf(r)}</Badge> : <Missing staffId={r.id} />}
                        </TableCell>
                        <TableCell className="text-muted-foreground truncate px-4" title={r.department ?? undefined}>{r.department || <Missing staffId={r.id} />}</TableCell>
                        <TableCell className="text-muted-foreground truncate px-4" title={r.mainSubject?.name}>
                          {/* Chỉ giáo viên mới phải có môn dạy; nhân viên để trống là đúng. */}
                          {r.mainSubject?.name ?? (r.staffType === "teacher" ? <Missing staffId={r.id} /> : "—")}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Số dòng bên trái; phân trang và nút bấm dồn về tay phải. */}
          <div className="flex flex-wrap items-center gap-3 border-t pt-4">
            <span className="text-muted-foreground me-auto text-sm">
              {shown.length ? `${(current - 1) * PAGE_SIZE + 1}–${Math.min(current * PAGE_SIZE, shown.length)} trên ` : ""}
              <span className="text-foreground font-medium tabular-nums">{shown.length}</span> người
            </span>
            {pageCount > 1 ? (
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Button type="button" variant="outline" size="sm" disabled={current <= 1} onClick={() => setPage(current - 1)}>
                  Trước
                </Button>
                <span className="tabular-nums">
                  Trang {current}/{pageCount}
                </span>
                <Button type="button" variant="outline" size="sm" disabled={current >= pageCount} onClick={() => setPage(current + 1)}>
                  Sau
                </Button>
              </div>
            ) : null}
            <div className="flex items-center gap-3">
              {selected ? (
                <Button type="button" variant="ghost" onClick={() => pick(null)}>
                  <X />
                  Bỏ chọn
                </Button>
              ) : null}
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Đóng
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
