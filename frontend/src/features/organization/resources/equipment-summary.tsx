import type { CrudFilter } from "@refinedev/core";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight,
  CircleDashed,
  DoorOpen,
  FoldVertical,
  RefreshCw,
  School as SchoolIcon,
  Search,
  Settings,
  UnfoldVertical,
  Warehouse,
  X,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";

import { kyInstance } from "@/shared/api/data";
import { CrossLink } from "@/shared/components/cross-link";
import { DataTablePagination } from "@/shared/components/data-table/data-table-pagination";
import { HelpHint } from "@/shared/components/form/help-hint";
import { ToolbarLead, ToolbarTrail, useToolbarMenu } from "@/shared/components/views/list-view";
import { usePersistentState } from "@/shared/hooks/use-persistent-state";
import { DEFAULT_PAGE_SIZE, quantityFormat } from "@/shared/lib/format";
import { LIFT_ROW } from "@/shared/lib/row-lift";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Input } from "@/shared/ui/input";
import type { EquipmentSummaryResponse, EquipmentSummaryRow } from "@/domains/equipment/types";
import { summaryParams } from "./equipment-aside";
import { QTY_TONE, hueChip, hueOf } from "./equipment-colors";

type QtyKey = "total" | "usable" | "in_use" | "in_stock" | "broken" | "pending";

/** Cột số lượng — thứ tự là thứ tự đọc: có bao nhiêu → dùng được bao nhiêu → đang ở đâu → hỏng, sắp ra khỏi sổ. */
const QTY: { key: QtyKey; label: string; hint?: string; width: string }[] = [
  { key: "total", label: "Tổng", width: "w-[4.5rem]" },
  { key: "usable", label: "Dùng được", hint: "Trong kho và đang sử dụng", width: "w-[6.5rem]" },
  { key: "in_use", label: "Đang dùng", width: "w-[6.5rem]" },
  { key: "in_stock", label: "Trong kho", width: "w-24" },
  { key: "broken", label: "Hỏng", hint: "Hỏng chờ xử lý và đang sửa chữa", width: "w-20" },
  { key: "pending", label: "Chờ ghi giảm", hint: "Kiểm kê không thấy, hoặc đang chờ thanh lý", width: "w-28" },
];

/** Bộ lọc chỉ nói PHẠM VI đang xem (không lọc thiết bị) — bảng trống với riêng nó là phạm vi chưa có thiết bị. */
const SCOPE_FIELDS = new Set(["school.id"]);

const n = (v: number | null | undefined) => Number(v ?? 0);

type Group = {
  key: string;
  title: string;
  school?: string;
  roomId?: number | null;
  rows: EquipmentSummaryRow[];
};

/**
 * Màn Thiết bị dạng TỔNG HỢP SỐ LƯỢNG: mỗi dòng một nhóm thiết bị — hoặc một nhóm thiết bị trong một kho/phòng —
 * với số lượng tách theo trạng thái. Bấm một dòng mở bảng Theo tài sản, lọc sẵn theo nhóm thiết bị (và phòng).
 *
 * Theo nhóm thiết bị: máy chủ trả đủ dòng, phân trang ở máy khách. Theo kho/phòng: phân trang ở máy chủ theo
 * từng cặp trường × kho/phòng — một trang là N phòng, không phải N dòng.
 */
