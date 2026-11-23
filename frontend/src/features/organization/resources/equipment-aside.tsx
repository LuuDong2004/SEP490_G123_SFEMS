import { useCustom, type CrudFilter } from "@refinedev/core";
import { BookOpen, ChevronRight, Folder, LayoutGrid, School as SchoolIcon } from "lucide-react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { API_URL } from "@/shared/api/constants";
import { kyInstance } from "@/shared/api/data";
import { AsyncCombobox } from "@/shared/components/form/async-combobox";
import { useToolbarFilterSlot } from "@/shared/components/views/list-view";
import { usePersistentState } from "@/shared/hooks/use-persistent-state";
import { cn } from "@/shared/lib/utils";
import type { BodyStats } from "@/features/organization/explorer/body-grid";
import { hueColor, hueOf } from "./equipment-colors";
import { EquipmentAdvancedFilter, type AdvancedFilter } from "./equipment-advanced-filter";

/**
 * Cột trái của màn Thiết bị: cây NHÓM THIẾT BỊ và cây ĐƠN VỊ (cơ quan quản lý → trường),
 * như màn Thiết bị của Jmix. Một danh sách ba trăm tài sản trải phẳng không trả lời
 * được "trường này có gì" hay "máy chiếu ở đâu"; bấm một nút trên cây thì có ngay.
 *
 * <p>Chọn một nhóm là chọn cả nhánh (`catalogTree` — server tự gom nhóm con cháu);
 * chọn một cơ quan là mọi trường nó quản lý (`schoolBody`); chọn một trường là
 * `school.id`. Hai cây lọc độc lập và cộng dồn: "máy chiếu CỦA trường X".
 *
 * <p>Lựa chọn nhớ theo phiên của tab, như chỗ đang đứng ở màn Tổng quan trường.
 * Tài khoản chỉ thấy một trường thì không có cây đơn vị — chỉ còn một nút để bấm.
 */
type Picked = { id: number | null; name: string; kind: "body" | "school" };
/** Nút đang chọn ở tab Thiết bị: một LOẠI (thư mục) hoặc một mặt hàng. `id = null` ở loại = "Chưa phân loại". */
type CatalogPick = { kind?: "type" | "item"; id: number | null; name: string };
type Selection = {
  catalog: CatalogPick | null;
  unit: Picked | null;
  subject?: { id: number | null; name: string } | null;
  /** Bộ lọc nâng cao (nút "Bộ lọc" trên hàng công cụ): trạng thái, tình trạng — chọn được nhiều. */
  advanced?: AdvancedFilter;
};


const EMPTY: Selection = { catalog: null, unit: null };

function toFilters(sel: Selection): CrudFilter[] {
  const out: CrudFilter[] = [];
  // Lựa chọn lưu từ bản trước không có `kind` — khi đó nó là một mặt hàng.
  if (sel.catalog?.kind === "type") {
    out.push({ field: "catalogType", operator: "eq", value: sel.catalog.id ?? "none" });
  } else if (sel.catalog?.id != null) {
    out.push({ field: "catalogTree", operator: "eq", value: sel.catalog.id });
  }
  if (sel.subject) out.push({ field: "subject", operator: "eq", value: sel.subject.id ?? "none" });
  if (sel.unit?.kind === "school") out.push({ field: "school.id", operator: "eq", value: sel.unit.id });
  if (sel.unit?.kind === "body") out.push({ field: "schoolBody", operator: "eq", value: sel.unit.id ?? "none" });
  // Tên tham số riêng (`assetStatus`, không phải `status`): bảng Theo tài sản đã dùng `status` cho nút "Đã ra khỏi sổ".
  if (sel.advanced?.statuses.length) out.push({ field: "assetStatus", operator: "eq", value: sel.advanced.statuses.join(",") });
  if (sel.advanced?.conditions.length) out.push({ field: "condition", operator: "eq", value: sel.advanced.conditions.join(",") });
  if (sel.advanced?.catalogScope) out.push({ field: "catalogScope", operator: "eq", value: sel.advanced.catalogScope });
  return out;
}

