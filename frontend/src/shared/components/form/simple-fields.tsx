import type { Control } from "react-hook-form";

import { TimeInput } from "@/shared/components/form/time-input";
import { DateInput } from "@/shared/components/form/date-input";
import { FormHint } from "@/shared/components/form/help-hint";
import { MoneyInput } from "@/shared/components/form/money-input";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Textarea } from "@/shared/ui/textarea";
import { cn } from "@/shared/lib/utils";
import {
  dateRules,
  inputModeOf,
  maxLengthOf,
  mergeRules,
  numberRules,
  textRules,
  type DateRule,
  type NumberRule,
  type TextRule,
} from "@/shared/lib/field-rules";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Kiểu trường chuẩn (`shared/lib/field-rules.ts`) — ô tự có trần độ dài, ký tự cho phép, bàn phím phù hợp và câu
 * báo lỗi giống hệt máy chủ. `rule` cho ô chữ, `numberRule` cho ô số / tiền, `dateRule` cho ô ngày. `max` chỉ
 * khai khi cột ngắn hơn trần của kiểu. `rules` riêng của ô (bắt buộc, so với ô khác) vẫn gộp vào.
 */
type RuleProps = { rule?: TextRule; max?: number; min?: number; numberRule?: NumberRule };

const ruled = (label: string, rules: any, rule?: TextRule, max?: number, numberRule?: NumberRule, min?: number) =>
  rule ? mergeRules(textRules(rule, label, { max, min }), rules)
    : numberRule ? mergeRules(numberRules(numberRule, label), rules)
      : rules;

/**
 * Các ô nhập đơn giản mà form phiếu nào cũng cần — chữ, số, ngày, đoạn văn, chọn
 * một giá trị. Mỗi ô là một {@code FormField} đầy đủ (nhãn, lỗi, gợi ý), để form
 * phiếu đọc được thành một danh sách ô thay vì một tường JSX.
 */
type Base = {
  control: Control<any>;
  name: string;
  label: string;
  description?: string;
  rules?: any;
  className?: string;
};

export function TextField({ control, name, label, description, rules, className, placeholder, type = "text", step,
  rule, max, min, numberRule }:
  Base & RuleProps & {
    placeholder?: string;
    /** `"money"`: số tiền, hiện dấu chấm hàng nghìn khi gõ, giá trị vẫn là số. */
    type?: "text" | "number" | "money" | "time";
    /** Ô số: `"any"` cho phép số lẻ. */ step?: string;
  }) {
  return (
    <FormField
      control={control}
      name={name}
      rules={ruled(label, rules, rule, max, numberRule ?? (type === "money" ? "MONEY" : undefined), min)}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            {type === "money" ? (
              <MoneyInput value={field.value} onChange={field.onChange} onBlur={field.onBlur}
                name={field.name} ref={field.ref} placeholder={placeholder} />
            ) : type === "time" ? (
              // Ô giờ của dự án (24 giờ, hộp chọn theo theme), không phải ô giờ của trình duyệt.
              <TimeInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name} />
            ) : (
            <Input
              type={type}
              value={field.value ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                field.onChange(type === "number" ? (v === "" ? null : Number(v)) : v);
              }}
              onBlur={field.onBlur}
              name={field.name}
              ref={field.ref}
              placeholder={placeholder}
              step={step}
              maxLength={rule ? maxLengthOf(rule, max) : undefined}
              inputMode={inputModeOf(rule)}
            />
            )}
          </FormControl>
          {rule && type === "text" ? <LengthCounter value={field.value} max={maxLengthOf(rule, max)} /> : null}
          {description ? <FormHint>{description}</FormHint> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function DateField({ control, name, label, description, rules, className, dateRule = "ANY" }:
  Base & { /** `PAST_OR_TODAY` cho việc đã xảy ra (ngày hoá đơn, ngày sinh). */ dateRule?: DateRule }) {
  return (
    <FormField
      control={control}
      name={name}
      rules={mergeRules(dateRules(dateRule, label), rules)}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <DateInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name} />
          </FormControl>
          {description ? <FormHint>{description}</FormHint> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/**
 * Ô nhiều dòng (ghi chú, lý do). Chuẩn tỉ lệ: rộng bằng HAI ô thường (đúng hai cột của lưới chuẩn; `sm:col-span-2`
 * khi nằm trong lưới), cao bằng một ô và tự giãn theo chữ gõ vào — không chiếm cả bề ngang thẻ, không
 * cao sẵn ba dòng cho một ô phần lớn để trống.
 */
export function TextareaField({ control, name, label, description, rules, className, rows = 1, inGrid, placeholder,
  rule, max, min, boxClassName }:
  Base & Omit<RuleProps, "numberRule"> & {
    rows?: number;
    placeholder?: string;
    /**
     * Ô nằm TRONG lưới ô nhập của form (là một ô lưới, rộng hai cột) thay vì đứng riêng một hàng bên dưới —
     * "Ghi chú" một dòng đi cùng hàng với ô cuối của lưới, không chiếm riêng một hàng gần như trống.
     */
    inGrid?: boolean;
    /** Lớp cho chính ô nhập (vd. cao cố định để form vừa một màn). */
    boxClassName?: string;
  }) {
  return (
    <FormField
      control={control}
      name={name}
      rules={ruled(label, rules, rule, max, undefined, min)}
      render={({ field }) => (
        <FormItem className={cn(inGrid ? "@md:col-span-2" : "max-w-xl @2xl:max-w-[calc((100%-2rem)*2/3+1rem)] @4xl:max-w-[calc((100%-3rem)/2+1rem)]", className)}>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Textarea rows={rows} placeholder={placeholder} className={cn(rows === 1 && "min-h-9", boxClassName)} value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} name={field.name}
              maxLength={rule ? maxLengthOf(rule, max) : undefined} />
          </FormControl>
          {rule ? <LengthCounter value={field.value} max={maxLengthOf(rule, max)} /> : null}
          {description ? <FormHint>{description}</FormHint> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function SelectField({ control, name, label, description, rules, className, options, placeholder }:
  Base & { options: { value: string; label: string; disabled?: boolean }[]; placeholder?: string }) {
  return (
    <FormField
      control={control}
      name={name}
      rules={rules}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          {/* Radix `Select` bắn `onValueChange("")` khi màn sửa nạp giá trị lúc nó chưa khớp mục nào — nhận nó là
              xoá đè giá trị của bản ghi (hình thức sửa "Thuê đơn vị ngoài" hiện thành "Chọn"). Không `SelectItem`
              nào mang value rỗng, nên "" không bao giờ là lựa chọn của người dùng. */}
          <Select value={field.value ?? ""} onValueChange={(v) => { if (v !== "") field.onChange(v); }}>
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={placeholder ?? "Chọn"} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value} disabled={o.disabled}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {description ? <FormHint>{description}</FormHint> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/**
 * Số ký tự đã gõ / trần — chỉ hiện khi đã gõ quá 80% trần, để ô bình thường không thêm chữ thừa. Mọi ô chữ có luật
 * (`TextField` / `TextareaField` có `rule`) tự có; ô tự dựng đặt nó ngay dưới `FormControl`.
 */
export function LengthCounter({ value, max }: { value: unknown; max: number }) {
  const length = typeof value === "string" ? [...value].length : 0;
  if (length < max * 0.8) return null;
  return (
    <p data-slot="form-counter" className={cn("text-end text-xs tabular-nums", length >= max ? "text-destructive" : "text-muted-foreground")}>
      {length}/{max}
    </p>
  );
}
