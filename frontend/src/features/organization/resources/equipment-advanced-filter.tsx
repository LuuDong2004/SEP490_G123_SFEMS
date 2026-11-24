import { BookMarked, CircleDot, HeartPulse } from "lucide-react";

import { FilterButton, FilterField, FilterOption as Option } from "@/shared/components/data-table/filter-popover";
import { ASSET_STATUS_LABELS, EQUIPMENT_CONDITION_LABELS } from "@/domains/equipment/types";

/**
 * Trạng thái lọc được: chỉ hai trạng thái hệ thống thật sự có (trưởng nhóm 24/11/2026) — thiết bị vào sổ qua phiếu
 * ghi tăng là Trong kho, giao về phòng là Đang dùng.
 */
export const FILTER_STATUSES = ["IN_STOCK", "IN_USE"] as const;
const CONDITIONS = Object.entries(EQUIPMENT_CONDITION_LABELS);

export type AdvancedFilter = {
  statuses: string[];
  conditions: string[];
  /** in: trong danh mục của Sở; out: ngoài danh mục (trường tự thêm); trống: cả hai. */
  catalogScope?: "in" | "out" | null;
};

/**
 * Bộ lọc nâng cao của màn Thiết bị — gọn như một menu: TRẠNG THÁI (Trong kho, Đang dùng), TÌNH TRẠNG, DANH MỤC, mỗi
 * mục hai cột ô tích. Áp cho cả ba chế độ xem.
 */
export function EquipmentAdvancedFilter({ value, onChange }: { value: AdvancedFilter; onChange: (v: AdvancedFilter) => void }) {
  const statuses = value.statuses.filter((s) => (FILTER_STATUSES as readonly string[]).includes(s));
  const count = (statuses.length ? 1 : 0) + (value.conditions.length ? 1 : 0) + (value.catalogScope ? 1 : 0);
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  return (
    // Nút có chữ "Bộ lọc" (không chỉ biểu tượng phễu): người mới nhìn là biết chỗ lọc; số trên nút = điều kiện đang bật.
    <FilterButton count={count} contentClassName="w-[19rem]" onClear={() => onChange({ statuses: [], conditions: [], catalogScope: null })}>
      <FilterField label={statuses.length ? `Trạng thái · ${statuses.length}` : "Trạng thái"}
        icon={CircleDot} active={statuses.length > 0}>
        <div className="-mx-2 grid grid-cols-2">
          {FILTER_STATUSES.map((v) => (
            <Option key={v} on={value.statuses.includes(v)} label={ASSET_STATUS_LABELS[v] ?? v}
              onToggle={() => onChange({ ...value, statuses: toggle(value.statuses, v) })} />
          ))}
        </div>
      </FilterField>
      <FilterField label={value.conditions.length ? `Tình trạng · ${value.conditions.length}` : "Tình trạng"}
        icon={HeartPulse} active={value.conditions.length > 0}>
        <div className="-mx-2 grid grid-cols-2">
          {CONDITIONS.map(([v, label]) => (
            <Option key={v} on={value.conditions.includes(v)} label={label}
              onToggle={() => onChange({ ...value, conditions: toggle(value.conditions, v) })} />
          ))}
        </div>
      </FilterField>
      <FilterField label={value.catalogScope ? `Danh mục · ${value.catalogScope === "in" ? "trong" : "ngoài"}` : "Danh mục"}
        icon={BookMarked} active={!!value.catalogScope}>
        <div className="-mx-2 grid grid-cols-2">
          {([["in", "Trong danh mục"], ["out", "Ngoài danh mục"]] as const).map(([v, label]) => (
            <Option key={v} on={value.catalogScope === v} label={label}
              onToggle={() => onChange({ ...value, catalogScope: value.catalogScope === v ? null : v })} />
          ))}
        </div>
      </FilterField>
    </FilterButton>
  );
}
