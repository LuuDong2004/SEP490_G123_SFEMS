import { FormHint } from "@/shared/components/form/help-hint";
import {
  FormControl,
  FormItem,
  FormLabel,
} from "@/shared/ui/form";
import { AsyncCombobox } from "@/shared/components/form/async-combobox";
import type { School } from "@/domains/school/types";
import type { SchoolSummary } from "@/domains/user/types";

/**
 * Trường mà tài khoản thuộc về.
 *
 * <p>Trước đây đây là hai ô chọn — tổ chức và phòng ban bên trong nó — vì
 * schema của nền cũ có bất biến "phòng ban phải thuộc đúng tổ chức của người
 * đó". Trục tổ chức của dự án này chỉ có MỘT cấp gắn với tài khoản, nên bất
 * biến ấy không còn và ô chọn thứ hai cũng vậy.
 *
 * <p>Từng là một {@code Select} nạp sẵn 200 trường. Với 1.162 trường thì gần
 * 83% danh sách biến mất mà không có dấu hiệu nào — ô chọn vẫn hiện ra bình
 * thường, chỉ là không có trường mình cần và người dùng không hiểu vì sao. Giờ
 * dùng {@link AsyncCombobox}: tìm ở server, tải theo trang.
 */

export type SchoolRef = { id: number | null };

type SchoolPickerProps = {
  school: SchoolRef | null | undefined;
  onSchoolChange: (value: SchoolRef) => void;
  /**
   * Trường của chính bản ghi, trên form sửa. Dùng làm nhãn dự phòng để ô chọn
   * hiện đúng tên NGAY CẢ KHI chưa đọc được bản ghi — và cả khi không bao giờ
   * đọc được, vì đọc danh sách trường là một quyền riêng.
   */
  currentSchool?: SchoolSummary | null;
  /** Bắt buộc chọn: dấu *, không có dòng "Không thuộc trường nào". */
  required?: boolean;
  error?: string | null;
};

export function SchoolPicker({
  school,
  onSchoolChange,
  currentSchool,
  required,
  error,
}: SchoolPickerProps) {
  return (
    <FormItem>
      <FormLabel required={required || undefined}>Trường công tác</FormLabel>
      <FormControl>
        <AsyncCombobox<School>
          resource="schools"
          value={school?.id ?? null}
          onChange={(id) => onSchoolChange({ id })}
          labelOf={(s) => s.name}
          fallbackLabel={currentSchool?.name ?? null}
          placeholder="Vui lòng chọn trường"
          searchPlaceholder="Gõ tên hoặc mã trường..."
          clearable={!required}
          clearLabel="— Không thuộc trường nào —"
        />
      </FormControl>
      <FormHint>
        Tài khoản chỉ thấy dữ liệu của trường này. Để trống thì không thấy dữ
        liệu của trường nào.
      </FormHint>
      {error ? <p className="text-destructive-text text-sm">{error}</p> : null}
    </FormItem>
  );
}
