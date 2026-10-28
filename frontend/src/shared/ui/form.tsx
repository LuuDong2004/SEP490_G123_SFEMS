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
  return <RequiredFieldsContext.Provider value={names}>{children}</RequiredFieldsContext.Provider>;
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

const FormField = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({
  ...props
}: ControllerProps<TFieldValues, TName>) => {
  return (
    <FormFieldContext.Provider value={{ name: props.name, required: rulesRequire(props.rules) }}>
      <Controller {...props} />
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
