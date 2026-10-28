import type { Control } from "react-hook-form";

import { DateInput } from "@/shared/components/form/date-input";
import { FormHint } from "@/shared/components/form/help-hint";
import { MoneyInput } from "@/shared/components/form/money-input";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Textarea } from "@/shared/ui/textarea";
import { cn } from "@/shared/lib/utils";

/* eslint-disable @typescript-eslint/no-explicit-any */

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

export function TextField({ control, name, label, description, rules, className, placeholder, type = "text", step }:
  Base & {
    placeholder?: string;
    /** `"money"`: số tiền, hiện dấu chấm hàng nghìn khi gõ, giá trị vẫn là số. */
    type?: "text" | "number" | "money" | "time";
    /** Ô số: `"any"` cho phép số lẻ. */ step?: string;
  }) {
  return (
    <FormField
      control={control}
      name={name}
      rules={rules}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            {type === "money" ? (
              <MoneyInput value={field.value} onChange={field.onChange} onBlur={field.onBlur}
                name={field.name} ref={field.ref} placeholder={placeholder} />
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
            />
            )}
          </FormControl>
          {description ? <FormHint>{description}</FormHint> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function DateField({ control, name, label, description, rules, className }: Base) {
  return (
    <FormField
      control={control}
      name={name}
      rules={rules}
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
export function TextareaField({ control, name, label, description, rules, className, rows = 1, inGrid, placeholder }:
  Base & {
    rows?: number;
    placeholder?: string;
    /**
     * Ô nằm TRONG lưới ô nhập của form (là một ô lưới, rộng hai cột) thay vì đứng riêng một hàng bên dưới —
     * "Ghi chú" một dòng đi cùng hàng với ô cuối của lưới, không chiếm riêng một hàng gần như trống.
     */
    inGrid?: boolean;
  }) {
  return (
    <FormField
      control={control}
      name={name}
      rules={rules}
      render={({ field }) => (
        <FormItem className={cn(inGrid ? "@md:col-span-2" : "max-w-xl @2xl:max-w-[calc((100%-2rem)*2/3+1rem)] @4xl:max-w-[calc((100%-3rem)/2+1rem)]", className)}>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Textarea rows={rows} placeholder={placeholder} className={rows === 1 ? "min-h-9" : undefined} value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} name={field.name} />
          </FormControl>
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
