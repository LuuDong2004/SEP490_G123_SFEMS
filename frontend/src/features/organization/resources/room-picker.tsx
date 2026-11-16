import { useCan, useInvalidate, useList, useNotification } from "@refinedev/core";
import { ChevronDown, DoorOpen, Search, UserPlus, Warehouse, X, Building2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useController, type Control, type FieldValues } from "react-hook-form";

import { kyInstance } from "@/shared/api/data";
import { IconFilter } from "@/shared/components/data-table/icon-filter";
import { StaffPicker, type StaffRow } from "@/shared/components/catalog/staff-picker";
import { CrossLink } from "@/shared/components/cross-link";
import { FormHint, HelpHint } from "@/shared/components/form/help-hint";
import { errorMessage } from "@/shared/lib/api-error";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { Input } from "@/shared/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { LIFT_ROW } from "@/shared/lib/row-lift";
import { TableEmpty } from "@/shared/components/data-table/table-empty";
import { LoadMore } from "@/shared/components/data-table/load-more";
import { useShowMore } from "@/shared/hooks/use-infinite-scroll";

export type RoomRow = {
  id: number;
  code: string;
  name: string;
  building?: { id: number; name: string } | null;
  roomType?: { code?: string; name: string } | null;
  floor?: string | null;
  managingStaff?: { id: number; name: string } | null;
  /** Cho mượn được không (hồ sơ phòng, QLTB-350). */
  loanable?: boolean;
  /** Môn của phòng bộ môn — phiếu mượn phòng điền sẵn môn học theo nó (QLTB-531). */
  subject?: { id: number; name: string } | null;
};

const ALL = "__all__";
const NO_BUILDING = "none";
/** Một trang của hộp chọn — vừa đúng chiều cao bảng, như hộp chọn cán bộ. */
/** Số dòng hiện thêm mỗi lần cuộn tới đáy. */
const PAGE_SIZE = 30;

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").toLowerCase();

