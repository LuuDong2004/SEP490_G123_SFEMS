import { lowerLabel } from "@/shared/lib/label";
import { useList } from "@refinedev/core";
import { Plus, X } from "lucide-react";
import type { Control } from "react-hook-form";

import { POSITION_LABELS } from "@/domains/staff/types";
import { StaffPicker, type StaffPrefer, type StaffRow } from "@/shared/components/catalog/staff-picker";
import { cn } from "@/shared/lib/utils";
import { FormHint } from "@/shared/components/form/help-hint";
import { FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Một người trên một dòng: "Họ tên — Chức vụ". Chữ cũ gõ tay (ngăn bằng dấu chấm phẩy) cũng tách được. */
const parse = (text: unknown): string[] =>
  String(text ?? "").split(/[\n;]+/).map((s) => s.trim()).filter(Boolean);

const lineOf = (r: StaffRow) => {
  const position = r.position ? (POSITION_LABELS[r.position] ?? r.position) : null;
  return position ? `${r.name} — ${position}` : r.name;
};

/**
 * Ô chọn NHIỀU cán bộ của trường (tổ kiểm kê, hội đồng…) từ danh sách nhân sự trong hệ thống — không gõ tay
 * họ tên. Mỗi người là một thẻ nhỏ, bấm "Thêm người" mở hộp chọn cán bộ dùng chung.
 *
 * <p>Giá trị của ô vẫn là CHỮ, mỗi người một dòng "Họ tên — Chức vụ": cột lưu là một ô chữ và bản in đọc
 * thẳng nó, nên thành phần ghi trên biên bản không đổi khi về sau cán bộ đổi chức vụ hay nghỉ việc.
 */
export function StaffListField({ control, name, label, schoolId, hint, prefer, className, required, mustFill }: {
  control: Control<any>;
  name: string;
  label: string;
  /** Trường của phiếu — chưa có thì ô khoá, nhắc chọn trường trước. */
  schoolId?: number | null;
  hint?: string;
  prefer?: StaffPrefer;
  /** Mặc định MỘT cột như mọi ô chọn; thêm người thì ô cao lên, mỗi người một dòng — không trải ngang hai cột. */
  className?: string;
  /** Hiện dấu * — ô phải có người khi TRÌNH phiếu (máy chủ kiểm), lưu nháp vẫn được để trống. */
  required?: boolean;
  /** Câu báo khi để trống — có thì ô bắt buộc ngay lúc LƯU, không chỉ lúc trình. */
  mustFill?: string;
}) {
  const { result, query } = useList<StaffRow>({
    resource: "staff",
    filters: schoolId ? [{ field: "school.id", operator: "eq", value: schoolId }, { field: "active", operator: "eq", value: true }] : [],
    pagination: { pageSize: 500 },
    queryOptions: { enabled: !!schoolId },
  });
  const rows = result?.data ?? [];

  return (
    <FormField
      control={control}
      name={name}
      rules={mustFill ? { validate: (v: string | null | undefined) => parse(v).length > 0 || mustFill } : undefined}
      render={({ field }) => {
        const people = parse(field.value);
        const write = (list: string[]) => field.onChange(list.join("\n"));
        // Người đã có trong danh sách không hiện lại trong hộp chọn.
        const left = rows.filter((r) => !people.includes(lineOf(r)));
        return (
          // `min-w-0`: trong lưới, ô chọn này mặc định rộng theo nội dung — chữ "Vui lòng chọn …" dài
          // đẩy nó tràn đè lên ô bên cạnh thay vì cắt bớt.
          <FormItem className={cn("min-w-0", className)}>
            <FormLabel required={required || undefined}>{label}</FormLabel>
            {hint ? <FormHint>{hint}</FormHint> : null}
            <div className="bg-field flex min-h-9 min-w-0 flex-wrap items-center gap-1.5 rounded-md border px-2 py-1">
              {people.map((p, i) => (
                <span key={`${p}-${i}`} className="bg-card flex max-w-full items-center gap-1 rounded-md border py-0.5 ps-2 pe-1 text-sm">
                  <span className="truncate">{p}</span>
                  <button type="button" aria-label={`Bỏ ${p}`} className="text-muted-foreground hover:text-destructive-text shrink-0 rounded-sm p-0.5"
                    onClick={() => write(people.filter((_, at) => at !== i))}>
                    <X className="size-3.5" />
                  </button>
                </span>
              ))}
              <StaffPicker
                rows={left}
                loading={query?.isLoading && !!schoolId}
                value={null}
                label={`người vào ${label.toLowerCase()}`}
                prefer={prefer}
                onChange={(row) => { if (row) write([...people, lineOf(row)]); }}
                trigger={(open) => (
                  <button type="button" disabled={!schoolId} onClick={open}
                    className="text-muted-foreground hover:text-primary flex h-7 min-w-0 items-center gap-1 rounded-md px-1.5 text-sm disabled:opacity-60">
                    <Plus className="size-3.5 shrink-0" />
                    <span className="truncate">{!schoolId ? "Chọn trường trước" : people.length ? "Thêm người" : `Vui lòng chọn ${lowerLabel(label)}`}</span>
                  </button>
                )}
              />
            </div>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
