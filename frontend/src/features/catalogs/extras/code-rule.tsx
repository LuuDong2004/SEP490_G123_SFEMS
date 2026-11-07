import { useWatch, type Control } from "react-hook-form";

import { FormHint } from "@/shared/components/form/help-hint";
import { ReadField } from "@/shared/components/form/read-field";
import { SelectField, TextField } from "@/shared/components/form/simple-fields";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { Input } from "@/shared/ui/input";
import type { CatalogConfig, CatalogFormValues, CatalogRecord } from "@/features/catalogs/catalog-config";

/**
 * Danh mục được gắn quy tắc — PHẢI khớp `CodeTargets.ALL` ở backend. Phường/xã mang mã hành chính của
 * Nhà nước nên không sinh mã.
 */
const TARGET_LABELS: Record<string, string> = {
  education_levels: "Cấp học",
  room_types: "Loại phòng",
  school_types: "Loại hình trường",
  school_years: "Năm học",
  semesters: "Học kỳ",
  grades: "Khối lớp",
  subject_groups: "Tổ chuyên môn",
  subjects: "Môn học",
  equipment_types: "Loại thiết bị",
  units: "Đơn vị tính",
  origin_sources: "Nguồn hình thành",
  acquisition_methods: "Hình thức mua sắm",
  movement_reasons: "Lý do biến động",
  equipment_standards: "Danh mục tối thiểu và định mức",
  equipment_norms: "Định mức thiết bị",
  equipment_catalogs: "Danh mục thiết bị",
  equipment_configs: "Bộ thông số kỹ thuật",
  schools: "Trường học",
};

const TARGET_OPTIONS = Object.entries(TARGET_LABELS).map(([value, label]) => ({ value, label }));

/** Giới hạn phần số, cùng `@Min` / `@Max` của `CodeRuleRequest`. */
const MIN_NUMBER_LENGTH = 1;
const MAX_NUMBER_LENGTH = 10;

type CodeRule = CatalogRecord & {
  target: string;
  prefix: string | null;
  suffix: string | null;
  numberLength: number;
  currentNumber: number;
  nextCode: string;
};

/**
 * Phần số của mã tiếp theo, cùng công thức với `CodeRule.format` ở backend; `null` khi số đang gõ chưa hợp
 * lệ. Kiểm trước `padStart`: hàm chạy theo từng phím gõ, gõ độ dài cả tỉ là cấp phát cả tỉ ký tự.
 */
function nextDigits(numberLength: unknown, currentNumber: unknown): string | null {
  const width = Number(numberLength);
  const current = Number(currentNumber ?? 0);
  if (!Number.isInteger(width) || width < MIN_NUMBER_LENGTH || width > MAX_NUMBER_LENGTH) return null;
  if (!Number.isSafeInteger(current + 1) || current < 0) return null;
  return String(current + 1).padStart(width, "0");
}

function Segment({ value, label, tone }: { value: string; label: string; tone: string }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1.5">
      <span className={`rounded-md px-2.5 py-1 font-mono text-lg font-semibold tracking-wide break-all ${tone}`}>{value}</span>
      <span className="text-muted-foreground text-[0.6875rem]">{label}</span>
    </div>
  );
}

/** Mã tiếp theo, tách màu từng phần để thấy ngay tiền tố, số, hậu tố nằm đâu. */
function Preview({ control }: { control: Control<CatalogFormValues> }) {
  const [prefix, suffix, numberLength, currentNumber] = useWatch({
    control,
    name: ["prefix", "suffix", "numberLength", "currentNumber"],
  });
  const digits = nextDigits(numberLength, currentNumber);
  return (
    <div className="border-border bg-surface-subtle rounded-lg border border-dashed px-5 py-4 sm:col-span-2">
      <p className="text-muted-foreground mb-3 text-xs">Mã tiếp theo sẽ là</p>
      {digits === null ? (
        <p className="text-muted-foreground text-sm">Nhập đúng số chữ số và số đã cấp để xem mã.</p>
      ) : (
        <div className="flex flex-wrap items-start gap-1">
          {prefix ? <Segment value={String(prefix)} label="Tiền tố" tone="bg-info-subtle text-info-text" /> : null}
          <Segment value={digits} label="Số thứ tự" tone="bg-success-subtle text-success-text" />
          {suffix ? <Segment value={String(suffix)} label="Hậu tố" tone="bg-warning-subtle text-warning-text" /> : null}
        </div>
      )}
    </div>
  );
}