/**
 * Chọn kho / phòng bằng HỘP THOẠI một lần bấm, cùng khuôn với hộp chọn cán bộ: ô tìm, lọc theo khối
 * nhà, bảng phân trang (mã · phòng · khối nhà · loại · tầng), bấm một dòng là xong. Chỉ phòng của
 * ĐÚNG trường tài sản.
 *
 * `withManager` (phiếu cấp phát): mỗi phòng hiện cán bộ phụ trách của nó, vì chọn phòng là chọn luôn
 * người nhận. Phòng chưa có người phụ trách thì ô đó là chữ đỏ "Chưa khai" — người có quyền sửa phòng
 * bấm vào, chọn cán bộ, hồ sơ phòng được cập nhật; không phải bỏ dở phiếu sang màn Phòng.
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
  withManager,
  onPicked,
  only,
  required,
}: {
  /** Chỉ liệt kê phòng thoả điều kiện này (vd. phiếu mượn phòng: phòng dùng chung, không kho, không phòng học). */
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
  /** Hiện cán bộ phụ trách của từng phòng và cho khai ngay khi phòng chưa có. */
  withManager?: boolean;
  /** Gọi khi chọn (hoặc bỏ chọn) một phòng, và khi phòng ĐANG chọn vừa được khai người phụ trách. */
  onPicked?: (room: RoomRow | null) => void;
}) {
  const { field, fieldState } = useController({
    control,
    name,
    rules: required ? { validate: (v: { id?: number | null } | null) => (v?.id ? true : `Chọn ${label.toLowerCase()}`) } : undefined,
  });
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const { open: notify } = useNotification();
  const invalidate = useInvalidate();
  const mayEditRooms = useCan({ resource: "rooms", action: "edit" }).data?.can ?? false;
  const scope = schoolId ? [{ field: "school.id", operator: "eq" as const, value: schoolId }, { field: "active", operator: "eq" as const, value: true }] : [];
  const { result, query } = useList<RoomRow>({
    resource: "rooms",
    filters: scope,
    pagination: { currentPage: 1, pageSize: 500 },
    sorters: [{ field: "sortOrder", order: "asc" }],
    queryOptions: { enabled: !!schoolId },
  });
  // Danh sách cán bộ chỉ cần khi có phòng phải khai người phụ trách — và chỉ tải lúc hộp đang mở.
  const { result: staffResult, query: staffQuery } = useList<StaffRow>({
    resource: "staff",
    filters: scope,
    pagination: { currentPage: 1, pageSize: 500 },
    sorters: [{ field: "sortOrder", order: "asc" }],
    queryOptions: { enabled: !!schoolId && !!withManager && mayEditRooms && open },
  });
  const rooms = useMemo(() => (only ? (result?.data ?? []).filter(only) : (result?.data ?? [])), [result, only]);
  const selectedId = field.value?.id ?? null;
  const selected = rooms.find((r) => r.id === selectedId) ?? (selectedId === current?.id ? current : null);

  // Khối nhà là Ô LỌC và là một cột, không còn là tiêu đề nhóm — bảng phân trang thì nhóm bị cắt giữa chừng.
  const [building, setBuilding] = useState(ALL);
  const buildings = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rooms) if (r.building) map.set(String(r.building.id), r.building.name);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], "vi"));
  }, [rooms]);
  const shown = useMemo(() => {
    const n = fold(q.trim());
    return rooms.filter((r) => {
      if (building !== ALL && String(r.building?.id ?? NO_BUILDING) !== building) return false;
      return !n || fold(`${r.name} ${r.code} ${r.building?.name ?? ""} ${r.roomType?.name ?? ""} ${r.managingStaff?.name ?? ""}`).includes(n);
    });
  }, [rooms, q, building]);
  // Cuộn tới đâu hiện thêm tới đó, không phân trang "Trước / Sau" (trưởng nhóm 13/11/2026).
  const more = useShowMore(shown.length, PAGE_SIZE);
  const pageRows = shown.slice(0, more.count);
  // Mở hộp đã hiện tới phòng đang chọn.
  const openDialog = () => {
    const at = selectedId == null ? -1 : shown.findIndex((r) => r.id === selectedId);
    more.reveal(at + 1);
    setOpen(true);
  };

  const pick = (r: RoomRow | null) => {
    field.onChange(r ? { id: r.id } : { id: null });
    onPicked?.(r);
    setOpen(false);
  };

  /** Khai người phụ trách cho một phòng ngay trong hộp chọn; phòng đang chọn thì báo lại cho form. */
  const assign = async (room: RoomRow, staff: StaffRow) => {
    try {
      await kyInstance.patch(`rooms/${room.id}`, { json: { managingStaff: { id: staff.id } } });
      notify?.({ type: "success", message: `${staff.name} phụ trách ${room.name}` });
      invalidate({ resource: "rooms", invalidates: ["list", "detail"], id: room.id });
      if (room.id === selectedId) onPicked?.({ ...room, managingStaff: { id: staff.id, name: staff.name } });
    } catch (error) {
      notify?.({ type: "error", message: await errorMessage(error), description: "Không khai được người phụ trách" });
    }
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
        className="bg-field shadow-e1 hover:border-primary/40 aria-invalid:border-destructive flex h-9 w-full min-w-0 items-center gap-2 overflow-hidden rounded-full border border-input px-3.5 text-left text-sm transition-colors disabled:opacity-60"
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
              <HelpHint>
                {only
                  ? "Bấm một dòng để chọn."
                  : withManager
                  ? "Bấm một dòng để chọn. Cán bộ phụ trách của phòng là người nhận và quản lý thiết bị."
                  : "Bấm một dòng để chọn. Để ở kho là \"trong kho\", để ở phòng là \"đang sử dụng\"."}
              </HelpHint>
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
                  more.reset();
                }}
                // Hộp này mở TRONG form của màn: Enter ở ô tìm không được submit form bên ngoài.
                onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                placeholder={withManager ? "Tìm tên, mã phòng, người phụ trách…" : "Tìm tên, mã phòng…"}
                className="rounded-full pl-8"
                aria-label="Tìm phòng"
              />
            </div>
            {buildings.length > 1 ? (
              <IconFilter icon={<Building2 />} label="khối nhà" allLabel="Mọi khối nhà" value={building === ALL ? null : building}
                onChange={(v) => {
                  setBuilding(v ?? ALL);
                  more.reset();
                }}
                groups={[{ items: [
                  ...buildings.map(([id, name]) => ({ key: id, label: name })),
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
                {withManager ? <col className="w-40" /> : null}
              </colgroup>
              <TableHeader sticky>
                <TableRow>
                  <TableHead className="px-4">Mã</TableHead>
                  <TableHead className="px-4">Phòng</TableHead>
                  <TableHead className="px-4">Khối nhà</TableHead>
                  <TableHead className="px-4">Loại phòng</TableHead>
                  <TableHead className="px-4">Tầng</TableHead>
                  {withManager ? <TableHead className="px-4">Phụ trách</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.isLoading || shown.length === 0 ? (
                  <TableEmpty colSpan={withManager ? 6 : 5} loading={query.isLoading} title={<>{q || building !== ALL ? "Không có phòng nào khớp." : (
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
                        <TableCell className="text-muted-foreground truncate px-4" title={r.building?.name}>{r.building?.name ?? "—"}</TableCell>
                        <TableCell className="truncate px-4">
                          {r.roomType?.name ? <Badge variant={isStore(r) ? "info" : "neutral"}>{r.roomType.name}</Badge> : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-muted-foreground px-4 tabular-nums">{r.floor ?? "—"}</TableCell>
                        {withManager ? (
                          // Ô này có nút riêng: bấm trong ô không phải là chọn phòng của dòng.
                          <TableCell className="truncate px-4" onClick={(e) => !r.managingStaff && e.stopPropagation()} title={r.managingStaff?.name}>
                            {r.managingStaff ? (
                              r.managingStaff.name
                            ) : mayEditRooms ? (
                              <StaffPicker
                                rows={staffResult?.data ?? []}
                                loading={staffQuery.isLoading}
                                value={null}
                                label={`người phụ trách ${r.name}`}
                                onChange={(staff) => {
                                  if (staff) void assign(r, staff);
                                }}
                                trigger={(openStaff) => (
                                  <button type="button" onClick={openStaff}
                                    className="text-destructive-text inline-flex items-center gap-1 text-xs font-medium underline-offset-2 hover:underline">
                                    Chưa khai
                                    <UserPlus className="size-3.5" />
                                  </button>
                                )}
                              />
                            ) : (
                              <span className="text-destructive-text text-xs font-medium">Chưa khai</span>
                            )}
                          </TableCell>
                        ) : null}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
            <LoadMore attach={more.attach} hasMore={more.hasMore} />
          </div>

          {/* Số dòng đang hiện / tổng bên trái; nút bấm dồn về tay phải. */}
          <div className="flex flex-wrap items-center gap-3 border-t pt-4">
            <span className="text-muted-foreground me-auto text-sm">
              {more.hasMore ? <><span className="tabular-nums">{pageRows.length}</span> / </> : null}
              <span className="text-foreground font-medium tabular-nums">{shown.length}</span> phòng
            </span>
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
