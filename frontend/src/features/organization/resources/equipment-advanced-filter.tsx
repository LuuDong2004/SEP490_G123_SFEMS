import { BookMarked, ChevronRight, CircleDot, HeartPulse } from "lucide-react";
import { useState } from "react";

import { FilterButton, FilterCheck as Box, FilterField, FilterOption as Option } from "@/shared/components/data-table/filter-popover";
import { cn } from "@/shared/lib/utils";
import { ASSET_STATUS_LABELS, EQUIPMENT_CONDITION_LABELS } from "@/domains/equipment/types";

type Group = { label: string; values: string[] };

/** Nhóm trạng thái — cùng cách chia với các cột số của bảng tổng hợp. */
const STATUS_GROUPS: Group[] = [
  { label: "Dùng được", values: ["IN_STOCK", "IN_USE", "BORROWED", "MAINTAINING", "TRANSFERRING"] },
  { label: "Hỏng, đang sửa", values: ["BROKEN", "REPAIRING", "WARRANTY", "UNREPAIRABLE"] },
  { label: "Chờ ghi giảm", values: ["MISSING", "PENDING_LIQUIDATION", "PENDING_DESTRUCTION"] },
  { label: "Đã ra khỏi hệ thống", values: ["LIQUIDATED", "DESTROYED", "LOST", "USED_UP", "NOT_DELIVERED"] },
];
const CONDITIONS = Object.keys(EQUIPMENT_CONDITION_LABELS);

export type AdvancedFilter = {
  statuses: string[];
  conditions: string[];
  /** in: trong danh mục của Sở; out: ngoài danh mục (trường tự thêm); trống: cả hai. */
  catalogScope?: "in" | "out" | null;
};

/**
 * Bộ lọc nâng cao của màn Thiết bị — gọn như một menu: TRẠNG THÁI là một cột, chia bốn nhóm (đầu nhóm có chấm màu và
 * ô tích chọn / bỏ cả nhóm), dài thì cuộn trong hộp; TÌNH TRẠNG hai cột. Áp cho cả ba chế độ xem. Bảng tổng hợp chỉ
 * đếm tài sản còn trên sổ, nên nhóm "Đã ra khỏi sổ" chỉ ra dòng ở Theo tài sản.
 */
export function EquipmentAdvancedFilter({ value, onChange }: { value: AdvancedFilter; onChange: (v: AdvancedFilter) => void }) {
  const count = (value.statuses.length ? 1 : 0) + (value.conditions.length ? 1 : 0) + (value.catalogScope ? 1 : 0);
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const setStatuses = (statuses: string[]) => onChange({ ...value, statuses });
  // Nhóm mở / đóng: mặc định chỉ mở nhóm đang có mục được chọn — hộp lọc gọn, thấy ngay đang lọc gì.
  const [open, setOpen] = useState<Set<string>>(() =>
    new Set(STATUS_GROUPS.filter((g) => g.values.some((v) => value.statuses.includes(v))).map((g) => g.label)));
  const flip = (label: string) => setOpen((o) => {
    const next = new Set(o);
    if (next.has(label)) next.delete(label); else next.add(label);
    return next;
  });
  return (
    // Nút có chữ "Bộ lọc" (không chỉ biểu tượng phễu): người mới nhìn là biết chỗ lọc; số trên nút = điều kiện đang bật.
    <FilterButton count={count} contentClassName="w-[19rem]" onClear={() => onChange({ statuses: [], conditions: [], catalogScope: null })}>
      <FilterField label={value.statuses.length ? `Trạng thái · ${value.statuses.length}` : "Trạng thái"}
        icon={CircleDot} active={value.statuses.length > 0}>
        <div className="-mx-2 max-h-[17rem] overflow-y-auto pe-1 [scrollbar-width:thin]">
          {STATUS_GROUPS.map((g) => {
            const picked = g.values.filter((v) => value.statuses.includes(v)).length;
            const state = picked === g.values.length ? true : picked ? "some" : false;
            const expanded = open.has(g.label);
            return (
              <div key={g.label} className="grid">
                {/* Ô tích = chọn / bỏ cả nhóm; mũi tên (và tên nhóm) = mở / thu gọn danh sách bên trong. */}
                <div className="hover:bg-accent flex h-7 items-center gap-1 rounded-md ps-2 pe-1 text-[0.8125rem] font-semibold">
                  <button type="button" role="checkbox" aria-checked={state === "some" ? "mixed" : state} aria-label={`Chọn cả nhóm ${g.label}`}
                    onClick={() => setStatuses(state === true
                      ? value.statuses.filter((v) => !g.values.includes(v))
                      : [...new Set([...value.statuses, ...g.values])])}>
                    <Box state={state} />
                  </button>
                  <button type="button" aria-expanded={expanded} onClick={() => flip(g.label)}
                    className="flex h-full min-w-0 flex-1 items-center gap-2 ps-1 text-left">
                    <span className="flex-1 truncate">{g.label}</span>
                    {picked ? <span className="text-muted-foreground text-xs font-normal tabular-nums">{picked}/{g.values.length}</span> : null}
                    <ChevronRight className={cn("text-muted-foreground size-4 shrink-0 transition-transform duration-200", expanded && "rotate-90")} />
                  </button>
                </div>
                {expanded && g.values.map((v) => (
                  <Option key={v} className="ps-8" on={value.statuses.includes(v)}
                    label={ASSET_STATUS_LABELS[v as keyof typeof ASSET_STATUS_LABELS] ?? v}
                    onToggle={() => setStatuses(toggle(value.statuses, v))} />
                ))}
              </div>
            );
          })}
        </div>
      </FilterField>
      <FilterField label={value.conditions.length ? `Tình trạng · ${value.conditions.length}` : "Tình trạng"}
        icon={HeartPulse} active={value.conditions.length > 0}>
        <div className="-mx-2 grid grid-cols-2">
          {CONDITIONS.map((v) => (
            <Option key={v} on={value.conditions.includes(v)}
              label={EQUIPMENT_CONDITION_LABELS[v as keyof typeof EQUIPMENT_CONDITION_LABELS] ?? v}
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
