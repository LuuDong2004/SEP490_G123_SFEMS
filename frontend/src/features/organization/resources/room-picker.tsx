import { useList } from "@refinedev/core";
import { Building2, ChevronDown, DoorOpen, Search, Warehouse, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useController, type Control, type FieldValues } from "react-hook-form";

import { IconFilter } from "@/shared/components/data-table/icon-filter";
import { CrossLink } from "@/shared/components/cross-link";
import { FormHint, HelpHint } from "@/shared/components/form/help-hint";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { Input } from "@/shared/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { LIFT_ROW } from "@/shared/lib/row-lift";
import { TableEmpty } from "@/features/organization/resources/table-empty";

/**
 * Một phòng theo hình dạng `RoomResponse` của nhóm.
 *
 * <p>Khác bản gốc ở hai chỗ, vì bảng `rooms` của nhóm cố tình đơn giản hơn: `building` là CHUỖI tự do
 * ("Dãy A") chứ không phải tham chiếu tới bảng khối nhà, và người phụ trách là `managingUnit` (đơn vị/tổ)
 * chứ không phải một tài khoản trong bảng `staff`. Bản gốc còn có `loanable` để lọc phòng cho mượn —
 * bảng của nhóm chưa có cột đó.
 */
export type RoomRow = {
  id: number;
  code: string;
  name: string;
  building?: string | null;
  roomType?: { code?: string; name: string } | null;
  floor?: string | null;
  /** Đơn vị / tổ quản lý phòng, nhập tự do: "Tổ Vật lí", "Thư viện". */
  managingUnit?: string | null;
  /** Môn của phòng bộ môn. */
  subject?: { id: number; name: string } | null;
};

const ALL = "__all__";
const NO_BUILDING = "none";
/** Một trang của hộp chọn — vừa đúng chiều cao bảng, như hộp chọn cán bộ. */
const PAGE_SIZE = 8;

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").toLowerCase();

/**
 * Chọn kho / phòng bằng HỘP THOẠI một lần bấm, cùng khuôn với hộp chọn cán bộ: ô tìm, lọc theo khối
 * nhà, bảng phân trang (mã · phòng · khối nhà · loại · tầng), bấm một dòng là xong. Chỉ phòng của
 * ĐÚNG trường tài sản.
 */
