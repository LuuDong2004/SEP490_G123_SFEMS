import { useCustom } from "@refinedev/core";
import type { ColumnDef } from "@tanstack/react-table";
import { useWatch, type Control } from "react-hook-form";

import { API_URL } from "@/shared/api/constants";

import { maxLengthOf, textRules } from "@/shared/lib/field-rules";
import { Input } from "@/shared/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { FormHint } from "@/shared/components/form/help-hint";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/ui/form";
import { CATALOGS } from "@/features/catalogs/registry";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Danh mục được gắn quy tắc — PHẢI khớp `CodeTargets.ALL` ở backend. Cấp học
 * khai riêng trong routes.tsx nên thêm tay; phường/xã mang mã hành chính của
 * Nhà nước nên không sinh mã.
 */
// Tính khi dùng chứ không lúc nạp file: registry nạp file này (qua extras), nên
// đọc CATALOGS ngay ở đây là vòng import — lúc đó mảng chưa được khai báo xong.
let targetLabels: Record<string, string> | null = null;
function TARGET(): Record<string, string> {
  targetLabels ??= Object.fromEntries([
    ["education_levels", "Cấp học"],
    ...CATALOGS.filter((c) => c.resource !== "wards" && c.resource !== "code_rules").map(
      (c) => [c.resource, c.label],
    ),
  ]);
  return targetLabels!;
}

/** Giới hạn phần số, cùng `@Min` / `@Max` của `CodeRuleRequest`. */
const MIN_NUMBER_LENGTH = 1;
const MAX_NUMBER_LENGTH = 10;

/**
 * Phần số của mã tiếp theo, cùng công thức với `CodeRule.format` ở backend; `null` khi số đang gõ chưa hợp lệ.
 * Phải kiểm trước `padStart`: hàm này chạy theo từng phím gõ, gõ độ dài cả tỉ là cấp phát cả tỉ ký tự và tab sập.
 */
function nextDigits(numberLength: unknown, currentNumber: unknown): string | null {
  const width = Number(numberLength);
  const current = Number(currentNumber ?? 0);
  if (!Number.isInteger(width) || width < MIN_NUMBER_LENGTH || width > MAX_NUMBER_LENGTH) return null;
  if (!Number.isSafeInteger(current + 1) || current < 0) return null;
  return String(current + 1).padStart(width, "0");
}

function NumberInput({ field }: { field: any }) {
  return (
    // Ô rỗng gửi null chứ không phải "": backend nhận số.
    <Input
      type="number"
      min={0}
      placeholder="0"
      value={field.value ?? ""}
      onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
      onBlur={field.onBlur}
      name={field.name}
      ref={field.ref}
    />
  );
}

