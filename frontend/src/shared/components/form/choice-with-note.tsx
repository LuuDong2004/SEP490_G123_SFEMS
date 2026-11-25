import { useRef } from "react";
import { useController, type Control, type RegisterOptions } from "react-hook-form";

import { Input } from "@/shared/ui/input";
import { FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { FormHint } from "@/shared/components/form/help-hint";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { maxLengthOf } from "@/shared/lib/field-rules";
import { cn } from "@/shared/lib/utils";

type Option = { value: string; label: string; disabled?: boolean };

const NONE = "__none__";

/**
 * Ô chọn có mục "Khác" là MỘT MÃ thật (luật máy chủ dựa vào nó) và phần ghi rõ lưu ở ô riêng: chọn "Khác" thì CHÍNH ô
 * này thành ô gõ phần ghi rõ — không hiện thêm ô "Ghi rõ …" bên dưới. Mũi tên bên phải mở lại danh sách. Khác
 * `SelectOrText` (chữ gõ tay thay cho mã): ở đây mã vẫn là "Khác", chữ gõ là phần ghi rõ.
 */
export function ChoiceWithNote({ value, options, onChange, otherValue, note, onNoteChange, onNoteBlur, placeholder,
  notePlaceholder, disabled, invalid, clearable, noteMax = maxLengthOf("SHORT_TEXT") }: {
  value: string | null | undefined;
  options: Option[];
  onChange: (value: string) => void;
  /** Mã của mục "Khác". */
  otherValue: string;
  note: string | null | undefined;
  onNoteChange: (note: string) => void;
  onNoteBlur?: () => void;
  placeholder?: string;
  notePlaceholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  /** Có dòng "Bỏ chọn" khi đang có giá trị — chọn nó là `onChange("")`. */
  clearable?: boolean;
  noteMax?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  // Vừa chọn "Khác": ô gõ hiện ở lần vẽ sau, nên đánh dấu ở đây rồi trao con trỏ khi danh sách đóng.
  const focusInput = useRef(false);
  const other = !!value && value === otherValue;
  const otherLabel = options.find((o) => o.value === otherValue)?.label ?? "Khác";

  // Radix `Select` bắn `onValueChange("")` khi giá trị chưa khớp mục nào — không phải lựa chọn của người dùng.
  const pick = (v: string) => {
    if (!v) return;
    if (v === otherValue) focusInput.current = true;
    onChange(v === NONE ? "" : v);
  };
  const items = (align: "start" | "end") => (
    <SelectContent align={align} onCloseAutoFocus={(e) => {
      if (focusInput.current) {
        focusInput.current = false;
        e.preventDefault();
        setTimeout(() => inputRef.current?.focus(), 0);
      }
    }}>
      {clearable && value ? <SelectItem value={NONE} className="text-muted-foreground">Bỏ chọn</SelectItem> : null}
      {options.map((o) => (
        <SelectItem key={o.value} value={o.value} disabled={o.disabled}>{o.label}</SelectItem>
      ))}
    </SelectContent>
  );

  if (other) {
    return (
      <div className="relative">
        <Input ref={inputRef} value={note ?? ""} maxLength={noteMax} disabled={disabled} aria-invalid={invalid || undefined}
          onChange={(e) => onNoteChange(e.target.value)} onBlur={onNoteBlur}
          placeholder={notePlaceholder ?? `${otherLabel}: ghi rõ`} className="pe-9" />
        <Select value={value} onValueChange={pick} disabled={disabled}>
          <SelectTrigger aria-label="Chọn trong danh sách"
            className="absolute inset-y-0 end-0 h-full w-9 justify-center border-0 bg-transparent px-0 shadow-none hover:bg-transparent dark:bg-transparent" />
          {items("end")}
        </Select>
      </div>
    );
  }
  return (
    <Select value={value ?? ""} onValueChange={pick} disabled={disabled}>
      <SelectTrigger className={cn("w-full")} aria-invalid={invalid || undefined}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      {items("start")}
    </Select>
  );
}

type SelectNoteProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- form của từng phiếu có kiểu riêng
  control: Control<any>;
  name: string;
  noteName: string;
  otherValue: string;
  label: string;
  options: Option[];
  placeholder?: string;
  notePlaceholder?: string;
  rules?: RegisterOptions;
  noteRules?: RegisterOptions;
  description?: string;
  className?: string;
  noteMax?: number;
};

/**
 * `SelectField` có mục "Khác" ghi rõ ngay trong ô (`ChoiceWithNote`): `name` là mã, `noteName` là phần ghi rõ. Phần ghi
 * rõ bắt buộc khi đang chọn "Khác" (`noteRules`); đổi sang mục khác thì phần ghi rõ bị xoá. Nằm trong `FormField` nên
 * nhãn tự có dấu * như mọi ô (bắt buộc khi lưu, hoặc khi trình qua `VoucherFormPage required`).
 */
export function SelectNoteField(props: SelectNoteProps) {
  return (
    <FormField control={props.control} name={props.name} rules={props.rules}
      render={({ field, fieldState }) => <SelectNoteBody {...props} value={field.value} onChange={field.onChange} error={fieldState.error?.message} />} />
  );
}

function SelectNoteBody({ control, noteName, otherValue, label, options, placeholder, notePlaceholder, noteRules, description,
  className, noteMax, value, onChange, error }: SelectNoteProps & { value: string; onChange: (v: string) => void; error?: string }) {
  const other = value === otherValue;
  const { field: noteField, fieldState: noteState } = useController({
    control, name: noteName, rules: other ? noteRules : undefined,
  });
  const message = error ?? (other ? noteState.error?.message : undefined);
  return (
    <FormItem className={className}>
      <FormLabel>{label}</FormLabel>
      <ChoiceWithNote value={value} options={options} otherValue={otherValue} placeholder={placeholder}
        notePlaceholder={notePlaceholder} noteMax={noteMax} invalid={!!message}
        onChange={(v) => {
          onChange(v);
          if (v !== otherValue && noteField.value) noteField.onChange("");
        }}
        note={noteField.value} onNoteChange={noteField.onChange} onNoteBlur={noteField.onBlur} />
      {description ? <FormHint>{description}</FormHint> : null}
      <FormMessage>{message}</FormMessage>
    </FormItem>
  );
}
