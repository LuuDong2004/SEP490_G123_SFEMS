import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { Slot } from "@radix-ui/react-slot";
import {
  Controller,
  FormProvider,
  useFormContext,
  useFormState,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";

import { cn } from "@/shared/lib/utils";
import { Label } from "@/shared/ui/label";

const Form = FormProvider;

type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> = {
  name: TName;
  /** Ô có luật `required` — nhãn tự gắn dấu *. */
  required?: boolean;
};

/**
 * Ô bắt buộc mà luật của chính ô không nói ra: ô chỉ bắt buộc lúc TRÌNH phiếu (lưu nháp vẫn để trống được),
 * do trang lập phiếu khai. Tên ô khớp đúng tên hoặc là tiền tố (`room` khớp ô `room.id`).
 */
const RequiredFieldsContext = React.createContext<ReadonlySet<string>>(new Set());

function RequiredFieldsProvider({ names, children }: { names: ReadonlySet<string>; children: React.ReactNode }) {
  // Trang lập phiếu dựng tập này lại ở mỗi lần vẽ (mỗi phím gõ): giữ nguyên định danh khi NỘI DUNG không đổi,
  // nếu không mọi nhãn trên form vẽ lại theo từng phím.
  const key = [...names].sort().join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const value = React.useMemo(() => names, [key]);
  return <RequiredFieldsContext.Provider value={value}>{children}</RequiredFieldsContext.Provider>;
}

/** `rules.required` có thể là chuỗi lời nhắc, `true`, hoặc `{ value, message }`. */
function rulesRequire(rules: unknown): boolean {
  const required = (rules as { required?: unknown } | undefined)?.required;
  if (required && typeof required === "object" && "value" in required) {
    return !!(required as { value: unknown }).value;
  }
  return !!required;
}

const FormFieldContext = React.createContext<FormFieldContextValue>(
  {} as FormFieldContextValue
);

type Validator = (value: unknown, values: unknown) => unknown;

/** Ô trống theo đúng nghĩa `required` của react-hook-form (ô dùng Controller, không phải checkbox thật). */
const isEmptyValue = (v: unknown) => v == null || v === "" || (Array.isArray(v) && v.length === 0);

function requiredMessage(required: unknown): string {
  if (typeof required === "string") return required;
  if (required && typeof required === "object" && "message" in required) {
    return String((required as { message?: unknown }).message ?? "");
  }
  return "";
}

/**
 * Luật `required` / `validate` đọc theo lần vẽ MỚI NHẤT.
 *
 * react-hook-form chỉ đăng ký `rules` của Controller một lần lúc ô gắn vào form (và gộp chứ không thay), nên
 * ô bắt buộc theo điều kiện — `required={loại phòng là bộ môn}` — giữ mãi luật của lần đầu: chọn loại bộ môn
 * rồi đổi về phòng học thường, dấu * mất mà lưu vẫn báo "Chọn môn". Ở đây hai luật đó đi qua một hàm
 * `validate` cố định, hàm này đọc luật hiện tại qua ref; các luật khác (min, max, pattern…) giữ nguyên.
 */
function useLiveRules(rules: ControllerProps["rules"]) {
  const latest = React.useRef(rules);
  latest.current = rules;
  // Ổn định suốt đời ô: react-hook-form chỉ đăng ký một lần, phần thay đổi đi qua ref.
  const [stable] = React.useState(() => {
    const run = (value: unknown, values: unknown): unknown => {
      const r = latest.current as { required?: unknown; validate?: Validator | Record<string, Validator> } | undefined;
      if (rulesRequire(r) && isEmptyValue(value)) return requiredMessage(r?.required) || false;
      const v = r?.validate;
      if (!v) return true;
      const fns = typeof v === "function" ? [v] : Object.values(v);
      for (let i = 0; i < fns.length; i++) {
        const res = fns[i](value, values);
        if (res instanceof Promise) {
          // Có luật bất đồng bộ: chạy tiếp phần còn lại theo thứ tự.
          return (async () => {
            const first = await res;
            if (first !== true && first !== undefined) return first;
            for (const fn of fns.slice(i + 1)) {
              const next = await fn(value, values);
              if (next !== true && next !== undefined) return next;
            }
            return true;
          })();
        }
        if (res !== true && res !== undefined) return res;
      }
      return true;
    };
    const rest: Record<string, unknown> = { ...(rules ?? {}) };
    delete rest.required;
    delete rest.validate;
    return { ...rest, validate: run } as ControllerProps["rules"];
  });
  return stable;
}

const FormField = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({
  ...props
}: ControllerProps<TFieldValues, TName>) => {
  const rules = useLiveRules(props.rules as ControllerProps["rules"]);
  return (
    <FormFieldContext.Provider value={{ name: props.name, required: rulesRequire(props.rules) }}>
      <Controller {...props} rules={rules as ControllerProps<TFieldValues, TName>["rules"]} />
    </FormFieldContext.Provider>
  );
};

const useFormField = () => {
  const fieldContext = React.useContext(FormFieldContext);
  const itemContext = React.useContext(FormItemContext);
  const { getFieldState } = useFormContext();
  const formState = useFormState({ name: fieldContext.name });
  const fieldState = getFieldState(fieldContext.name, formState);

  if (!fieldContext) {
    throw new Error("useFormField should be used within <FormField>");
  }

  const { id } = itemContext;

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  };
};