function AffixField({
  control,
  name,
  label,
  placeholder,
}: {
  control: Control<any>;
  name: string;
  label: string;
  placeholder: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      // `CodeRuleRequest`: CODE, tối đa 20.
      rules={textRules("CODE", label, { max: 20 })}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input {...field} value={field.value ?? ""} placeholder={placeholder} maxLength={maxLengthOf("CODE", 20)} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function Segment({ value, label, tone }: { value: string; label: string; tone: string }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1.5">
      <span
        className={`rounded-md px-2.5 py-1 font-mono text-lg font-semibold tracking-wide break-all ${tone}`}
      >
        {value}
      </span>
      <span className="text-muted-foreground text-[0.6875rem]">{label}</span>
    </div>
  );
}

/** Mã tiếp theo, tách màu từng phần để thấy ngay tiền tố/số/hậu tố nằm đâu. */
function Preview({ control }: { control: Control<any> }) {
  const [prefix, suffix, numberLength, currentNumber] = useWatch({
    control,
    name: ["prefix", "suffix", "numberLength", "currentNumber"],
  });
  const digits = nextDigits(numberLength, currentNumber);
  return (
    <div className="rounded-lg border border-dashed border-border bg-surface-subtle px-5 py-4">
      <p className="text-muted-foreground mb-3 text-xs">Mã tiếp theo sẽ là</p>
      {digits === null ? (
        <p className="text-muted-foreground text-sm">Nhập đúng số chữ số và số đã cấp để xem mã.</p>
      ) : (
        <div className="flex flex-wrap items-start gap-1">
          {prefix ? (
            <Segment value={prefix} label="Tiền tố" tone="bg-info-subtle text-info-text" />
          ) : null}
          <Segment value={digits} label="Số thứ tự" tone="bg-success-subtle text-success-text" />
          {suffix ? (
            <Segment value={suffix} label="Hậu tố" tone="bg-warning-subtle text-warning-text" />
          ) : null}
        </div>
      )}
    </div>
  );
}

/** Số lớn nhất đã cấp theo khuôn đang gõ — cùng `CodeGenerator.largestIssued` ở máy chủ. */
function useLargestIssued(control: Control<any>) {
  const [target, prefix, suffix] = useWatch({ control, name: ["target", "prefix", "suffix"] });
  const { result } = useCustom<{ number: number | null; code: string | null }>({
    url: `${API_URL}/code_rules/largest`,
    method: "get",
    config: { query: { target: target ?? "", prefix: prefix ?? "", suffix: suffix ?? "" } },
    queryOptions: { enabled: !!target },
  });
  const data = result?.data;
  return data && typeof data.number === "number" ? { number: data.number, code: data.code ?? "" } : null;
}

// Máy chủ chỉ kiểm khi khuôn hay số đổi (quy tắc cũ đặt lùi vẫn sửa được tên); form cũng vậy.
const SHAPE = ["target", "prefix", "suffix", "numberLength", "currentNumber"] as const;
const shapeUnchanged = (values: any, record: any) =>
  !!record && SHAPE.every((k) => String(values?.[k] ?? "") === String(record?.[k] ?? ""));

function CodeRuleFields({ control, record }: { control: Control<any>; record?: any }) {
  const largest = useLargestIssued(control);
  return (
    <>
      <FormField
        control={control}
        name="target"
        rules={{ required: "Vui lòng chọn danh mục" }}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Áp dụng cho</FormLabel>
            {/* Tuỳ chọn là hằng số cục bộ, luôn mount sẵn — không vướng bẫy
                "Select so khớp trước khi item tới". */}
            <Select onValueChange={field.onChange} value={field.value ?? ""}>
              <FormControl>
                <SelectTrigger className="sm:max-w-sm">
                  <SelectValue placeholder="Vui lòng chọn danh mục" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {Object.entries(TARGET()).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormHint>Mỗi danh mục chỉ có một quy tắc.</FormHint>
            <FormMessage />
          </FormItem>
        )}
      />
      <div className="form-flow">
        <AffixField control={control} name="prefix" label="Tiền tố" placeholder="TB" />
        <FormField
          control={control}
          name="numberLength"
          rules={{
            required: "Vui lòng nhập số chữ số",
            min: { value: MIN_NUMBER_LENGTH, message: "Độ dài phần số từ 1 đến 10" },
            max: { value: MAX_NUMBER_LENGTH, message: "Độ dài phần số từ 1 đến 10" },
            validate: (v: unknown) => v == null || Number.isInteger(Number(v)) || "Số chữ số phải là số nguyên",
          }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Số chữ số</FormLabel>
              <FormControl>
                <NumberInput field={field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <AffixField control={control} name="suffix" label="Hậu tố" placeholder="Không bắt buộc" />
      </div>
      <FormField
        control={control}
        name="currentNumber"
        rules={{
          min: { value: 0, message: "Số hiện tại không được âm" },
          max: { value: Number.MAX_SAFE_INTEGER - 1, message: "Số hiện tại quá lớn" },
          validate: {
            integer: (v: unknown) => v == null || Number.isInteger(Number(v)) || "Đã cấp đến số phải là số nguyên",
            // 3 chữ số thì tối đa 999 — số kế tiếp 1000 dài hơn khuôn mã.
            fits: (v: unknown, values: any) => {
              const width = Number(values?.numberLength);
              if (v == null || !Number.isInteger(width) || width < 1 || shapeUnchanged(values, record)) return true;
              const ceiling = 10 ** width;
              return Number(v) < ceiling || `Đã cấp đến số phải nhỏ hơn ${ceiling} (phần số dài ${width} chữ số)`;
            },
            notBelowIssued: (v: unknown, values: any) =>
              !largest || shapeUnchanged(values, record) || Number(v ?? 0) >= largest.number
              || `Đã cấp đến số không được nhỏ hơn ${largest.number} — mã ${largest.code} đã cấp`,
          },
        }}
        render={({ field }) => (
          <FormItem className="sm:max-w-[13rem]">
            <FormLabel>Đã cấp đến số</FormLabel>
            <FormControl>
              <NumberInput field={field} />
            </FormControl>
            <FormHint>Giảm số này có thể làm trùng mã cũ.</FormHint>
            <FormMessage />
          </FormItem>
        )}
      />
      <Preview control={control} />
    </>
  );
}

const columns: ColumnDef<any, any>[] = [
  {
    id: "target",
    accessorKey: "target",
    header: "Áp dụng cho",
    enableSorting: false,
    cell: ({ getValue }) => TARGET()[getValue() as string] ?? (getValue() as string),
  },
  {
    id: "nextCode",
    accessorKey: "nextCode",
    header: "Mã tiếp theo",
    enableSorting: false,
    cell: ({ getValue }) => (
      <span className="font-mono text-xs font-medium">{getValue() as string}</span>
    ),
  },
];

export const CODE_RULE_EXTRA = {
  section: { title: "Định dạng mã" },
  defaults: { target: "", prefix: "", suffix: "", numberLength: 4, currentNumber: 0 },
  Fields: CodeRuleFields,
  columns,
  show: (r: any) => [
    { label: "Áp dụng cho", value: TARGET()[r?.target] ?? r?.target ?? "—" },
    { label: "Tiền tố", value: r?.prefix ?? "—" },
    { label: "Số chữ số", value: r?.numberLength ?? "—" },
    { label: "Hậu tố", value: r?.suffix ?? "—" },
    { label: "Đã cấp đến số", value: r?.currentNumber ?? "—" },
    {
      label: "Mã tiếp theo",
      value: <span className="font-mono text-xs font-medium">{r?.nextCode ?? <span className="text-muted-foreground font-sans">Chưa tính được</span>}</span>,
    },
  ],
};