export function EquipmentSummary({
  by,
  filters,
  drill,
}: {
  by: "catalog" | "room";
  filters: CrudFilter[];
  drill: (filters: CrudFilter[], label: string) => void;
}) {
  const menu = useToolbarMenu();
  // Ô tìm, trang đang xem và các kho/phòng đang thu gọn nhớ trong phiên của tab: mở một tài sản rồi quay lại
  // không mất chỗ đang đứng.
  const [q, setQ] = usePersistentState<string>("equipment.summary.q", "");
  const [collapsed, setCollapsed] = usePersistentState<string[]>("equipment.summary.collapsed", []);
  const toggle = (key: string) => setCollapsed((c) => (c.includes(key) ? c.filter((k) => k !== key) : [...c, key]));
  const [term, setTerm] = useState(() => q.trim());
  useEffect(() => {
    const id = window.setTimeout(() => setTerm(q.trim()), 250);
    return () => window.clearTimeout(id);
  }, [q]);

  const search = summaryParams(filters, term ? { by, q: term } : { by });
  const [page, setPage] = usePersistentState<number>(`equipment.summary.page.${by}`, 1);
  const [pageSize, setPageSize] = usePersistentState<number>(`equipment.summary.size.${by}`, DEFAULT_PAGE_SIZE);
  const searchKey = JSON.stringify(search);
  // Đổi bộ lọc / ô tìm thì về trang 1 — nhưng không ở lần dựng đầu, kẻo mất trang vừa nhớ.
  const lastKey = useRef(searchKey);
  useEffect(() => {
    if (lastKey.current === searchKey) return;
    lastKey.current = searchKey;
    setPage(1);
  }, [searchKey, setPage]);

  const serverPaged = by === "room";
  const query = serverPaged
    ? { ...search, _start: String((page - 1) * pageSize), _end: String(page * pageSize) }
    : search;
  const queryClient = useQueryClient();
  const { data, isFetching } = useQuery({
    queryKey: ["equipment", "summary", query],
    placeholderData: keepPreviousData,
    queryFn: () => kyInstance.get("equipment/summary", { searchParams: query }).json<EquipmentSummaryResponse>(),
  });
  const rows = useMemo(() => data?.rows ?? [], [data]);
  const multiSchool = (data?.maxSchools ?? 0) > 1;

  // Theo kho/phòng: gom các dòng của cùng một phòng dưới một dòng tiêu đề.
  const groups = useMemo<Group[]>(() => {
    if (by !== "room") return [{ key: "all", title: "", rows }];
    const map = new Map<string, Group>();
    for (const r of rows) {
      const key = `${r.school_id}|${r.room_id ?? "none"}`;
      if (!map.has(key)) map.set(key, { key, title: r.room ?? "", school: r.school, roomId: r.room_id ?? null, rows: [] });
      map.get(key)!.rows.push(r);
    }
    return [...map.values()];
  }, [by, rows]);

  // Số kho/phòng và số tài sản của mỗi trường do máy chủ đếm trên cả danh sách, không chỉ trang đang xem.
  const schoolTotals = useMemo(() => {
    const out = new Map<string, { rooms: number; records: number }>();
    for (const t of data?.schoolTotals ?? []) out.set(t.school ?? "", { rooms: n(t.rooms), records: n(t.records) });
    return out;
  }, [data]);

  const unitCount = serverPaged ? n(data?.total) : rows.length;
  const pageCount = Math.max(1, Math.ceil(unitCount / pageSize));
  const current = Math.min(page, pageCount);
  // Lọc lại làm danh sách ngắn đi mà đang đứng ở trang sau cùng: kéo về trang cuối còn dữ liệu.
  useEffect(() => {
    if (serverPaged && data && page > pageCount) setPage(pageCount);
  }, [serverPaged, data, page, pageCount, setPage]);
  const offset = (current - 1) * pageSize;
  const pageGroups = serverPaged ? groups : [{ ...groups[0], rows: rows.slice(offset, offset + pageSize) }];

  const open = (r: EquipmentSummaryRow) => {
    const extra: CrudFilter[] = [{ field: "catalog.id", operator: "eq", value: r.catalog_id }];
    if (by === "room") extra.push({ field: "room.id", operator: "eq", value: r.room_id ?? "none" });
    drill(extra, by === "room" ? `${r.name} — ${r.room}` : r.name);
  };

  // Cột Môn chỉ hiện khi có nhóm thiết bị gắn môn — một cột toàn "—" chỉ chiếm chỗ.
  const showSubject = rows.some((r) => r.subject);
  const cols = 3 + (showSubject ? 1 : 0) + QTY.length;
  const filtered = !!term || filters.some((f) => "field" in f && !SCOPE_FIELDS.has(f.field));

  return (
    <section className="bg-card shadow-e1 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b p-3">
        <div className="relative min-w-0 flex-1 basis-40 sm:max-w-sm">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm theo tên hoặc mã thiết bị…"
            aria-label="Tìm thiết bị"
            className="rounded-full pr-9 pl-8"
          />
          {q ? (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="Xoá"
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
        {/* Chế độ xem, ô trường và nút Bộ lọc (đưa lên từ cột trái). */}
        <ToolbarLead />
        <div className="flex items-center gap-2 sm:ms-auto">
          <ToolbarTrail />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="icon" aria-label="Thao tác khác">
                <Settings />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem
                onSelect={() => queryClient.invalidateQueries({ queryKey: ["equipment", "summary"] })}
              >
                <RefreshCw />
                Tải lại
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {menu ? (
                <>
                  {menu}
                  <DropdownMenuSeparator />
                </>
              ) : null}
              {by === "room" && groups.length > 1 ? (
                !groups.every((g) => collapsed.includes(g.key)) ? (
                  <DropdownMenuItem
                    onSelect={() => setCollapsed((c) => [...new Set([...c, ...groups.map((g) => g.key)])])}
                  >
                    <FoldVertical />
                    Thu gọn tất cả
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onSelect={() => setCollapsed((c) => c.filter((k) => !groups.some((g) => g.key === k)))}
                  >
                    <UnfoldVertical />
                    Mở tất cả
                  </DropdownMenuItem>
                )
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="scrollbar-fade min-h-0 flex-1 overflow-auto">
        {/* Độ rộng cột cố định: tự co theo nội dung thì thu gọn một kho/phòng làm cả bảng tính lại và cột xê dịch. */}
        <table className="w-full min-w-[62rem] table-fixed text-sm">
          <colgroup>
            <col className="w-12" />
            <col />
            {showSubject ? <col className="w-40" /> : null}
            <col className="w-16" />
            {QTY.map((c) => (
              <col key={c.key} className={c.width} />
            ))}
          </colgroup>
          <thead className="bg-table-head [&_th]:border-primary/15 sticky top-0 z-10 shadow-[0_1px_0_var(--border)] [&_th]:font-semibold">
            <tr className="text-overline text-table-head-text border-b">
              <th rowSpan={2} className="border-e px-3 py-2 text-center align-middle">STT</th>
              <th rowSpan={2} className="border-e px-3 py-2 text-start align-middle">Thiết bị</th>
              {showSubject ? (
                <th rowSpan={2} className="border-e px-3 py-2 text-start align-middle whitespace-nowrap">Môn</th>
              ) : null}
              <th rowSpan={2} className="px-3 py-2 text-start align-middle">ĐVT</th>
              <th colSpan={QTY.length} className="border-s border-b px-3 py-1.5 text-center tracking-widest">
                Số lượng
              </th>
            </tr>
            <tr className="text-overline text-table-head-text border-b">
              {QTY.map((c) => (
                <th key={c.key} className={cn("border-s px-2 py-1.5 text-end whitespace-nowrap", QTY_TONE[c.key]?.head)}>
                  {c.label}
                  {c.hint ? <HelpHint className="ms-1">{c.hint}</HelpHint> : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={cols} className="text-muted-foreground py-14 text-center">
                  {isFetching ? (
                    "Đang tải…"
                  ) : filtered ? (
                    "Không có thiết bị nào khớp bộ lọc."
                  ) : (
                    // Phạm vi chưa có thiết bị nào: chỉ lối vào sổ.
                    <div className="grid justify-items-center gap-2">
                      <span>Chưa có thiết bị nào trên sổ.</span>
                      <span className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm">
                        <CrossLink to="/equipment-intakes/create" resource="equipment_intakes" action="create" plain className="text-primary hover:underline">
                          Lập phiếu ghi tăng
                        </CrossLink>
                        <CrossLink to="/data-imports" resource="data_imports" action="list" plain className="text-primary hover:underline">
                          Nhập từ tệp
                        </CrossLink>
                      </span>
                    </div>
                  )}
                </td>
              </tr>
            ) : null}
            {pageGroups.map((g, gi) => {
              // Tổng hợp: số thứ tự chạy tiếp qua các trang. Theo kho/phòng: đếm lại trong từng phòng.
              let stt = by === "room" ? 0 : offset;
              const newSchool = by === "room" && multiSchool && (gi === 0 || pageGroups[gi - 1].school !== g.school);
              const totals = schoolTotals.get(g.school ?? "");
              const isCollapsed = collapsed.includes(g.key);
              return (
                <Fragment key={g.key}>
                  {newSchool ? (
                    <tr className="bg-surface-subtle border-b">
                      <td colSpan={cols} className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <SchoolIcon className="text-muted-foreground size-4 shrink-0" />
                          <span className="font-semibold">{g.school}</span>
                          <span className="text-muted-foreground text-xs tabular-nums">
                            {totals ? `${totals.rooms} kho/phòng · ${totals.records.toLocaleString("vi-VN")} tài sản` : ""}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                  {g.title ? (
                    // Tiêu đề một kho/phòng: bấm để thu gọn / mở. Đếm HỒ SƠ, không cộng số lượng khác đơn vị.
                    <tr
                      className={cn(
                        "hover:bg-muted/60 cursor-pointer border-b select-none",
                        !isCollapsed && "bg-muted hover:bg-muted/70",
                      )}
                      onClick={() => toggle(g.key)}
                      aria-expanded={!isCollapsed}
                      title={isCollapsed ? "Mở danh sách" : "Thu gọn"}
                    >
                      <td colSpan={cols} className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <ChevronRight
                            className={cn("text-muted-foreground size-4 shrink-0 transition-transform", !isCollapsed && "rotate-90")}
                          />
                          <span className="text-primary [&_svg]:size-4">
                            {g.roomId == null ? <CircleDashed /> : /kho/i.test(g.title) ? <Warehouse /> : <DoorOpen />}
                          </span>
                          <span className="text-[0.9375rem] font-semibold">{g.title}</span>
                          <span className="bg-card text-muted-foreground ms-1 rounded-full border px-2 py-0.5 text-xs tabular-nums">
                            {g.rows.length} loại
                          </span>
                          <span className="bg-primary/12 text-primary rounded-full px-2.5 py-0.5 text-[0.8125rem] font-semibold tabular-nums">
                            {g.rows.reduce((s, r) => s + n(r.records), 0).toLocaleString("vi-VN")} thiết bị
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                  {(isCollapsed ? [] : g.rows).map((r) => {
                    stt += 1;
                    return (
                      <tr
                        key={`${r.catalog_id}-${r.room_id ?? ""}-${r.school_id ?? ""}`}
                        onClick={() => open(r)}
                        className={cn("cursor-pointer border-b last:border-b-0", LIFT_ROW)}
                        title="Mở danh sách từng tài sản của thiết bị này"
                      >
                        <td className="text-muted-foreground px-3 py-2.5 text-center tabular-nums">{stt}</td>
                        <td className="px-3 py-2.5" title={`${r.name} · ${r.code}${r.type ? ` · ${r.type}` : ""}`}>
                          {/* Chỉ đánh dấu nhóm NGOÀI danh mục tối thiểu, ngay cạnh tên — không dành cả một cột. */}
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="truncate font-medium">{r.name}</span>
                            {r.minimum_required ? null : (
                              <span
                                className="bg-muted text-muted-foreground shrink-0 rounded-full px-2 py-0.5 text-[0.6875rem]"
                                title="Không thuộc danh mục thiết bị tối thiểu theo thông tư"
                              >
                                Ngoài danh mục
                              </span>
                            )}
                          </div>
                        </td>
                        {showSubject ? (
                          <td className="px-3 py-2" title={r.subject ?? undefined}>
                            {r.subject ? (
                              <span
                                className="inline-block max-w-full truncate rounded-full px-2.5 py-0.5 align-middle text-xs font-medium"
                                style={hueChip(hueOf(r.subject))}
                              >
                                {r.subject}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        ) : null}
                        <td className="text-muted-foreground px-3 py-2.5 whitespace-nowrap">{r.unit ?? "—"}</td>
                        {QTY.map((c, i) => {
                          const v = n(r[c.key]);
                          return (
                            <td
                              key={c.key}
                              className={cn(
                                "px-2 py-2.5 text-end tabular-nums",
                                i === 0 && "border-s",
                                v === 0 ? "text-muted-foreground/40" : QTY_TONE[c.key]?.text,
                              )}
                            >
                              {v === 0 ? "–" : quantityFormat.format(v)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {unitCount > 0 ? (
        <div className="shrink-0 border-t px-3 py-1.5">
          <DataTablePagination
            currentPage={current}
            pageCount={pageCount}
            setCurrentPage={setPage}
            pageSize={pageSize}
            setPageSize={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            total={unitCount}
            pageSizeLabel={by === "room" ? "Số kho/phòng mỗi trang" : "Số thiết bị mỗi trang"}
          />
        </div>
      ) : null}
    </section>
  );
}
