import { FormHint } from "@/shared/components/form/help-hint";
import {
  FormControl,
  FormItem,
  FormLabel,
} from "@/shared/ui/form";
import { AsyncCombobox } from "@/shared/components/form/async-combobox";
import type { DepartmentOfEducation } from "@/domains/department-of-education/types";
import { MANAGING_BODY_TYPE_SHORT_LABELS } from "@/domains/department-of-education/types";
import type { ManagingBodySummary } from "@/domains/user/types";

/**
 * Cơ quan quản lý mà tài khoản thuộc về — Sở hoặc UBND.
 *
 * <p>Đi song song với {@code SchoolPicker}, không thay thế: người của trường
 * điền trường, người của Sở hoặc UBND điền cơ quan, quản trị viên bỏ trống cả
 * hai. Không ràng buộc "chỉ một trong hai", vì một người kiêm nhiệm cả hai
 * phía là chuyện có thật.
 *
 * <p>Đây là ô quyết định phạm vi dữ liệu của tài khoản cấp Sở và cấp UBND.
 * Không có nó thì chính sách "UBND chỉ thấy trường trên địa bàn mình" không có
 * gì để so sánh, và tài khoản UBND sẽ nhìn thấy một màn hình trống.
 *
 * <p>Danh sách có 169 cơ quan (1 Sở + 168 UBND phường/xã) nên phải tìm được
 * chứ không thể cuộn: dùng {@link AsyncCombobox} tìm ở server, tải theo trang.
 */

export type ManagingBodyRef = { id: number | null };

type ManagingBodyPickerProps = {
  managingBody: ManagingBodyRef | null | undefined;
  onManagingBodyChange: (value: ManagingBodyRef) => void;
  /** Cơ quan của chính bản ghi, trên form sửa. Nhãn dự phòng. */
  currentManagingBody?: ManagingBodySummary | null;
  /** Bắt buộc chọn: dấu *, không có dòng "Không thuộc cơ quan nào". */
  required?: boolean;
  error?: string | null;
};

/** Loại đi kèm tên, vì "Sở GD&ĐT" và "UBND Phường X" nằm chung một danh sách. */
function labelOf(body: { type: string; name: string }) {
  const type = MANAGING_BODY_TYPE_SHORT_LABELS[body.type as keyof typeof MANAGING_BODY_TYPE_SHORT_LABELS];
  // Tên đã mở đầu bằng loại ("UBND Phường X", "Sở GD&ĐT") thì không thêm tiền tố — tránh "UBND · UBND Phường X".
  return type && !body.name.toLowerCase().startsWith(type.toLowerCase()) ? `${type} · ${body.name}` : body.name;
}

export function ManagingBodyPicker({
  managingBody,
  onManagingBodyChange,
  currentManagingBody,
  required,
  error,
}: ManagingBodyPickerProps) {
  const fallback = currentManagingBody ? labelOf(currentManagingBody) : null;

  return (
    <FormItem>
      <FormLabel required={required || undefined}>Cơ quan quản lý</FormLabel>
      <FormControl>
        <AsyncCombobox<DepartmentOfEducation>
          resource="departments_of_education"
          value={managingBody?.id ?? null}
          onChange={(id) => onManagingBodyChange({ id })}
          labelOf={labelOf}
          fallbackLabel={fallback}
          placeholder="Vui lòng chọn cơ quan"
          searchPlaceholder="Gõ tên Sở hoặc UBND..."
          clearable={!required}
          clearLabel="— Không thuộc cơ quan nào —"
        />
      </FormControl>
      <FormHint>Tài khoản thấy dữ liệu của cơ quan này và các trường cơ quan quản lý.</FormHint>
      {error ? <p className="text-destructive-text text-sm">{error}</p> : null}
    </FormItem>
  );
}