/** Ô số nguyên: ô rỗng gửi `null` chứ không phải "" — máy chủ nhận số. */
function NumberField({ control, name, label, hint, rules }: {
  control: Control<CatalogFormValues>;
  name: string;
  label: string;
  hint?: string;
  rules: object;
}) {
  return (
    <FormField
      control={control}
      name={name}
      rules={rules}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              type="number"
              min={0}
              placeholder="0"
              value={(field.value as number | null) ?? ""}
              onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
              onBlur={field.onBlur}
              name={field.name}
              ref={field.ref}
            />
          </FormControl>
          {hint ? <FormHint>{hint}</FormHint> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function CodeRuleFields({ control }: { control: Control<CatalogFormValues> }) {
  return (
    <>
      <SelectField
        control={control}
        name="target"
        label="Áp dụng cho"
        options={TARGET_OPTIONS}
        placeholder="Vui lòng chọn danh mục"
        description="Mỗi danh mục chỉ có một quy tắc."
        rules={{ required: "Chọn danh mục" }}
        className="sm:col-span-2"
      />
      <TextField control={control} name="prefix" label="Tiền tố" placeholder="TB" />
      <NumberField
        control={control}
        name="numberLength"
        label="Số chữ số"
        rules={{
          required: "Nhập số chữ số",
          min: { value: MIN_NUMBER_LENGTH, message: "Độ dài phần số từ 1 đến 10" },
          max: { value: MAX_NUMBER_LENGTH, message: "Độ dài phần số từ 1 đến 10" },
          validate: (v: unknown) => v == null || Number.isInteger(Number(v)) || "Số chữ số phải là số nguyên",
        }}
      />
      <TextField control={control} name="suffix" label="Hậu tố" placeholder="Không bắt buộc" />
      <NumberField
        control={control}
        name="currentNumber"
        label="Đã cấp đến số"
        hint="Giảm số này có thể làm trùng mã cũ."
        rules={{
          min: { value: 0, message: "Số hiện tại không được âm" },
          max: { value: Number.MAX_SAFE_INTEGER - 1, message: "Số hiện tại quá lớn" },
          validate: (v: unknown) => v == null || Number.isInteger(Number(v)) || "Đã cấp đến số phải là số nguyên",
        }}
      />
      <Preview control={control} />
    </>
  );
}

function CodeRuleRead({ record }: { record: CatalogRecord }) {
  const rule = record as CodeRule;
  return (
    <>
      <ReadField label="Áp dụng cho">{TARGET_LABELS[rule.target] ?? rule.target}</ReadField>
      <ReadField label="Tiền tố">{rule.prefix ?? undefined}</ReadField>
      <ReadField label="Số chữ số">{rule.numberLength}</ReadField>
      <ReadField label="Hậu tố">{rule.suffix ?? undefined}</ReadField>
      <ReadField label="Đã cấp đến số">{rule.currentNumber}</ReadField>
      <ReadField label="Mã tiếp theo">
        <span className="font-mono text-xs font-medium">{rule.nextCode}</span>
      </ReadField>
    </>
  );
}

export const codeRuleConfig: CatalogConfig = {
  resource: "code_rules",
  noun: "quy tắc mã",
  description: "Tự tạo mã cho mục mới của từng danh mục.",
  codeRequired: true,
  codePlaceholder: "MA_LOAI_TB",
  namePlaceholder: "Mã loại thiết bị",
  extraKeys: ["target", "prefix", "suffix", "numberLength", "currentNumber"],
  extraDefaults: { target: "", prefix: "", suffix: "", numberLength: 4, currentNumber: 0 },
  extraColumns: [
    {
      id: "target",
      header: "Áp dụng cho",
      size: 200,
      enableSorting: false,
      cell: ({ row }) => TARGET_LABELS[(row.original as CodeRule).target] ?? (row.original as CodeRule).target,
    },
    {
      id: "nextCode",
      header: "Mã tiếp theo",
      size: 140,
      enableSorting: false,
      cell: ({ row }) => <span className="font-mono text-xs font-medium">{(row.original as CodeRule).nextCode}</span>,
    },
  ],
  ExtraFields: CodeRuleFields,
  ExtraRead: CodeRuleRead,
};