export function EquipmentAside({ onFiltersChange }: { onFiltersChange: (filters: CrudFilter[]) => void }) {
  const [stored, setSel] = usePersistentState<Selection>("equipment.aside", EMPTY);
  // Bản cũ lưu lựa chọn một MẶT HÀNG trên cây — cột này giờ chỉ lọc theo loại / môn; mặt
  // hàng mở từ dòng của bảng tổng hợp. Bỏ lựa chọn cũ đó thay vì lọc ngầm.
  // Cây Đơn vị cũng đã bỏ (lọc theo trường nằm trên hàng công cụ): lựa chọn "cả một cơ quan" lưu từ trước
  // không còn chỗ nào hiện ra, nên cũng bỏ.
  const sel: Selection = {
    ...stored,
    catalog: stored.catalog && stored.catalog.kind !== "type" ? null : stored.catalog,
    unit: stored.unit?.kind === "school" ? stored.unit : null,
  };

  useEffect(() => {
    onFiltersChange(toFilters(sel));
    // Chỉ theo lựa chọn — hàm của trang cha đổi mỗi lần vẽ.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(sel)]);

  const { result: bodyResult } = useCustom<BodyStats[]>({ url: `${API_URL}/school_overview/bodies`, method: "get" });
  const bodies = useMemo(
    () => (Array.isArray(bodyResult?.data) ? (bodyResult.data as BodyStats[]) : []),
    [bodyResult],
  );
  const schoolCount = bodies.reduce((n, b) => n + b.schools, 0);
  // Tài khoản thấy nhiều trường mới có gì để lọc theo trường.
  const showUnits = schoolCount > 1;

  // Ô lọc theo MỘT trường nằm trên hàng công cụ của bảng, cạnh ô tìm — cùng chỗ với các danh sách khác.
  // Trạng thái lọc sống ở cột này nên ô được đưa lên đó bằng portal; chỗ đặt xuất hiện sau khi bảng vẽ xong
  // và đổi theo chế độ xem — `useToolbarFilterSlot` báo mỗi khi nó có / mất.
  const slot = useToolbarFilterSlot();
  const advanced = sel.advanced ?? { statuses: [], conditions: [] };
  const toolbar = slot
    ? createPortal(
        <>
        {showUnits ? (
        <div className="contents">
          <AsyncCombobox<{ id: number; name: string }>
            resource="schools"
            value={sel.unit?.kind === "school" ? sel.unit.id : null}
            onChange={(id) => setSel({ ...sel, unit: id == null ? null : { id, name: "", kind: "school" } })}
            labelOf={(x) => x.name}
            fallbackLabel={sel.unit?.kind === "school" ? sel.unit.name || undefined : undefined}
            placeholder="Lọc theo trường · đang xem mọi trường"
            clearLabel="Mọi trường"
            searchPlaceholder="Tìm trường…"
            icon={<SchoolIcon />}
          />
        </div>
        ) : null}
        <EquipmentAdvancedFilter value={advanced} onChange={(a) => setSel({ ...sel, advanced: a })} />
        </>,
        slot,
      )
    : null;

  // Phạm vi đang xem chưa có thiết bị nào (trường mới, chưa ghi tăng / nhập dữ liệu): cây không có gì để lọc —
  // không vẽ cột, bảng giãn hết bề ngang. Ô trường và Bộ lọc vẫn lên hàng công cụ (đổi sang trường khác được).
  // Cùng khoá truy vấn với `Facets` nên không gọi thêm lần nào; đang tải thì chưa ẩn để cột không nháy.
  const unitSearch: Record<string, string> = { by: "catalog" };
  for (const f of toFilters({ catalog: null, unit: sel.unit })) if ("field" in f && f.value != null) unitSearch[f.field] = String(f.value);
  const { data: unitData } = useQuery({
    queryKey: ["equipment", "summary", "facets", unitSearch],
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) => kyInstance.get("equipment/summary", { signal,  searchParams: unitSearch }).json<{ rows: SummaryRow[] }>(),
  });
  if (unitData && unitData.rows.length === 0 && !sel.catalog && !sel.subject) return <>{toolbar}</>;

  return (
    <aside className="bg-card shadow-e1 flex min-h-0 flex-col overflow-hidden rounded-lg border max-lg:max-h-[28rem] lg:h-full">
      {toolbar}
      <Facets
        query=""
        unitFilters={toFilters({ catalog: null, unit: sel.unit })}
        type={sel.catalog}
        subject={sel.subject ?? null}
        onType={(c) => setSel({ ...sel, catalog: c })}
        onSubject={(sj) => setSel({ ...sel, subject: sj })}
        onClear={() => setSel({ ...sel, catalog: null, subject: null })}
      />
    </aside>
  );
}

/**
 * Một dòng của cây. Cột mũi tên chỉ có khi cây THẬT SỰ có nhánh (`branchy`) — một
 * danh sách phẳng mà vẫn chừa chỗ mũi tên thì mọi dòng bị đẩy lệch sang phải.
 */
export function AsideRow({
  depth = 0,
  branchy = false,
  open,
  hasChildren,
  onToggle,
  selected,
  onClick,
  icon,
  label,
  count,
  dim,
  disabled,
  root,
}: {
  depth?: number;
  branchy?: boolean;
  open?: boolean;
  hasChildren?: boolean;
  onToggle?: () => void;
  selected: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: ReactNode;
  count?: number;
  /** Nhạt đi — đơn vị chưa có thiết bị nào, để mắt lướt qua. */
  dim?: boolean;
  /** Mờ và không bấm được — mục không có thiết bị nào trong lựa chọn của nhóm kia. */
  disabled?: boolean;
  /** Dòng "Tất cả" trên đầu: chữ đậm hơn, không thụt. */
  root?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-0.5 rounded-lg pe-2 text-sm transition-colors",
        root ? "h-9" : "h-8",
        selected
          ? "bg-primary/10 text-primary font-medium"
          : disabled ? "opacity-45" : "hover:bg-muted/70",
        dim && !selected && "text-muted-foreground",
        root && !selected && "font-medium",
      )}
      style={{ paddingInlineStart: `${6 + depth * 16}px` }}
    >
      {branchy ? (
        <button
          type="button"
          onClick={onToggle}
          tabIndex={hasChildren ? 0 : -1}
          aria-label={hasChildren ? (open ? "Thu gọn" : "Mở rộng") : undefined}
          className={cn(
            "text-muted-foreground hover:text-foreground flex size-5 shrink-0 items-center justify-center rounded",
            !hasChildren && "invisible",
          )}
        >
          <ChevronRight className={cn("size-3.5 transition-transform", open && "rotate-90")} />
        </button>
      ) : null}
      <button
        type="button"
        onClick={onClick}
        disabled={disabled && !selected}
        className="flex h-full min-w-0 flex-1 items-center gap-2 ps-1 text-left disabled:cursor-not-allowed"
      >
        <span className={cn("shrink-0 [&_svg]:size-4", selected ? "text-primary" : "text-muted-foreground")}>{icon}</span>
        <span className="min-w-0 flex-1 truncate" title={typeof label === "string" ? label : undefined}>
          {label}
        </span>
        {count != null ? (
          <span className="text-muted-foreground text-xs font-normal tabular-nums">{count.toLocaleString("vi-VN")}</span>
        ) : null}
      </button>
    </div>
  );
}