type FormItemContextValue = {
  id: string;
};

const FormItemContext = React.createContext<FormItemContextValue>(
  {} as FormItemContextValue
);

function FormItem({ className, ...props }: React.ComponentProps<"div">) {
  const id = React.useId();

  return (
    <FormItemContext.Provider value={{ id }}>
      <div
        data-slot="form-item"
        className={cn("grid gap-2", className)}
        {...props}
      />
    </FormItemContext.Provider>
  );
}

/**
 * Nhãn ô. Ô BẮT BUỘC tự có dấu * — theo luật `required` của ô, hoặc theo danh sách ô bắt buộc lúc trình mà
 * trang lập phiếu khai (`RequiredFieldsProvider`) — nên không form nào phải tự vẽ dấu * nữa, và không ô
 * bắt buộc nào bị quên dấu. `required` ghi đè khi luật nằm ngoài ô (vd. kiểm bằng `validate`, theo cấu hình).
 */
function FormLabel({
  className,
  required,
  children,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root> & { required?: boolean }) {
  const { error, formItemId } = useFormField();
  const field = React.useContext(FormFieldContext);
  const submitRequired = React.useContext(RequiredFieldsContext);
  const name = String(field.name ?? "");
  const marked =
    required ??
    (!!field.required ||
      [...submitRequired].some((n) => name === n || name.startsWith(`${n}.`)));

  return (
    <Label
      data-slot="form-label"
      data-error={!!error}
      className={cn("data-[error=true]:text-destructive", className)}
      htmlFor={formItemId}
      {...props}
    >
      {children}
      {marked ? <span className="text-destructive" aria-hidden> *</span> : null}
    </Label>
  );
}

function FormControl({ ...props }: React.ComponentProps<typeof Slot>) {
  const { error, formItemId, formDescriptionId, formMessageId } =
    useFormField();

  return (
    <Slot
      data-slot="form-control"
      id={formItemId}
      aria-describedby={
        !error
          ? `${formDescriptionId}`
          : `${formDescriptionId} ${formMessageId}`
      }
      aria-invalid={!!error}
      {...props}
    />
  );
}

function FormDescription({ className, ...props }: React.ComponentProps<"p">) {
  const { formDescriptionId } = useFormField();

  return (
    <p
      data-slot="form-description"
      id={formDescriptionId}
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

function FormMessage({ className, ...props }: React.ComponentProps<"p">) {
  const { error, formMessageId } = useFormField();
  const body = error ? String(error?.message ?? "") : props.children;

  if (!body) {
    return null;
  }

  return (
    <p
      data-slot="form-message"
      id={formMessageId}
      className={cn("text-destructive text-sm", className)}
      {...props}
    >
      {body}
    </p>
  );
}

export {
  useFormField,
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  FormField,
  RequiredFieldsProvider,
};
