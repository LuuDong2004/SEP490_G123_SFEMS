import { useCan, useList, type CrudFilter, type CrudSort } from "@refinedev/core";
import { ChevronDown, ChevronRight, Eye, FoldVertical, Pencil, Plus, Search, Trash2, UnfoldVertical } from "lucide-react";
import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";

import { usePersistentState } from "@/shared/hooks/use-persistent-state";
import { IconFilter } from "@/shared/components/data-table/icon-filter";
import { Segmented } from "@/shared/components/segmented";
import { cn } from "@/shared/lib/utils";
import { LIFT_ROW } from "@/shared/lib/row-lift";
import { Button } from "@/shared/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { Input } from "@/shared/ui/input";
import { DataTablePagination } from "@/shared/components/data-table/data-table-pagination";
import { Skeleton } from "@/shared/ui/skeleton";
import { ROW_ACTION_ITEM, RowActions, useRowActionsMenu } from "@/shared/components/data-table/row-actions";
import { TableEmpty } from "@/shared/components/data-table/table-empty";
import { LoadingText } from "@/shared/components/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type MiniColumn = {
  header: string;
  cell: (row: any) => ReactNode;
  className?: string;
};

/** Một nhóm của bảng: tiêu đề dòng nhóm, và phần tóm tắt bên phải (vd. "6 lớp · 252 HS"). */
export type MiniGroup = { key: string; label: ReactNode; icon?: ReactNode };

/** Lọc theo cấp cha — khối của lớp, khối nhà của phòng, phòng của thiết bị. */
export type MiniFacet = {
  /** Trường lọc gửi lên, vd. "grade.id". */
  field: string;
  /** Resource đọc các lựa chọn. */
  resource: string;
  /** Chữ của lựa chọn "tất cả", vd. "Tất cả khối". */
  allLabel: string;
  /** Biểu tượng của nút lọc tròn. */
  icon: ReactNode;
  /** Tên điều kiện, viết thường — "khối", hiện khi rê chuột: "Lọc theo khối". */
  label: string;
  /** Lọc thêm khi đọc lựa chọn — vd. chỉ phòng của trường này. */
  filters?: CrudFilter[];
};

/** Bộ lọc thứ hai với các lựa chọn CỐ ĐỊNH (vd. trạng thái thiết bị) — không phải đọc từ máy chủ. */
export type MiniChoice = {
  field: string;
  allLabel: string;
  icon: ReactNode;
  label: string;
  options: { value: string; label: string }[];
  /** Luôn là nút lọc thả xuống, kể cả khi ít lựa chọn (danh mục CSVC — trưởng nhóm 12/11/2026: dải chọn chiếm chỗ). */
  menu?: boolean;
};

/**
 * Một cách xem của bảng. Có `groupBy` thì bảng đọc hết các dòng (một trường vài trăm dòng) và gom
 * thành NHÓM thu gọn được — như "Theo kho/phòng" của màn Thiết bị; không có thì là bảng chi tiết
 * phân trang ở máy chủ.
 */
export type MiniView = {
  key: string;
  label: string;
  /** Rê chuột lên nút chọn: cách xem này cho xem gì. */
  hint?: string;
  groupBy?: (row: any) => MiniGroup;
  lazy?: MiniLazyGroups;
  /** Lọc thêm của cách xem này — vd. tab Cán bộ: Giáo viên (`staffType=teacher`) · Cán bộ · Tất cả. */
  filters?: CrudFilter[];
  /** Bên cạnh số đếm trên dòng nhóm, tính từ các dòng của nhóm (vd. "205 HS"). */
  summary?: (rows: any[]) => ReactNode;
  /** Dòng tổng cuối bảng, tính từ mọi dòng (vd. "20 lớp · 830 HS"). */
  footer?: (rows: any[]) => ReactNode;
};

/**
 * Nhóm TẢI LƯỜI: danh sách nhóm đọc từ `resource` (khối nhà, loại phòng), mỗi nhóm chỉ hỏi máy
 * chủ SỐ ĐẾM (một dòng, đọc X-Total-Count); các dòng của nhóm chỉ tải khi mở nhóm ra. Nhóm "chưa
 * gán" lọc bằng `none` — cùng quy ước của `referenceFilter` ở máy chủ. Nhóm không có dòng nào ẩn đi.
 */
