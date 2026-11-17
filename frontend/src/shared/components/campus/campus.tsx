import type { BaseRecord, HttpError } from "@refinedev/core";
import type { UseTableReturnType } from "@refinedev/react-table";
import type { ColumnFiltersState } from "@tanstack/react-table";
import { MapPin } from "lucide-react";

import { campusKindLabel } from "@/domains/facility/types";
import { IconFilter } from "@/shared/components/data-table/icon-filter";
import { CAMPUS_KIND_VARIANTS } from "@/shared/lib/status-variants";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { CAMPUS_FILTER_FIELD, effectiveCampus, kindOf, useCampusOptions, useCampusScope, usePinnedCampusId, type CampusLike } from "@/shared/components/campus/use-campus";
import { usePerspective } from "@/shared/hooks/use-perspective";

const ALL = "all";

/** Tên cơ sở + nhãn loại nhỏ (Trường chính / Phân hiệu / Điểm trường). */
export function CampusName({ campus, className }: { campus: CampusLike | null | undefined; className?: string }) {
  if (!campus) return <span className="text-muted-foreground">—</span>;
  const kind = kindOf(campus);
  return (
    <span className={cn("flex min-w-0 items-center gap-1.5", className)}>
      <span className="min-w-0 truncate" title={campus.name ?? undefined}>{campus.name}</span>
      <Badge size="sm" variant={CAMPUS_KIND_VARIANTS[kind]} className="shrink-0">
        {campusKindLabel({ primaryCampus: kind === "main", branch: kind === "branch" })}
      </Badge>
    </span>
  );
}

/** Ô Cơ sở của danh sách phiếu: một cơ sở thì tên + loại; nhiều cơ sở (phiếu chạm cả hai) thì nối tên. */
export function CampusesCell({ campuses }: { campuses: CampusLike[] | null | undefined }) {
  if (!campuses?.length) return <span className="text-muted-foreground">—</span>;
  if (campuses.length === 1) return <CampusName campus={campuses[0]} />;
  const names = campuses.map((c) => c.name ?? String(c.id)).join(", ");
  return <span className="block min-w-0 truncate" title={names}>{names}</span>;
}

/** Ô Cơ sở của bảng CSVC: cơ sở thực của dòng, kèm loại. */
export function CampusCell({ campus }: { campus: CampusLike | null | undefined }) {
  const { campuses } = useCampusScope();
  return <CampusName campus={effectiveCampus(campus, campuses)} />;
}

/**
 * Nút lọc Cơ sở trên hàng công cụ (một nút một điều kiện). Ghi qua `columnFilters` như mọi ô lọc của bảng; ẩn khi
 * tài khoản đã bị giới hạn trong một cơ sở hoặc trường chỉ có một cơ sở.
 */
export function CampusTableFilter<T extends BaseRecord>({ table }: { table: UseTableReturnType<T, HttpError> }) {
  const { show, campuses } = useCampusScope();
  if (!show) return null;
  const { setColumnFilters, getState } = table.reactTable;
  const entries = getState().columnFilters as unknown as { id: string; value: unknown }[];
  const active = entries.find((e) => e.id === CAMPUS_FILTER_FIELD)?.value;
  return (
    <IconFilter
      icon={<MapPin />}
      label="cơ sở"
      allLabel="Mọi cơ sở"
      groups={[{ items: campuses.map((c) => ({ key: String(c.id), label: c.name ?? String(c.id) })) }]}
      value={active != null && active !== "" ? String(active) : null}
      onChange={(v) =>
        setColumnFilters((prev) => {
          const others = (prev as unknown as { id: string }[]).filter((e) => e.id !== CAMPUS_FILTER_FIELD);
          return (v == null ? others : [...others, { id: CAMPUS_FILTER_FIELD, operator: "eq", value: v }]) as ColumnFiltersState;
        })
      }
    />
  );
}

/**
 * Ô chọn "Phạm vi" của tài khoản trường: "Cả trường" hoặc một cơ sở còn dùng. `value` = id cơ sở hoặc `null`.
 * `current` là phạm vi đang lưu — vẫn hiện được khi cơ sở đó không còn trong danh sách.
 */
export function CampusScopeSelect({ value, onChange, schoolId, current, disabled, id }: {
  value: number | null;
  onChange: (value: number | null) => void;
  schoolId?: number | null;
  current?: { id: number; name?: string | null } | null;
  disabled?: boolean;
  id?: string;
}) {
  const campuses = useCampusOptions(schoolId);
  const options = current && !campuses.some((c) => c.id === current.id) ? [...campuses, current] : campuses;
  return (
    <Select value={value == null ? ALL : String(value)} onValueChange={(v) => onChange(v === ALL ? null : Number(v))}
      disabled={disabled}>
      <SelectTrigger id={id} className="w-full max-w-[20rem]"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>Cả trường</SelectItem>
        {options.map((c) => (
          <SelectItem key={c.id} value={String(c.id)}>
            {c.name}{kindOf(c) === "main" ? " (trường chính)" : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Nhãn phạm vi trên danh sách tài khoản: "Cả trường" (trung tính) hoặc tên cơ sở. */
export function CampusScopeBadge({ campus }: { campus: { name?: string | null } | null | undefined }) {
  return campus ? <Badge variant="info">{campus.name}</Badge> : <Badge variant="neutral">Cả trường</Badge>;
}

/**
 * Nút lọc Cơ sở của báo cáo / tổng hợp (`campusId` gửi lên máy chủ). Chỉ hiện với tài khoản KHÔNG bị giới hạn khi phạm
 * vi là MỘT trường có từ hai cơ sở: tài khoản trường (trường mình) hoặc Sở / UBND đang chọn một trường (`schoolId`).
 * Tài khoản một cơ sở không có nút — máy chủ luôn tính trên cơ sở của họ. Không chọn = cả trường (số nộp Sở).
 */
export function CampusFilterButton({ schoolId, value, onChange, labeled }: {
  schoolId?: number | null;
  value: number | null;
  onChange: (value: number | null) => void;
  labeled?: boolean;
}) {
  const { perspective } = usePerspective();
  const pinned = usePinnedCampusId();
  const school = perspective === "school";
  const enabled = pinned == null && (school || schoolId != null);
  const campuses = useCampusOptions(school ? null : schoolId, enabled);
  if (!enabled || campuses.length < 2) return null;
  return (
    <IconFilter
      icon={<MapPin />}
      label="cơ sở"
      allLabel="Cả trường"
      labeled={labeled}
      prefix="Cơ sở"
      groups={[{ items: campuses.map((c) => ({ key: String(c.id), label: c.name ?? String(c.id) })) }]}
      value={value != null && campuses.some((c) => c.id === value) ? String(value) : null}
      onChange={(v) => onChange(v == null ? null : Number(v))}
    />
  );
}

/** Nhãn "Cơ sở: <tên>" ở đầu màn số liệu cho tài khoản bị giới hạn trong một cơ sở; không giới hạn thì không vẽ gì. */
export function PinnedCampusBadge({ className }: { className?: string }) {
  const pinned = usePinnedCampusId();
  const { perspective } = usePerspective();
  const campuses = useCampusOptions(null, pinned != null && perspective === "school");
  if (pinned == null) return null;
  const name = campuses.find((c) => c.id === pinned)?.name;
  if (!name) return null;
  return <Badge variant="info" className={className}>Cơ sở: {name}</Badge>;
}
