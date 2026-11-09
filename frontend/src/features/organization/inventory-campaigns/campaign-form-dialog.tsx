import type { HttpError } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";
import { Loader2 } from "lucide-react";

import { DateField, TextareaField, TextField } from "@/shared/components/form/simple-fields";
import { RouteDialog } from "@/shared/components/views/route-dialog";
import { isRecordMissing, RecordNotFound } from "@/shared/components/views/record-not-found";
import { todayLocal } from "@/shared/lib/format";
import { Button } from "@/shared/ui/button";
import { Form } from "@/shared/ui/form";
import type { InventoryCampaign } from "@/domains/inventory/types";

const FORM_ID = "inventory-campaign-form";
const DESCRIPTION = "Các trường lập biên bản kiểm kê theo đợt và nộp trước hạn.";

type CampaignFormValues = {
  title: string;
  cutoffDate: string;
  deadline: string;
  note: string;
} & Record<string, unknown>;

/**
 * Hộp thoại phát động / sửa đợt kiểm kê (KK-01), mở đè lên danh sách đợt. Phát động xong mở màn đợt
 * để theo dõi tiến độ; sửa xong về danh sách.
 */
export function CampaignFormDialog({ action, id }: { action: "create" | "edit"; id?: string | number }) {
  const isCreate = action === "create";
  const {
    refineCore: { onFinish, query },
    ...form
  } = useForm<InventoryCampaign, HttpError, CampaignFormValues>({
    refineCoreProps: { resource: "inventory_campaigns", action, id, redirect: isCreate ? "show" : "list" },
    defaultValues: { title: "", cutoffDate: todayLocal(), deadline: "", note: "" },
  });

  const title = isCreate ? "Phát động đợt kiểm kê" : "Sửa đợt kiểm kê";
  const submitting = form.formState.isSubmitting;

  if (!isCreate && isRecordMissing(query)) {
    return (
      <RouteDialog title={title} description={DESCRIPTION}>
        <RecordNotFound what="đợt kiểm kê" />
      </RouteDialog>
    );
  }

  // Chỉ gửi bốn ô của form, không gửi lại nguyên bản ghi đã nạp.
  function onSubmit(values: CampaignFormValues) {
    const { title: name, cutoffDate, deadline, note } = values;
    return onFinish({ title: name, cutoffDate, deadline, note });
  }

  return (
    <RouteDialog
      title={title}
      description={DESCRIPTION}
      footer={
        <Button type="submit" form={FORM_ID} disabled={submitting}>
          {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
          {isCreate ? "Phát động" : "Lưu"}
        </Button>
      }
    >
      <Form {...form}>
        <form id={FORM_ID} onSubmit={form.handleSubmit(onSubmit)} className="grid items-start gap-x-4 gap-y-5 sm:grid-cols-2">
          {isCreate ? (
            <p className="bg-warning-subtle text-warning-text rounded-md px-3 py-2 text-sm sm:col-span-2">
              Trường đang kiểm kê cả trường hoặc một phòng sẽ phải hoàn tất đợt hiện tại trước khi lập biên bản cho đợt mới.
            </p>
          ) : null}
          <TextField
            control={form.control}
            name="title"
            label="Tên đợt"
            placeholder="VD: Kiểm kê cuối năm học 2025-2026"
            rules={{ required: "Nhập tên đợt", maxLength: { value: 255, message: "Tên đợt tối đa 255 ký tự" } }}
            className="sm:col-span-2"
          />
          <DateField
            control={form.control}
            name="cutoffDate"
            label="Ngày chốt số liệu"
            rules={{ required: "Chọn ngày", deps: ["deadline"] }}
          />
          <DateField
            control={form.control}
            name="deadline"
            label="Hạn các trường nộp biên bản"
            rules={{
              required: "Chọn ngày",
              validate: (value: string, values: CampaignFormValues) =>
                !value || !values.cutoffDate || value >= values.cutoffDate || "Hạn nộp không được trước ngày chốt số liệu",
            }}
          />
          <TextareaField
            control={form.control}
            name="note"
            label="Hướng dẫn gửi các trường"
            rows={4}
            placeholder="VD: Kiểm kê toàn bộ tài sản còn trên sổ, nộp biên bản có chữ ký hiệu trưởng"
            rules={{ maxLength: { value: 1000, message: "Hướng dẫn tối đa 1000 ký tự" } }}
            className="max-w-none sm:col-span-2"
          />
        </form>
      </Form>
    </RouteDialog>
  );
}