export type MiniLazyGroups = {
  /** Trường lọc gửi lên, vd. "building.id". */
  field: string;
  resource: string;
  /** Chỉ đọc nhóm của trường này (khối nhà) — loại phòng là danh mục chung thì không. */
  bySchool?: boolean;
  /** Lọc nhóm bằng tham số này = id trường (vd. `schoolId` của loại CSVC: loại của Sở + loại riêng của trường). */
  schoolParam?: string;
  noneLabel: string;
  icon?: (group: any | null) => ReactNode;
};

const ALL = "__all__";

/**
 * Bảng gọn trong khung chi tiết của màn Tổng quan: tìm kiếm, lọc theo cấp cha, nút Thêm, bấm
 * dòng mở hồ sơ, phân trang thật ở máy chủ.
 *
 * <p>`groupBy` vẽ dòng tiêu đề mỗi khi nhóm đổi (Khối 6 → 6A1…6A6, Khối 7 → …) — phân cấp ngay
 * trong bảng, không phải mở thêm màn. Nó dựa vào thứ tự máy chủ trả về, nên chỉ dùng cho resource
 * mà thứ tự mặc định đã đứng theo nhóm (lớp học: thứ tự = khối × 100 + số lớp).
 */
export function MiniTable({
  resource,
  path,
  filters,
  columns,
  createQuery,
  emptyText,
  onCreate,
  createResource,
  createLabel,
  onOpen,
  onDelete,
  onEdit,
  groupBy,
  groupSummary,
  facet,
  choice,
  sorters,
  extraActions,
  createMenu,
  tools,
  views,
  lead,
  top,
  viewsLabel,
  quickButtons,
  searchPlaceholder = "Tìm theo mã hoặc tên...",
  unit = "mục",
}: {
  /** Đứng ngay SAU ô tìm — ô chọn phần của tab gộp (Phòng · Khối nhà · Cơ sở), để nó không chiếm riêng một hàng. */
  lead?: ReactNode;
  /** Đứng ngay SAU ô tìm, cùng hàng công cụ — dải chọn danh sách luôn hiện sẵn (Phòng · Khối nhà · Cơ sở). Một hàng, không hai. */
  top?: ReactNode;
  /**
   * Có chữ dẫn ("Nhóm theo:") thì nút chọn cách xem dời sang cụm bên phải, cạnh nút thu gọn — để không ai đọc nó
   * thành một ô lọc đứng cạnh ô tìm.
   */
  viewsLabel?: string;
  /** Mỗi mục của `createMenu` thành một nút viền riêng cạnh nút Thêm (chữ ngắn `short`), thay cho mũi tên dính liền. */
  quickButtons?: boolean;
  searchPlaceholder?: string;
  /** Các cách xem, vẽ thành nút chuyển ở đầu bảng (vd. Theo khối nhà · Theo loại phòng · Chi tiết). */
  views?: MiniView[];
  /** Đơn vị đếm trên dòng nhóm, vd. "phòng". */
  unit?: string;
  /** Nút thêm bên cạnh nút Thêm mới — ví dụ "Thêm nhanh". */
  extraActions?: ReactNode;
  /** Cách thêm khác gộp vào mũi tên cạnh nút Thêm mới (vd. "Thêm nhanh nhiều khối nhà") — một nút thay vì hai. */
  createMenu?: { label: string; /** Chữ trên nút khi `quickButtons` (vd. "Thêm nhanh"); `label` thành chú thích. */ short?: string; icon?: ReactNode; onSelect: () => void }[];
  /** Nút phụ ở cụm bên phải, hiện với MỌI người xem được bảng (khác `extraActions` — chỉ người thêm được mới thấy). */
  tools?: ReactNode;
  resource: string;
  /** Đường dẫn gốc của resource, ví dụ "/rooms". */
  path: string;
  filters: CrudFilter[];
  columns: MiniColumn[];
  /** Query gắn vào trang thêm mới, để form biết đang thêm cho trường/phòng nào. */
  createQuery?: string;
  emptyText: string;
  /** Thêm bằng hộp thoại thay vì chuyển trang (danh mục ít trường). */
  /** Nhận khoá của chế độ xem đang chọn — để form thêm mới mở đúng loại đang xem. */
  onCreate?: (viewKey?: string) => void;
  /** Quyền của nút thêm tính theo resource khác (vd. thiết bị → phiếu nhập). */
  createResource?: string;
  /** Chữ trên nút thêm; là hàm thì đổi theo cách xem đang chọn (Nhân sự: Giáo viên → "Thêm giáo viên"). */
  createLabel?: string | ((viewKey?: string) => string);
  /** Mở chi tiết bằng hộp thoại thay vì chuyển sang trang chi tiết. */
  onOpen?: (row: any) => void;
  /** Xoá một dòng (hộp hỏi lại do bên gọi vẽ). Chỉ hiện khi có quyền `delete` trên resource. */
  onDelete?: (row: any) => void;
  /** Sửa một dòng (hộp thoại) — có thì menu "⋯" cuối dòng có thêm mục Sửa, theo quyền ghi của resource. */
  onEdit?: (row: any) => void;
  /** Nhóm của một dòng — dòng tiêu đề nhóm vẽ mỗi khi giá trị này đổi. */
  groupBy?: (row: any) => MiniGroup;
  /** Tóm tắt bên phải dòng tiêu đề nhóm, từ các dòng của nhóm trong trang. */
  groupSummary?: (rows: any[]) => ReactNode;
  facet?: MiniFacet;
  choice?: MiniChoice;
  /** Thứ tự máy chủ trả về — bảng có `groupBy` phân trang phải xếp theo nhóm để mỗi nhóm nằm liền một khúc. */
  sorters?: CrudSort[];
}) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [facetValue, setFacetValue] = useState(ALL);
  const [choiceValue, setChoiceValue] = useState(ALL);
  const [viewKey, setViewKey] = usePersistentState(`explorer.view.${resource}`, views?.[0]?.key ?? "");
  const view = views?.find((v) => v.key === viewKey) ?? views?.[0];
  const viewGroup = view?.groupBy;
  const lazy = view?.lazy;
  // Nhóm MỞ sẵn, chỉ nhớ nhóm người dùng đã đóng: mở màn là thấy ngay các phòng, không phải bấm từng khối nhà.
  const [shut, setShut] = useState<Set<string>>(new Set());
  useEffect(() => {
    setShut(new Set());
    setPage(1);
  }, [viewKey]);
  const viewFilters = view?.filters ?? [];
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  useEffect(() => setPage(1), [q, facetValue, choiceValue]);
  // Quyền đang tải thì chưa kết luận gì — trước đây "chưa có câu trả lời" bị coi là "không có quyền" và màn hiện
  // "Bạn không có quyền xem mục này" với người CÓ quyền (mạng chậm).
  const readCheck = useCan({ resource, action: "list" });
  const mayRead = readCheck.data?.can ?? false;
  const readPending = readCheck.data == null && readCheck.isLoading !== false;
  const mayCreate = useCan({ resource: createResource ?? resource, action: "create" }).data?.can ?? false;
  const mayEdit = useCan({ resource, action: "edit" }).data?.can ?? false;
  const mayDelete = useCan({ resource, action: "delete" }).data?.can ?? false;

  const { result: facetResult } = useList<any>({
    resource: facet?.resource ?? resource,
    filters: facet?.filters ?? [],
    pagination: { pageSize: 200 },
    sorters: [{ field: "sortOrder", order: "asc" }],
    queryOptions: { enabled: mayRead && !!facet },
  });
  const facetOptions = facetResult?.data ?? [];

  const { result, query } = useList<any>({
    resource,
    filters: [
      ...filters,
      ...viewFilters,
      ...(q ? [{ field: "q", operator: "contains" as const, value: q }] : []),
      ...(facet && facetValue !== ALL ? [{ field: facet.field, operator: "eq" as const, value: facetValue }] : []),
      ...(choice && choiceValue !== ALL ? [{ field: choice.field, operator: "eq" as const, value: choiceValue }] : []),
    ],
    pagination: { currentPage: page, pageSize },
    sorters,
    queryOptions: { enabled: mayRead && !lazy },
  });
  const rows = result?.data ?? [];
  const total = result?.total ?? 0;
  const offset = (page - 1) * pageSize;

  // Tóm tắt nhóm phải tính trên CẢ nhóm, không chỉ phần rơi vào trang này — "Khối 9 · 2 lớp"
  // ở cuối trang 1 là sai khi khối 9 có 6 lớp. Đọc một lần toàn bộ (vài trăm dòng một trường)
  // cùng bộ lọc, chỉ khi bảng có nhóm.
  const { result: allResult } = useList<any>({
    resource,
    filters: [
      ...filters,
      ...(q ? [{ field: "q", operator: "contains" as const, value: q }] : []),
      ...(facet && facetValue !== ALL ? [{ field: facet.field, operator: "eq" as const, value: facetValue }] : []),
      ...(choice && choiceValue !== ALL ? [{ field: choice.field, operator: "eq" as const, value: choiceValue }] : []),
    ],
    pagination: { currentPage: 1, pageSize: 500 },
    queryOptions: { enabled: mayRead && ((!!groupBy && !!groupSummary) || !!viewGroup || !!lazy) },
  });
  const allRows = useMemo(() => allResult?.data ?? [], [allResult]);

  // Nhóm của cách xem đang chọn, theo thứ tự xuất hiện đầu tiên — máy chủ đã xếp theo thứ tự hiển thị.
  const viewGroups = useMemo(() => {
    if (!viewGroup) return [];
    const map = new Map<string, { group: MiniGroup; rows: any[] }>();
    for (const row of allRows) {
      const g = viewGroup(row);
      if (!map.has(g.key)) map.set(g.key, { group: g, rows: [] });
      map.get(g.key)!.rows.push(row);
    }
    return [...map.values()];
  }, [allRows, viewGroup]);
  const toggle = (key: string) =>
    setCollapsed((c) => {
      const next = new Set(c);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const openRow = (row: any) => (onOpen ? onOpen(row) : navigate(`${path}/show/${row.id}`));
  // Cột cuối: menu "⋯" Xem / Sửa như bảng Thiết bị. Bấm trong ô không mở dòng.
  const actions = (row: any) => (
    <TableCell className="px-1" onClick={(e) => e.stopPropagation()}>
      <RowActions>
        <MenuItem icon={<Eye />} label="Xem" onClick={() => openRow(row)} />
        {mayEdit ? (
          <MenuItem icon={<Pencil />} label="Sửa" onClick={() => (onEdit ? onEdit(row) : navigate(`${path}/edit/${row.id}`))} />
        ) : null}
        {onDelete && mayDelete ? (
          <MenuItem icon={<Trash2 />} label="Xoá" danger onClick={() => onDelete(row)} />
        ) : null}
      </RowActions>
    </TableCell>
  );

  const schoolFilter = filters.find((f: any) => f.field === "school.id");
  const { result: lazyGroupsResult } = useList<any>({
    resource: lazy?.resource ?? resource,
    // `bySchool`: nhóm của riêng trường (khối nhà); `schoolParam`: danh mục chung + phần riêng của trường (loại CSVC).
    filters: !schoolFilter ? [] : lazy?.bySchool ? [schoolFilter]
      : lazy?.schoolParam ? [{ field: lazy.schoolParam, operator: "eq" as const, value: (schoolFilter as any).value }] : [],
    pagination: { pageSize: 200 },
    sorters: [{ field: "sortOrder", order: "asc" }],
    queryOptions: { enabled: mayRead && !!lazy },
  });
  const lazyGroups = useMemo(
    () => [...(lazyGroupsResult?.data ?? []).map((g: any) => ({ id: String(g.id), group: g })), { id: "none", group: null }],
    [lazyGroupsResult],
  );

  // Chế độ nhóm (khối nhà, loại): MỘT lần đọc các dòng của trường rồi chia nhóm tại đây — mỗi nhóm tự hỏi máy chủ
  // (đếm + tải) là vài trăm yêu cầu khi có vài chục loại. Nhóm rỗng không hiện; trong nhóm hiện dần từng trang.
  const lazyRows = useMemo(() => {
    const map = new Map<string, any[]>();
    if (!lazy) return map;
    const path = lazy.field.split(".");
    for (const row of allRows) {
      const v = path.reduce((o: any, k) => (o == null ? undefined : o[k]), row);
      const key = v == null ? "none" : String(v);
      map.set(key, [...(map.get(key) ?? []), row]);
    }
    return map;
  }, [lazy, allRows]);

  const addLabel = (typeof createLabel === "function" ? createLabel(view?.key) : createLabel) ?? "Thêm mới";

  const viewSwitch = views && views.length > 1 ? (
    // Viên màu chính như mọi dải chọn khác của app.
    <Segmented label="Chế độ xem" value={view?.key ?? views[0].key} onChange={setViewKey}
      options={views.map((v) => ({ value: v.key, label: v.label, hint: v.hint }))} />
  ) : null;

  if (!mayRead && readPending) {
    return (
      <div className="space-y-3">
        {top}
        {lead}
        <LoadingText className="px-1 py-6" />
      </div>
    );
  }

  if (!mayRead) {
    // Vẫn vẽ `lead`: không xem được phần này thì người dùng phải còn lối chuyển sang phần khác.
    return (
      <div className="space-y-3">
        {top}
        {lead}
        <p className="text-muted-foreground px-1 py-6 text-sm">Bạn không có quyền xem mục này.</p>
      </div>
    );
  }

  return (
    // Nằm trong khung cao cố định (`FillBox`) thì chỉ vùng dòng cuộn; trong khối thường thì cao theo nội dung.
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={searchPlaceholder} className="rounded-full pl-8 focus-visible:ring-0" />
        </div>
        {top}
        {lead}
        {views && views.length > 1 && !viewsLabel ? viewSwitch : null}
        {/* Mỗi điều kiện lọc một nút; hàng công cụ ở đây rộng nên nút có chữ (giá trị đang chọn), không chỉ biểu tượng. */}
        {facet ? (
          <IconFilter labeled icon={facet.icon} label={facet.label} allLabel={facet.allLabel}
            value={facetValue === ALL ? null : facetValue} onChange={(v) => setFacetValue(v ?? ALL)}
            groups={[{ items: facetOptions.map((o: any) => ({ key: String(o.id), label: o.name })) }]} />
        ) : null}
        {/* Ít lựa chọn (≤ 3): dải chọn "Tất cả · …" nhìn là biết đang lọc gì; nhiều hơn thì nút có chữ. */}
        {choice && !choice.menu && choice.options.length <= 3 ? (
          <Segmented label={`Lọc theo ${choice.label}`} value={choiceValue} onChange={setChoiceValue}
            options={[{ value: ALL, label: "Tất cả", hint: choice.allLabel }, ...choice.options.map((o) => ({ value: o.value, label: o.label }))]} />
        ) : choice ? (
          <IconFilter labeled icon={choice.icon} label={choice.label} allLabel={choice.allLabel}
            value={choiceValue === ALL ? null : choiceValue} onChange={(v) => setChoiceValue(v ?? ALL)}
            groups={[{ items: choice.options.map((o) => ({ key: o.value, label: o.label })) }]} />
        ) : null}
        {/* Cách nhóm: nút có chữ (cách đang dùng), đứng cạnh nút lọc sau ô tìm. Mặc định (cách đầu tiên) thì nút không
            báo là đang đổi. */}
        {views && views.length > 1 && viewsLabel ? (
          // Một nút cho cả cách nhóm lẫn thu gọn / mở các nhóm (phương án A, 11/2026): nút biểu tượng thu gọn đứng
          // riêng cạnh nút Thêm thì không rõ là gì.
          <IconFilter labeled icon={null} label={viewsLabel} prefix={lazy || viewGroup ? "Nhóm" : undefined} value={view?.key ?? views[0].key} baseline={views[0].key}
            onChange={(v) => setViewKey(v ?? views[0].key)}
            groups={[{ items: views.map((v) => ({ key: v.key, label: v.label })) }]}
            actions={lazy ? [shut.size > 0
              ? { key: "open", label: "Mở tất cả", onSelect: () => setShut(new Set()) }
              : { key: "shut", label: "Thu gọn tất cả", onSelect: () => setShut(new Set(lazyGroups.map((g) => g.id))) }]
              : viewGroup && viewGroups.length > 1 ? [collapsed.size < viewGroups.length
                ? { key: "shut", label: "Thu gọn tất cả", onSelect: () => setCollapsed(new Set(viewGroups.map((g) => g.group.key))) }
                : { key: "open", label: "Mở tất cả", onSelect: () => setCollapsed(new Set()) }]
              : undefined} />
        ) : null}
        <div className="ms-auto flex items-center gap-2">
            {views && views.length > 1 && viewsLabel ? null : lazy ? (
          <Tooltip>
            <TooltipTrigger asChild>
              {shut.size > 0 ? (
                <Button type="button" variant="outline" size="icon" aria-label="Mở tất cả" onClick={() => setShut(new Set())}>
                  <UnfoldVertical />
                </Button>
              ) : (
                <Button type="button" variant="outline" size="icon" aria-label="Thu gọn tất cả"
                  onClick={() => setShut(new Set(lazyGroups.map((g) => g.id)))}>
                  <FoldVertical />
                </Button>
              )}
            </TooltipTrigger>
            <TooltipContent>{shut.size > 0 ? "Mở tất cả" : "Thu gọn tất cả"}</TooltipContent>
          </Tooltip>
        ) : viewGroup && viewGroups.length > 1 ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  {collapsed.size < viewGroups.length ? (
                    <Button type="button" variant="outline" size="icon" aria-label="Thu gọn tất cả"
                      onClick={() => setCollapsed(new Set(viewGroups.map((g) => g.group.key)))}>
                      <FoldVertical />
                    </Button>
                  ) : (
                    <Button type="button" variant="outline" size="icon" aria-label="Mở tất cả" onClick={() => setCollapsed(new Set())}>
                      <UnfoldVertical />
                    </Button>
                  )}
                </TooltipTrigger>
                <TooltipContent>{collapsed.size < viewGroups.length ? "Thu gọn tất cả" : "Mở tất cả"}</TooltipContent>
              </Tooltip>
            ) : null}
          {tools}
          {mayCreate && quickButtons ? (
            <>
              {extraActions}
              {/* Cách thêm khác là nút viền RIÊNG, đứng tách khỏi nút chính — không còn mũi tên dính liền để bấm hụt. */}
              {(createMenu ?? []).map((m) => (
                <Tooltip key={m.label}>
                  <TooltipTrigger asChild>
                    <Button type="button" variant="outline" size="default" onClick={m.onSelect}>
                      {m.icon}
                      {m.short ?? m.label}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{m.label}</TooltipContent>
                </Tooltip>
              ))}
              <Button size="default" onClick={() => (onCreate ? onCreate(view?.key) : navigate(`${path}/create${createQuery ?? ""}`))}>
                <Plus />
                {addLabel}
              </Button>
            </>
          ) : mayCreate ? (
            <>
              {extraActions}
              {/* Nút tách đôi: MỘT dải màu chung cho cả hai nửa (nền ở khung bọc, hai nút trong suốt) — mỗi nửa tự
                  tô gradient thì nửa phải bắt đầu lại từ màu đầu dải, thành hai màu lệch nhau. */}
              <div className={cn("flex", createMenu?.length && "bg-brand-gradient shadow-xs overflow-hidden rounded-full")}>
                <Button size="default" className={cn(createMenu?.length && "rounded-none bg-transparent bg-none hover:bg-white/10")}
                  onClick={() => (onCreate ? onCreate(view?.key) : navigate(`${path}/create${createQuery ?? ""}`))}>
                  <Plus />
                  {addLabel}
                </Button>
                {createMenu?.length ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" className="border-primary-foreground/30 rounded-none border-0 border-s bg-transparent bg-none hover:bg-white/10" aria-label="Cách thêm khác">
                        <ChevronDown />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {createMenu.map((m) => (
                        <DropdownMenuItem key={m.label} onSelect={m.onSelect}>
                          {m.icon}
                          {m.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto [&>[data-slot=table-container]]:overflow-visible [&_tbody_tr:last-child]:border-b rounded-lg border border-border">
        {/* Bề rộng cột CỐ ĐỊNH (table-fixed): cột có cỡ riêng giữ cỡ, cột còn lại chia đều — lọc, đổi trang không làm
            cột co giãn theo dòng đang hiện. Chữ dài hơn ô thì cắt "…". */}
        <Table className="min-w-[48rem] table-fixed [&_td]:truncate">
          <TableHeader sticky>
            <TableRow>
              <TableHead className="w-12 text-center">STT</TableHead>
              {columns.map((c) => (
                <TableHead key={c.header} className={c.className}>
                  {c.header}
                </TableHead>
              ))}
              <TableHead className="w-12"><span className="sr-only">Thao tác</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length + 2}>
                  <Skeleton className="h-6 w-full" />
                </TableCell>
              </TableRow>
            ) : lazy ? (
              lazyGroupsResult === undefined || allResult === undefined ? (
                <TableRow>
                  <TableCell colSpan={columns.length + 2}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ) : allRows.length === 0 ? (
                <TableEmpty colSpan={columns.length + 2} title={emptyText} />
              ) : (
                lazyGroups.filter(({ id }) => lazyRows.has(id)).map(({ id, group }) => (
                  <LazyGroup
                    key={id}
                    rows={lazyRows.get(id) ?? []}
                    label={group?.name ?? lazy.noneLabel}
                    icon={lazy.icon?.(group)}
                    unit={unit}
                    columns={columns}
                    open={!shut.has(id)}
                    onToggle={() =>
                      setShut((o) => {
                        const next = new Set(o);
                        if (next.has(id)) next.delete(id);
                        else next.add(id);
                        return next;
                      })
                    }
                    onOpenRow={openRow}
                    actions={actions}
                  />
                ))
              )
            ) : viewGroup ? (
              allResult === undefined || allRows.length === 0 ? (
                <TableEmpty colSpan={columns.length + 2} loading={allResult === undefined} title={emptyText} />
              ) : (
                viewGroups.map(({ group, rows: groupRows }) => {
                  const shut = collapsed.has(group.key);
                  return (
                    <Fragment key={group.key}>
                      {/* Cùng kiểu dòng nhóm của "Theo kho/phòng" ở màn Thiết bị: nền đậm hơn dòng con,
                          biểu tượng màu thương hiệu, số đếm là nhãn nổi nhất. */}
                      <TableRow className={cn("hover:bg-muted/60 cursor-pointer select-none", !shut && "bg-muted hover:bg-muted/70")} onClick={() => toggle(group.key)}
                        aria-expanded={!shut} title={shut ? "Mở danh sách" : "Thu gọn"}>
                        <TableCell colSpan={columns.length + 2} className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <ChevronRight className={cn("text-muted-foreground size-4 shrink-0 transition-transform", !shut && "rotate-90")} />
                            {group.icon ? <span className="text-primary [&_svg]:size-4">{group.icon}</span> : null}
                            <span className="text-[0.9375rem] font-semibold">{group.label}</span>
                            <span className="bg-primary/12 text-primary rounded-full px-2.5 py-0.5 text-[0.8125rem] font-semibold tabular-nums">
                              {groupRows.length} {unit}
                            </span>
                            {view?.summary ? <span className="text-muted-foreground text-[0.8125rem] tabular-nums">{view.summary(groupRows)}</span> : null}
                          </div>
                        </TableCell>
                      </TableRow>
                      {shut
                        ? null
                        : groupRows.map((row, i) => (
                            <TableRow key={row.id} className={cn("cursor-pointer", LIFT_ROW)} onClick={() => openRow(row)}>
                              <TableCell className="text-muted-foreground text-center tabular-nums">{i + 1}</TableCell>
                              {columns.map((c) => (
                                <TableCell key={c.header} className={c.className}>
                                  {c.cell(row)}
                                </TableCell>
                              ))}
                              {actions(row)}
                            </TableRow>
                          ))}
                    </Fragment>
                  );
                })
              )
            ) : rows.length === 0 ? (
              <TableEmpty colSpan={columns.length + 2} title={emptyText} />
            ) : (
              rows.map((row, i) => {
                const group = groupBy?.(row);
                const startsGroup = group && (i === 0 || groupBy!(rows[i - 1]).key !== group.key);
                // Nhóm bắt đầu từ trang trước: dòng tiêu đề vẫn hiện để biết đang ở khối nào, ghi "(tiếp)".
                const continued = startsGroup && i === 0 && page > 1 && allRows.length > 0
                  && allRows.findIndex((r) => groupBy!(r).key === group.key) < offset;
                return (
                  <Fragment key={row.id}>
                    {startsGroup ? (
                      <TableRow className="bg-surface-subtle hover:bg-surface-subtle">
                        <TableCell colSpan={columns.length + 2} className="py-1.5">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold">
                              {group.label}
                              {continued ? <span className="text-muted-foreground font-normal"> (tiếp)</span> : null}
                            </span>
                            {groupSummary && allRows.length ? (
                              <span className="text-muted-foreground text-xs">
                                {groupSummary(allRows.filter((r) => groupBy!(r).key === group.key))}
                              </span>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : null}
                    <TableRow
                      className={cn("cursor-pointer", LIFT_ROW)}
                      onClick={() => (onOpen ? onOpen(row) : navigate(`${path}/show/${row.id}`))}
                    >
                      <TableCell className="text-muted-foreground text-center tabular-nums">{offset + i + 1}</TableCell>
                      {columns.map((c) => (
                        <TableCell key={c.header} className={c.className}>
                          {c.cell(row)}
                        </TableCell>
                      ))}
                      {actions(row)}
                    </TableRow>
                  </Fragment>
                );
              })
            )}
          </TableBody>
          {viewGroup && view?.footer && allRows.length ? (
            <TableFooter>
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length + 2} className="tabular-nums">{view.footer(allRows)}</TableCell>
              </TableRow>
            </TableFooter>
          ) : null}
        </Table>
      </div>
      {!viewGroup && !lazy && total > 10 ? (
        <DataTablePagination
          currentPage={page}
          pageCount={Math.max(1, Math.ceil(total / pageSize))}
          setCurrentPage={setPage}
          pageSize={pageSize}
          setPageSize={(n) => {
            setPageSize(n);
            setPage(1);
          }}
          total={total}
        />
      ) : null}
    </div>
  );
}

/**
 * Một nhóm tải lười: dòng tiêu đề hỏi máy chủ SỐ ĐẾM bằng một trang một dòng; các dòng của nhóm
 * chỉ tải khi mở. Nhóm đếm ra 0 thì không vẽ — "Chưa phân loại · 0 phòng" chỉ là nhiễu.
 */
function LazyGroup({ rows, label, icon, unit, columns, open, onToggle, onOpenRow, actions }: {
  rows: any[];
  label: ReactNode;
  icon?: ReactNode;
  unit: string;
  columns: MiniColumn[];
  open: boolean;
  onToggle: () => void;
  onOpenRow: (row: any) => void;
  actions: (row: any) => ReactNode;
}) {
  // Hiện dần trong nhóm: GROUP_PAGE dòng một lần, "Xem thêm" mở tiếp — nhóm vài trăm hạng mục không đổ ra một lượt.
  const [limit, setLimit] = useState(GROUP_PAGE);
  const shown = rows.slice(0, limit);
  const more = rows.length - shown.length;
  return (
    <>
      <TableRow className={cn("hover:bg-muted/60 cursor-pointer select-none", open && "bg-muted hover:bg-muted/70")} onClick={onToggle}
        aria-expanded={open} title={open ? "Thu gọn" : "Mở danh sách"}>
        <TableCell colSpan={columns.length + 2} className="px-3 py-2.5">
          <div className="flex items-center gap-2">
            <ChevronRight className={cn("text-muted-foreground size-4 shrink-0 transition-transform", open && "rotate-90")} />
            {icon ? <span className="text-primary [&_svg]:size-4">{icon}</span> : null}
            <span className="text-[0.9375rem] font-semibold">{label}</span>
            <span className="bg-primary/12 text-primary rounded-full px-2.5 py-0.5 text-[0.8125rem] font-semibold tabular-nums">
              {`${rows.length} ${unit}`}
            </span>
          </div>
        </TableCell>
      </TableRow>
      {open
        ? shown.map((row, i) => (
            <TableRow key={row.id} className={cn("cursor-pointer", LIFT_ROW)} onClick={() => onOpenRow(row)}>
              <TableCell className="text-muted-foreground text-center tabular-nums">{i + 1}</TableCell>
              {columns.map((c) => (
                <TableCell key={c.header} className={c.className}>
                  {c.cell(row)}
                </TableCell>
              ))}
              {actions(row)}
            </TableRow>
          ))
        : null}
      {open && more > 0 ? (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={columns.length + 2} className="py-1.5 text-center">
            <Button type="button" variant="ghost" size="sm" onClick={() => setLimit((n) => n + GROUP_PAGE)}>
              {`Xem thêm ${Math.min(more, GROUP_PAGE)} · còn ${more}`}
            </Button>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

/** Số dòng mỗi lần đọc trong một nhóm (chế độ nhóm theo khối nhà / loại). */
const GROUP_PAGE = 10;

/** Một dòng của menu "⋯": chữ + biểu tượng, bấm xong đóng menu. */
function MenuItem({ icon, label, onClick, danger }: { icon: ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  const menu = useRowActionsMenu();
  return (
    <Button type="button" variant="ghost" size="sm" className={cn(ROW_ACTION_ITEM, danger && "text-destructive-text hover:text-destructive-text")}
      onClick={() => {
        menu?.close();
        onClick();
      }}>
      {icon}
      {label}
    </Button>
  );
}
