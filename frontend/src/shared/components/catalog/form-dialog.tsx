import { useInvalidate } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";
import type { LucideIcon } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import type { Control } from "react-hook-form";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Form } from "@/shared/ui/form";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type FormDialogState = { open: boolean; id?: number };

/**
 * Hộp thoại thêm / sửa dùng chung cho các màn ÍT trường: form của từng màn
 * truyền vào qua `children`. `id` có giá trị là sửa, vắng là thêm.
 *
 * <p>Form chỉ mount khi mở, nên mỗi lần mở là một form mới. Lưu xong đóng hộp
 * thoại và làm mới danh sách của resource.
 */
export function FormDialog({
  resource,
  title,
  state,
  onOpenChange,
  defaultValues,
  size = "form",
  onSaved,
  fullTitle,
  heading,
  submitLabel,
  icon: Icon,
  description,
  footerNote,
  children,
}: {
  /** Dòng nhắc ở chân hộp, bên trái nút Huỷ — đọc giá trị đang gõ qua `control`. */
  footerNote?: (control: Control<any>) => ReactNode;
  /** Biểu tượng trong ô màu cạnh tiêu đề — chỉ khi danh mục bật `dialogHeader`. */
  icon?: LucideIcon;
  /** Một dòng mô tả dưới tiêu đề. */
  description?: string;
  /** Chữ trên nút lưu khi THÊM ("Phát động"…) — mặc định "Lưu". Sửa vẫn là "Lưu thay đổi". */
  submitLabel?: string;
  /** Tiêu đề viết sẵn cả câu ("Thêm thiết bị vào danh mục") — thay cho "Thêm" / "Sửa" + `title`. */
  fullTitle?: string;
  /** Vẽ riêng cả đầu hộp (tên phòng + nhãn "Đang sửa", cùng kiểu đầu hộp xem) — thay cho tiêu đề chữ. */
  heading?: ReactNode;
  resource: string;
  /** Tên thực thể dạng thường, ví dụ "đơn vị tính" — thành "Thêm đơn vị tính". */
  title: string;
  state: FormDialogState;
  onOpenChange: (open: boolean) => void;
  defaultValues: Record<string, unknown>;
  size?: "form" | "formFit" | "formWide" | "wide";
  onSaved?: (record: any) => void | Promise<void>;
  children: (control: Control<any>, record: any) => ReactNode;
}) {
  return (
    <Dialog open={state.open} onOpenChange={onOpenChange}>
      {/* Cùng khung với hộp xem (`CatalogShowDialog`): đầu và chân đứng yên, chỉ thân cuộn. */}
      <DialogContent size={size} className="gap-0 p-0">
        <DialogHeader className={cn("border-b px-6 pt-6 pb-4 pr-12", Icon && "flex-row items-center gap-3 pt-5")}>
          {Icon ? (
            <span className="bg-info-subtle text-info-text flex size-10 shrink-0 items-center justify-center rounded-lg">
              <Icon className="size-5" />
            </span>
          ) : null}
          <div className="min-w-0 space-y-1 text-left">
            {heading ? (
              <DialogTitle asChild><div>{heading}</div></DialogTitle>
            ) : (
              <DialogTitle>
                {fullTitle ?? `${state.id ? "Sửa" : "Thêm"} ${title}`}
              </DialogTitle>
            )}
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </div>
        </DialogHeader>
        {state.open ? (
          <DialogForm
            resource={resource}
            id={state.id}
            defaultValues={defaultValues}
            submitLabel={submitLabel}
            footerNote={footerNote}
            onDone={async (record) => {
              await onSaved?.(record);
              onOpenChange(false);
            }}
          >
            {children}
          </DialogForm>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function DialogForm({
  resource,
  id,
  defaultValues,
  onDone,
  submitLabel,
  footerNote,
  children,
}: {
  submitLabel?: string;
  footerNote?: (control: Control<any>) => ReactNode;
  resource: string;
  id?: number;
  defaultValues: Record<string, unknown>;
  onDone: (record: any) => Promise<void>;
  children: (control: Control<any>, record: any) => ReactNode;
}) {
  const invalidate = useInvalidate();
  const {
    refineCore: { onFinish, query },
    ...form
  } = useForm({
    // Huỷ trong hộp thoại là bỏ đi có chủ ý — không cảnh báo, và cờ cảnh báo
    // của form đã đóng không được treo lại chặn lần chuyển trang sau.
    warnWhenUnsavedChanges: false,
    // Báo lỗi ngay khi gõ (số quá lớn, quá số lẻ…), không đợi bấm Lưu mới biết.
    mode: "onChange",
    refineCoreProps: {
      resource,
      action: id ? "edit" : "create",
      id,
      redirect: false,
      onMutationSuccess: async (data) => {
        await invalidate({ resource, invalidates: ["list", "many"] });
        await onDone(data?.data);
      },
    },
    defaultValues,
  });
  const record = query?.data?.data;

  // Nạp bằng `reset` để ô nào mount muộn (ô chọn trong phần riêng) cũng nhận giá trị.
  const { reset } = form;
  useEffect(() => {
    if (!record) return;
    reset(record as any, { keepDirtyValues: true });
  }, [record, reset]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((v: any) => onFinish(v))} className="flex min-h-0 flex-1 flex-col">
        <div className="relative min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">{children(form.control, record)}</div>
        <DialogFooter className="border-t px-6 py-3">
          {footerNote ? <div className="me-auto flex min-w-0 items-center">{footerNote(form.control)}</div> : null}
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Huỷ
            </Button>
          </DialogClose>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Đang lưu…" : id ? "Lưu thay đổi" : submitLabel ?? "Lưu"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