export function RoomPickerField({
  control,
  name,
  label,
  schoolId,
  current,
  hideLabel,
  hint,
  placeholder = "Vui lòng chọn kho / phòng",
  disabledHint,
  onPicked,
  only,
  required,
}: {
  /** Chỉ liệt kê phòng thoả điều kiện này. */
  only?: (room: RoomRow) => boolean;
  /** Ô bắt buộc: có dấu * và báo lỗi khi để trống. */
  required?: boolean;
  control: Control<FieldValues>;
  name: string;
  label: string;
  schoolId: number | null | undefined;
  current?: { id: number; name?: string } | null;
  hideLabel?: boolean;
  /** Lời giải thích — dấu "?" cạnh nhãn. */
  hint?: string;
  placeholder?: string;
  /** Có giá trị = ô bị khoá, hiện câu nhắc này ("Chọn trường trước"). */
  disabledHint?: string;
  /** Gọi khi chọn (hoặc bỏ chọn) một phòng. */
  onPicked?: (room: RoomRow | null) => void;
}) {
  const { field, fieldState } = useController({
    control,
    name,
    rules: required ? { validate: (v: { id?: number | null } | null) => (v?.id ? true : `Chọn ${label.toLowerCase()}`) } : undefined,
  });
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const scope = schoolId ? [{ field: "school.id", operator: "eq" as const, value: schoolId }, { field: "active", operator: "eq" as const, value: true }] : [];
  const { result, query } = useList<RoomRow>({
    resource: "rooms",
    filters: scope,
    pagination: { currentPage: 1, pageSize: 500 },
    sorters: [{ field: "sortOrder", order: "asc" }],
    queryOptions: { enabled: !!schoolId },
  });
  const rooms = useMemo(() => (only ? (result?.data ?? []).filter(only) : (result?.data ?? [])), [result, only]);
  const selectedId = field.value?.id ?? null;
  const selected = rooms.find((r) => r.id === selectedId) ?? (selectedId === current?.id ? current : null);

  // Khối nhà là Ô LỌC và là một cột, không còn là tiêu đề nhóm — bảng phân trang thì nhóm bị cắt giữa chừng.
  // Bản nhóm lưu khối nhà bằng CHUỖI nên gom nhóm theo chính chuỗi đó.
  const [building, setBuilding] = useState(ALL);
  const buildings = useMemo(() => {
    const set = new Set<string>();
    for (const r of rooms) if (r.building) set.add(r.building);
    return [...set].sort((a, b) => a.localeCompare(b, "vi"));
  }, [rooms]);
  const shown = useMemo(() => {
    const n = fold(q.trim());
    return rooms.filter((r) => {
      if (building !== ALL && (r.building ?? NO_BUILDING) !== building) return false;
      return !n || fold(`${r.name} ${r.code} ${r.building ?? ""} ${r.roomType?.name ?? ""} ${r.managingUnit ?? ""}`).includes(n);
    });
  }, [rooms, q, building]);
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const current_ = Math.min(page, pageCount);
  const pageRows = shown.slice((current_ - 1) * PAGE_SIZE, current_ * PAGE_SIZE);
  // Mở hộp ở đúng trang có phòng đang chọn.
  const openDialog = () => {
    const at = selectedId == null ? -1 : shown.findIndex((r) => r.id === selectedId);
    setPage(at < 0 ? 1 : Math.floor(at / PAGE_SIZE) + 1);
    setOpen(true);
  };

  const pick = (r: RoomRow | null) => {
    field.onChange(r ? { id: r.id } : { id: null });
    onPicked?.(r);
    setOpen(false);
  };

  const isStore = (r: { name?: string; code?: string }) => /kho/i.test(`${r.name} ${r.code}`);

  return (
    <FormItem>
      <FormLabel className={hideLabel ? "sr-only" : undefined} required={required || undefined}>
        {label}
      </FormLabel>
      {hint ? <FormHint>{hint}</FormHint> : null}
      <button
        type="button"
        onClick={openDialog}
        disabled={!schoolId || !!disabledHint}
        aria-invalid={!!fieldState.error || undefined}
        className="bg-field hover:border-primary/40 aria-invalid:border-destructive flex h-9 w-full min-w-0 items-center gap-2 overflow-hidden rounded-md border px-3 text-left text-sm transition-colors disabled:opacity-60"
      >
        {selected ? (
          <>
            <span className="text-primary [&_svg]:size-4">{isStore(selected) ? <Warehouse /> : <DoorOpen />}</span>
            <span className="min-w-0 flex-1 truncate">{selected.name}</span>
          </>
        ) : (
          <span className="text-muted-foreground min-w-0 flex-1 truncate">{disabledHint ?? placeholder}</span>
        )}
        <ChevronDown className="text-muted-foreground size-4 shrink-0 opacity-60" />
      </button>
      {/* Ô dùng useController, không nằm trong FormField: FormMessage không tự đọc được lỗi, phải truyền vào. */}
      <FormMessage>{fieldState.error?.message}</FormMessage>

      <Dialog open={open} onOpenChange={setOpen}>
        {/* Cùng khuôn với hộp chọn cán bộ và hộp chọn thiết bị: hàng lọc, bảng một trang cao cố định, thanh chân. */}
        <DialogContent size="picker">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Chọn {label.charAt(0).toLowerCase() + label.slice(1)}
              <HelpHint>Bấm một dòng để chọn. Để ở kho là "trong kho", để ở phòng là "đang sử dụng".</HelpHint>
            </DialogTitle>
            <DialogDescription className="sr-only">Tìm theo tên, mã phòng, khối nhà rồi bấm một dòng để chọn.</DialogDescription>
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
                placeholder="Tìm tên, mã phòng…"
                className="rounded-full pl-8"
                aria-label="Tìm phòng"
              />
            </div>
            {buildings.length > 1 ? (
              <IconFilter icon={<Building2 />} label="khối nhà" allLabel="Mọi khối nhà" value={building === ALL ? null : building}
                onChange={(v) => {
                  setBuilding(v ?? ALL);
                  setPage(1);
                }}
                groups={[{ items: [
                  ...buildings.map((name) => ({ key: name, label: name })),
                  ...(rooms.some((r) => !r.building) ? [{ key: NO_BUILDING, label: "Chưa gắn khối nhà" }] : []),
                ] }]} />
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-auto rounded-md border [&>[data-slot=table-container]]:overflow-visible [&_tbody_tr:last-child]:border-b">
            <Table className="table-fixed">
              <colgroup>
                <col className="w-24" />
                <col />
                <col className="w-36" />
                <col className="w-44" />
                <col className="w-14" />
              </colgroup>
              <TableHeader sticky>
                <TableRow>
                  <TableHead className="px-4">Mã</TableHead>
                  <TableHead className="px-4">Phòng</TableHead>
                  <TableHead className="px-4">Khối nhà</TableHead>
                  <TableHead className="px-4">Loại phòng</TableHead>
                  <TableHead className="px-4">Tầng</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.isLoading || shown.length === 0 ? (
                  <TableEmpty colSpan={5} loading={query.isLoading} title={<>{q || building !== ALL ? "Không có phòng nào khớp." : (
                        <>
                          Trường chưa khai báo phòng nào.{" "}
                          <CrossLink to="/rooms" resource="rooms" action="create" newTab className="text-primary font-medium">Khai phòng</CrossLink>
                        </>
                      )}</>} />
                ) : (
                  pageRows.map((r) => {
                    const active = r.id === selectedId;
                    return (
                      <TableRow key={r.id} className={cn("group/row", LIFT_ROW, "h-12 cursor-pointer", active && "bg-primary/10 hover:bg-primary/10")} onClick={() => pick(r)}>
                        <TableCell className="text-muted-foreground truncate px-4 font-mono text-xs">{r.code}</TableCell>
                        <TableCell className="px-4" title={r.name}>
                          <span className="flex min-w-0 items-center gap-2">
                            <span className={cn("shrink-0 [&_svg]:size-4", active ? "text-primary" : "text-muted-foreground")}>
                              {isStore(r) ? <Warehouse /> : <DoorOpen />}
                            </span>
                            <span className={cn("truncate font-medium", active && "text-primary")}>{r.name}</span>
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground truncate px-4" title={r.building ?? undefined}>{r.building ?? "—"}</TableCell>
                        <TableCell className="truncate px-4">
                          {r.roomType?.name ? <Badge variant={isStore(r) ? "info" : "neutral"}>{r.roomType.name}</Badge> : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-muted-foreground px-4 tabular-nums">{r.floor ?? "—"}</TableCell>
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
              {shown.length ? `${(current_ - 1) * PAGE_SIZE + 1}–${Math.min(current_ * PAGE_SIZE, shown.length)} trên ` : ""}
              <span className="text-foreground font-medium tabular-nums">{shown.length}</span> phòng
            </span>
            {pageCount > 1 ? (
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Button type="button" variant="outline" size="sm" disabled={current_ <= 1} onClick={() => setPage(current_ - 1)}>
                  Trước
                </Button>
                <span className="tabular-nums">
                  Trang {current_}/{pageCount}
                </span>
                <Button type="button" variant="outline" size="sm" disabled={current_ >= pageCount} onClick={() => setPage(current_ + 1)}>
                  Sau
                </Button>
              </div>
            ) : null}
            <div className="flex items-center gap-3">
              {selectedId ? (
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
    </FormItem>
  );
}
