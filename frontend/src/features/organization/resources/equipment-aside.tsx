import type { CrudFilter } from "@refinedev/core";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { BookOpen, Folder, LayoutGrid } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { kyInstance } from "@/shared/api/data";
import { AsyncCombobox } from "@/shared/components/form/async-combobox";
import { useToolbarFilterSlot } from "@/shared/components/views/list-view";
import { usePersistentState } from "@/shared/hooks/use-persistent-state";
import { usePerspective } from "@/shared/hooks/use-perspective";
import { cn } from "@/shared/lib/utils";
import type { EquipmentSummaryResponse, EquipmentSummaryRow } from "@/domains/equipment/types";
import { EquipmentAdvancedFilter, type AdvancedFilter } from "./equipment-advanced-filter";
import { hueColor, hueOf } from "./equipment-colors";

/** Một mục đang chọn ở cột trái. `id = null` là nhóm "Chưa phân loại" / "Chưa gắn môn". */
type Pick = { id: number | null; name: string };

type Selection = {
  type: Pick | null;
  subject: Pick | null;
  school: Pick | null;
  advanced: AdvancedFilter;
};

const EMPTY: Selection = { type: null, subject: null, school: null, advanced: { statuses: [], conditions: [] } };

/** Lựa chọn → bộ lọc, cùng tên tham số với `/api/equipment` và `/api/equipment/summary`. */
function toFilters(sel: Selection): CrudFilter[] {
  const out: CrudFilter[] = [];
  if (sel.type) out.push({ field: "type", operator: "eq", value: sel.type.id ?? "none" });
  if (sel.subject) out.push({ field: "subject", operator: "eq", value: sel.subject.id ?? "none" });
  if (sel.school?.id != null) out.push({ field: "school.id", operator: "eq", value: sel.school.id });
  // Tên tham số riêng (`assetStatus`, không phải `status`): bảng Theo tài sản đã dùng `status` cho lối
  // "chỉ xem đã ra khỏi sổ", hai thứ phải cộng dồn được.
  if (sel.advanced.statuses.length) out.push({ field: "assetStatus", operator: "eq", value: sel.advanced.statuses.join(",") });
  if (sel.advanced.conditions.length) out.push({ field: "condition", operator: "eq", value: sel.advanced.conditions.join(",") });
  return out;
}

/** Bộ lọc thành tham số truy vấn của `/api/equipment/summary`. */
export function summaryParams(filters: CrudFilter[], extra: Record<string, string> = {}) {
  const out: Record<string, string> = { ...extra };
  for (const f of filters) {
    if ("field" in f && f.value != null && f.value !== "") out[f.field] = String(f.value);
  }
  return out;
}

/**
 * Cột trái của màn Thiết bị: lọc nhanh theo LOẠI thiết bị và MÔN HỌC. Số cạnh mỗi mục là số hồ sơ thiết bị
 * thật trong phạm vi đang xem (cùng nguồn với bảng: `/api/equipment/summary`), chỉ hiện loại / môn đang có
 * thiết bị. Chọn loại và môn cộng dồn ("thiết bị dạy học của môn Vật lí").
 *
 * Ô chọn trường (với tài khoản thấy nhiều trường) và nút Bộ lọc nâng cao được đưa lên hàng công cụ của
 * bảng, ngay sau ô tìm, bằng portal — trạng thái lọc sống ở đây nhưng chỗ đặt nằm trong bảng bên phải.
 *
 * Lựa chọn nhớ trong phiên của tab: mở một tài sản rồi quay lại không mất bộ lọc.
 */
