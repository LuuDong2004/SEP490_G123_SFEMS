import { useList } from "@refinedev/core";
import { useEffect } from "react";

import { ChoiceWithNote } from "@/shared/components/form/choice-with-note";
import { FormHint } from "@/shared/components/form/help-hint";
import { FormItem, FormLabel } from "@/shared/ui/form";
import { OTHER_ACQUISITION_KEY } from "@/domains/equipment/types";

type Method = { id: number; code: string; name: string; systemKey?: string | null };
type Value = { id?: number | null; code?: string | null; name?: string | null } | null | undefined;

/**
 * Hình thức mua sắm (danh mục ngắn: tập trung, đấu thầu, chỉ định thầu, mua trực tiếp, khác) — một ô chọn; "Khác" ghi
 * rõ ngay trong ô (`ChoiceWithNote`), không có ô "Ghi rõ hình thức mua sắm" riêng. Dùng ở đầu phiếu ghi tăng và ở
 * chi tiết từng dòng.
 */
export function AcquisitionChoice({ label, hint, value, onChange, note, onNoteChange, clearable, exclude }: {
  /** Mã hình thức không chọn được với nguồn hình thành đang chọn (`OriginRule.excludedAcquisitionMethods`). */
  exclude?: string[];
  label: string;
  hint?: string;
  value: Value;
  onChange: (value: Method | null) => void;
  note: string | null | undefined;
  onNoteChange: (note: string) => void;
  clearable?: boolean;
}) {
  const { result } = useList<Method>({ resource: "acquisition_methods", pagination: { currentPage: 1, pageSize: 50 } });
  const methods = (result?.data ?? []).filter((m) => !exclude?.includes(m.code));
  // Đổi nguồn hình thành làm hình thức đang chọn không còn hợp (tự mua → "Mua sắm tập trung"): bỏ chọn, không để máy chủ từ chối.
  const stale = !!value?.code && !!exclude?.includes(value.code);
  useEffect(() => {
    if (stale) onChange(null);
  }, [stale, onChange]);
  // Giá trị đang có mà danh mục chưa tải xong vẫn phải có mục của nó — Radix không vẽ được giá trị thiếu mục.
  const options = [
    ...(value?.id && !methods.some((m) => m.id === value.id) ? [{ value: String(value.id), label: value.name ?? "…" }] : []),
    ...methods.map((m) => ({ value: String(m.id), label: m.name })),
  ];
  const other = methods.find((m) => m.systemKey === OTHER_ACQUISITION_KEY);
  return (
    <FormItem>
      <FormLabel>{label}</FormLabel>
      {hint ? <FormHint>{hint}</FormHint> : null}
      <ChoiceWithNote value={value?.id ? String(value.id) : ""} options={options} otherValue={other ? String(other.id) : "__"}
        clearable={clearable} placeholder="Vui lòng chọn hình thức mua sắm" notePlaceholder="Hình thức khác: ghi rõ"
        onChange={(v) => onChange(v ? methods.find((m) => String(m.id) === v) ?? null : null)}
        note={note} onNoteChange={onNoteChange} />
    </FormItem>
  );
}