/**
 * Biểu tượng theo kiểu trình quản lý tệp: nhóm là thư mục vàng (mở/đóng theo nhánh), thiết bị
 * là hộp nhỏ nhạt màu. Màu vàng/sắc thương hiệu giữ nguyên cả khi dòng đang chọn — chữ và nền
 * đã nói "đang chọn", đổi màu biểu tượng nữa thì mất dấu nó là thư mục hay lá.
 */


const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").toLowerCase();

type SummaryRow = { type_id: number | null; type: string | null; subject_id: number | null; subject: string | null; total: number; records: number };
type Facet = { id: number | null; name: string; qty: number };

/**
 * Gộp theo một khoá (loại / môn); khoá rỗng thành một mục "Chưa …" ở cuối. Đếm SỐ HỒ SƠ thiết bị
 * (một tài sản = 1, một lô vật tư = 1), không cộng số lượng: một loại gồm nhiều mặt hàng khác đơn
 * vị (kg, bình, cái) thì tổng số lượng không nghĩa gì — "Hóa học 86,75" là cộng kg với bình.
 */
function facets(rows: SummaryRow[], id: (r: SummaryRow) => number | null, name: (r: SummaryRow) => string | null, none: string): Facet[] {
  const map = new Map<string, Facet>();
  for (const r of rows) {
    const key = String(id(r) ?? "none");
    const f = map.get(key) ?? { id: id(r), name: name(r) ?? none, qty: 0 };
    f.qty += Number(r.records ?? 0);
    map.set(key, f);
  }
  return [...map.values()].sort((a, b) => (a.id == null ? 1 : b.id == null ? -1 : a.name.localeCompare(b.name, "vi")));
}

/**
 * Lọc nhanh theo LOẠI thiết bị và theo MÔN HỌC — thay cho cây loại → mặt hàng: cây lặp lại
 * đúng các dòng của bảng tổng hợp, và số trên nhánh là số mặt hàng trong danh mục chứ không
 * phải số thiết bị. Ở đây số cạnh mỗi mục là SỐ LƯỢNG thiết bị thật trong phạm vi (cùng
 * nguồn với bảng: `/equipment/summary`), và chỉ hiện loại / môn đang có thiết bị. Chọn loại
 * và môn cộng dồn ("máy móc của môn Tin học"), và số của nhóm này tính trong lựa chọn của nhóm
 * kia; mặt hàng thì mở từ dòng của bảng.
 */
