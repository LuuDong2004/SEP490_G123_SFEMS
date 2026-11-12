import type { HttpError } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";
import { Loader2 } from "lucide-react";

import { TextField, TextareaField } from "@/shared/components/form/simple-fields";
import { RouteDialog } from "@/shared/components/views/route-dialog";
import { isRecordMissing, RecordNotFound } from "@/shared/components/views/record-not-found";
import { Button } from "@/shared/ui/button";
import { Form } from "@/shared/ui/form";
import { SwitchField } from "@/features/catalogs/switch-field";
import { useSuggestedCode } from "@/features/catalogs/use-suggested-code";
import {
  BASE_FORM_DEFAULTS,
  BASE_FORM_KEYS,
  type CatalogConfig,
  type CatalogFormValues,
  type CatalogRecord,
} from "@/features/catalogs/catalog-config";

const FORM_ID = "catalog-form";

/**
 * Hộp thoại thêm hoặc sửa một mục danh mục. Mở đè lên danh sách; lưu xong thì đóng và danh sách tự
 * tải lại. Lỗi của máy chủ (trùng mã, trùng tên, ngày sai…) hiện ngay dưới ô tương ứng.
 */
export function CatalogFormDialog({
  config,
  action,
  id,
}: {
  config: CatalogConfig;
  action: "create" | "edit";
  id?: string | number;
}) {
  const isCreate = action === "create";

  const {
    refineCore: { onFinish, query },
    ...form
  } = useForm<CatalogRecord, HttpError, CatalogFormValues>({
    refineCoreProps: { resource: config.resource, action, id, redirect: "list" },
    defaultValues: { ...BASE_FORM_DEFAULTS, ...config.extraDefaults },
  });

  // Thêm mới: điền sẵn mã kế tiếp theo quy tắc sinh mã của danh mục (mã gõ tay như phường/xã thì không).
  const suggestedCode = useSuggestedCode(config.resource, form, isCreate && !config.codeRequired);

  // Form nạp NGUYÊN bản ghi (kèm id, ngày tạo…); chỉ gửi lên những trường form thật sự sửa.
  function onSubmit(values: CatalogFormValues) {
    const keys = [...BASE_FORM_KEYS, ...(config.extraKeys ?? [])];
    const payload = Object.fromEntries(keys.map((key) => [key, values[key]])) as CatalogFormValues;
    return onFinish(payload);
  }

  const { ExtraFields } = config;
  const submitting = form.formState.isSubmitting;
  const title = isCreate ? `Thêm ${config.noun}` : `Sửa ${config.noun}`;

  if (!isCreate && isRecordMissing(query)) {
    return (
      <RouteDialog title={title} description={config.description}>
        <RecordNotFound what={config.noun} />
      </RouteDialog>
    );
  }

  return (
    <RouteDialog
      title={title}
      description={config.description}
      footer={
        <Button type="submit" form={FORM_ID} disabled={submitting}>
          {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
          {isCreate ? "Thêm mới" : "Lưu"}
        </Button>
      }
    >
      <Form {...form}>
        <form id={FORM_ID} onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5 sm:grid-cols-2">
          <TextField
            control={form.control}
            name="code"
            label={config.codeLabel ?? "Mã"}
            placeholder={config.codePlaceholder}
            description={
              config.codeRequired
                ? undefined
                : suggestedCode
                  ? "Mã tự động, bạn vẫn sửa được."
                  : "Để trống để hệ thống tự cấp theo quy tắc sinh mã (nếu đã khai)."
            }
            rules={config.codeRequired ? { required: "Nhập mã" } : undefined}
          />
          <TextField
            control={form.control}
            name="name"
            label="Tên"
            placeholder={config.namePlaceholder}
            rules={{ required: "Nhập tên" }}
          />

          {ExtraFields ? <ExtraFields control={form.control} /> : null}

          <TextareaField control={form.control} name="note" label="Ghi chú" inGrid className="sm:col-span-2" />

          {!config.hideActive ? <SwitchField
            control={form.control}
            name="active"
            label="Đang hoạt động — tắt để ẩn khỏi các ô chọn mà không xoá"
            className="sm:col-span-2"
          /> : null}
        </form>
      </Form>
    </RouteDialog>
  );
}