export function EquipmentAside({ onFiltersChange }: { onFiltersChange: (filters: CrudFilter[]) => void }) {
  const [sel, setSel] = usePersistentState<Selection>("equipment.aside", EMPTY);
  const { perspective } = usePerspective();

  useEffect(() => {
    onFiltersChange(toFilters(sel));
    // Chỉ theo lựa chọn — hàm của trang cha đổi mỗi lần vẽ.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(sel)]);

  const slot = useToolbarFilterSlot();
  const toolbar = slot
    ? createPortal(
        <>
          {/* Tài khoản của một trường chỉ có một trường để chọn — không cần ô này. */}
          {perspective !== "school" ? (
            <div className="w-64 max-w-full">
              <AsyncCombobox<{ id: number; name: string }>
                resource="schools"
                value={sel.school?.id ?? null}
                onChange={(id) => setSel({ ...sel, school: id == null ? null : { id, name: "" } })}
                labelOf={(x) => x.name}
                fallbackLabel={sel.school?.name || undefined}
                placeholder="Mọi trường"
                clearable
                clearLabel="Mọi trường"
                searchPlaceholder="Tìm trường…"
              />
            </div>
          ) : null}
          <EquipmentAdvancedFilter value={sel.advanced} onChange={(advanced) => setSel({ ...sel, advanced })} />
        </>,
        slot,
      )
    : null;

  // Số trên cột trái chỉ theo PHẠM VI (trường) — không theo chính lựa chọn loại / môn, để danh sách mục
  // không co lại khi bấm.
  const search = summaryParams(toFilters({ ...EMPTY, school: sel.school }), { by: "catalog" });
  const { data } = useQuery({
    queryKey: ["equipment", "summary", "facets", search],
    placeholderData: keepPreviousData,
    queryFn: () => kyInstance.get("equipment/summary", { searchParams: search }).json<EquipmentSummaryResponse>(),
  });
  const rows = data?.rows ?? [];

  // Phạm vi chưa có thiết bị nào: không có gì để lọc — không vẽ cột, bảng giãn hết bề ngang.
  if (data && rows.length === 0 && !sel.type && !sel.subject) return <>{toolbar}</>;

  // Hai nhóm LỌC CHÉO: số cạnh một loại là số thiết bị của loại đó TRONG MÔN đang chọn, và ngược lại. Mục về
  // 0 thì mờ và không bấm được — vẫn thấy cả bộ lọc, nhưng không chọn ra được một bảng trống.
  const inType = (r: EquipmentSummaryRow) => !sel.type || (r.type_id ?? null) === sel.type.id;
  const inSubject = (r: EquipmentSummaryRow) => !sel.subject || (r.subject_id ?? null) === sel.subject.id;
  const total = rows.filter((r) => inType(r) && inSubject(r)).reduce((n, r) => n + Number(r.records ?? 0), 0);
  const typeOf = (list: EquipmentSummaryRow[]) => facets(list, (r) => r.type_id, (r) => r.type, "Chưa phân loại");
  const subjectOf = (list: EquipmentSummaryRow[]) => facets(list, (r) => r.subject_id, (r) => r.subject, "Chưa gắn môn");
  const types = cross(typeOf(rows), typeOf(rows.filter(inSubject)));
  const subjects = cross(subjectOf(rows), subjectOf(rows.filter(inType)));
  const same = (a: Pick | null, f: Facet) => !!a && a.id === f.id;

  return (
    <aside className="bg-card shadow-e1 flex min-h-0 flex-col overflow-hidden rounded-lg border max-lg:max-h-[28rem] lg:h-full">
      {toolbar}
      <div className="shrink-0 border-b px-2 py-[13px]">
        <AsideRow
          root
          selected={!sel.type && !sel.subject}
          onClick={() => setSel({ ...sel, type: null, subject: null })}
          icon={<LayoutGrid />}
          label="Tất cả thiết bị"
          count={total}
        />
      </div>
      <div className="scrollbar-fade min-h-0 flex-1 space-y-1 overflow-y-auto p-2 [scrollbar-gutter:stable]">
        <p className="text-overline text-muted-foreground px-2 pt-1 pb-0.5">Loại thiết bị</p>
        {types.map((f) => (
          <AsideRow
            key={`t${f.id}`}
            selected={same(sel.type, f)}
            onClick={() => setSel({ ...sel, type: same(sel.type, f) ? null : { id: f.id, name: f.name } })}
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
                selected={same(sel.subject, f)}
                onClick={() => setSel({ ...sel, subject: same(sel.subject, f) ? null : { id: f.id, name: f.name } })}
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
          <p className="text-muted-foreground px-2 py-6 text-center text-sm">Chưa có thiết bị nào.</p>
        ) : null}
      </div>
    </aside>
  );
}

type Facet = { id: number | null; name: string; qty: number };

/**
 * Gộp theo một khoá (loại / môn); khoá rỗng thành mục "Chưa …" ở cuối. Đếm SỐ HỒ SƠ thiết bị, không cộng số
 * lượng: một loại gồm nhiều nhóm khác đơn vị tính (bộ, tờ, hộp) thì tổng số lượng không có nghĩa.
 */
function facets(
  rows: EquipmentSummaryRow[],
  id: (r: EquipmentSummaryRow) => number | null,
  name: (r: EquipmentSummaryRow) => string | null,
  none: string,
): Facet[] {
  const map = new Map<string, Facet>();
  for (const r of rows) {
    const key = String(id(r) ?? "none");
    const f = map.get(key) ?? { id: id(r), name: name(r) ?? none, qty: 0 };
    f.qty += Number(r.records ?? 0);
    map.set(key, f);
  }
  return [...map.values()].sort((a, b) => (a.id == null ? 1 : b.id == null ? -1 : a.name.localeCompare(b.name, "vi")));
}

/** Danh sách mục đủ (theo phạm vi), số đếm lấy theo lựa chọn của nhóm kia. */
function cross(all: Facet[], narrowed: Facet[]): Facet[] {
  const qty = new Map(narrowed.map((f) => [String(f.id), f.qty]));
  return all.map((f) => ({ ...f, qty: qty.get(String(f.id)) ?? 0 }));
}

/** Một dòng của cột lọc. */
function AsideRow({
  selected,
  onClick,
  icon,
  label,
  count,
  dim,
  disabled,
  root,
}: {
  selected: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: ReactNode;
  count?: number;
  /** Nhạt đi — mục "Chưa gắn môn", để mắt lướt qua. */
  dim?: boolean;
  /** Mờ và không bấm được — mục không có thiết bị nào trong lựa chọn của nhóm kia. */
  disabled?: boolean;
  /** Dòng "Tất cả" trên đầu: chữ đậm hơn. */
  root?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled && !selected}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2 text-left text-sm transition-colors disabled:cursor-not-allowed",
        root ? "h-9" : "h-8",
        selected ? "bg-primary/10 text-primary font-medium" : disabled ? "opacity-45" : "hover:bg-muted/70",
        dim && !selected && "text-muted-foreground",
        root && !selected && "font-medium",
      )}
    >
      <span className={cn("shrink-0 [&_svg]:size-4", selected ? "text-primary" : "text-muted-foreground")}>{icon}</span>
      <span className="min-w-0 flex-1 truncate" title={typeof label === "string" ? label : undefined}>
        {label}
      </span>
      {count != null ? (
        <span className="text-muted-foreground text-xs font-normal tabular-nums">{count.toLocaleString("vi-VN")}</span>
      ) : null}
    </button>
  );
}