function Facets({
  query, unitFilters, type, subject, onType, onSubject, onClear,
}: {
  query: string;
  unitFilters: CrudFilter[];
  type: CatalogPick | null;
  subject: { id: number | null; name: string } | null;
  onType: (c: CatalogPick | null) => void;
  onSubject: (s: { id: number | null; name: string } | null) => void;
  onClear: () => void;
}) {
  const search: Record<string, string> = { by: "catalog" };
  for (const f of unitFilters) if ("field" in f && f.value != null) search[f.field] = String(f.value);
  const { data } = useQuery({
    queryKey: ["equipment", "summary", "facets", search],
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) => kyInstance.get("equipment/summary", { signal,  searchParams: search }).json<{ rows: SummaryRow[] }>(),
  });
  const rows = data?.rows ?? [];
  // Hai nhóm LỌC CHÉO nhau: số cạnh một loại là số thiết bị của loại đó TRONG MÔN đang chọn, và
  // ngược lại. Danh sách mục vẫn đủ (mọi loại / môn đang có thiết bị) và giữ nguyên thứ tự; mục
  // về 0 trong lựa chọn của nhóm kia thì MỜ và không bấm được — không biến mất, để người dùng vẫn
  // thấy cả bộ lọc, nhưng không chọn ra được một bảng trống.
  const inType = (r: SummaryRow) => !type || type.kind !== "type" || (r.type_id ?? null) === type.id;
  const inSubject = (r: SummaryRow) => !subject || (r.subject_id ?? null) === subject.id;
  const total = rows.filter((r) => inType(r) && inSubject(r)).reduce((n, r) => n + Number(r.records ?? 0), 0);
  const needle = fold(query.trim());
  const cross = (all: Facet[], narrowed: Facet[]) => {
    const qty = new Map(narrowed.map((f) => [String(f.id), f.qty]));
    return all
      .map((f) => ({ ...f, qty: qty.get(String(f.id)) ?? 0 }))
      .filter((f) => !needle || fold(f.name).includes(needle));
  };
  const typeOf = (list: SummaryRow[]) => facets(list, (r) => r.type_id, (r) => r.type, "Chưa phân loại");
  const subjectOf = (list: SummaryRow[]) => facets(list, (r) => r.subject_id, (r) => r.subject, "Chưa gắn môn");
  const types = cross(typeOf(rows), typeOf(rows.filter(inSubject)));
  const subjects = cross(subjectOf(rows), subjectOf(rows.filter(inType)));

  return (
    <>
      {/* Dải đầu cùng chiều cao với hàng công cụ của bảng bên phải (62px: nút chuyển chế độ xem cao hơn ô tìm một chút),
          nên "Tất cả thiết bị" nằm ngang ô tìm kiếm. */}
      <div className="shrink-0 border-b px-2 py-[13px]">
        <AsideRow root selected={!type && !subject} onClick={onClear} icon={<LayoutGrid />} label="Tất cả thiết bị" count={total} />
      </div>
      {/* `scrollbar-gutter: stable` giữ sẵn chỗ cho thanh cuộn: mở một nhánh làm cây dài ra,
          thanh cuộn hiện lên mà không bóp hẹp nội dung, nên các dòng không xê dịch. */}
      <div className="scrollbar-fade min-h-0 flex-1 space-y-1 overflow-y-auto p-2 [scrollbar-gutter:stable]">
      <p className="text-overline text-muted-foreground px-2 pt-1 pb-0.5">Loại thiết bị</p>
      {types.map((f) => (
        <AsideRow
          key={`t${f.id}`}
          selected={type?.id === f.id && type?.kind === "type"}
          onClick={() => onType(type?.id === f.id && type?.kind === "type" ? null : { kind: "type", id: f.id, name: f.name })}
          icon={<Folder className="text-gold-500 fill-gold-500/20" />}
          label={f.name}
          count={f.qty}
          disabled={f.qty === 0}
        />
      ))}
      {subjects.length ? (
        <>
          <p className="text-overline text-muted-foreground px-2 pt-3 pb-0.5">Môn học</p>
          {subjects.map((f) => (
            <AsideRow
              key={`s${f.id}`}
              selected={subject?.id === f.id && !!subject}
              onClick={() => onSubject(subject && subject.id === f.id ? null : { id: f.id, name: f.name })}
              icon={<BookOpen style={f.id == null ? undefined : { color: hueColor(hueOf(f.name)) }} />}
              label={f.name}
              count={f.qty}
              dim={f.id == null}
              disabled={f.qty === 0}
            />
          ))}
        </>
      ) : null}
      {!types.length && !subjects.length ? (
        <p className="text-muted-foreground px-2 py-6 text-center text-sm">{needle ? "Không có mục nào khớp." : "Chưa có thiết bị nào."}</p>
      ) : null}
    </div>
    </>
  );
}
