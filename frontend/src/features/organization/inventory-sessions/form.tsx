import { useList, useOne } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";
import { Lock, Save } from "lucide-react";
import { useEffect } from "react";
import { Controller, useWatch, type Control } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router";

import { RefField } from "@/shared/components/catalog/ref-field";
import { StaffListField } from "@/shared/components/catalog/staff-list-field";
import { DateField, TextareaField, TextField } from "@/shared/components/form/simple-fields";
import { CreateView, CreateViewHeader } from "@/shared/components/views/create-view";
import { EditView, EditViewHeader } from "@/shared/components/views/edit-view";
import { VoucherDetailsFields } from "@/shared/components/voucher/voucher-details";
import { SideFact, SideSection, StepTitle, VoucherTwoColumn } from "@/shared/components/voucher/voucher-layout";
import { useVoucherForm } from "@/shared/hooks/use-voucher-form";
import { cn } from "@/shared/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Form } from "@/shared/ui/form";
import { Skeleton } from "@/shared/ui/skeleton";
import type { InventorySession } from "@/domains/inventory/types";
import { CampaignPickerField } from "@/features/organization/inventory-sessions/campaign-picker";
import { useVoucherSchoolId, VoucherSchoolField } from "@/features/organization/vouchers/voucher-school-field";
import { todayLocal } from "@/shared/lib/format";

/* eslint-disable @typescript-eslint/no-explicit-any */

const RESOURCE = "inventory_sessions";

const DEFAULTS = {
  school: { id: null },
  campaign: { id: null },
  title: "",
  // Getter: tính lúc form mount (khi `defaults` được trải ra), không chốt lúc tải trang.
  get inventoryDate() {
    return todayLocal();
  },
  room: { id: null },
  council: "",
  conclusion: "",
  note: "",
  details: {},
};

/** Ô chỉ xem cùng hình với ô nhập — thứ hệ thống điền hoặc đã chốt lúc lập phiếu. */
function ReadOnlyCell({ label, value, placeholder, mono }: { label: string; value?: string | null; placeholder: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm leading-none font-medium">{label}</span>
      <div
        className={cn(
          "bg-muted/60 text-muted-foreground flex h-9 items-center truncate rounded-md border px-3 text-sm",
          value ? "text-foreground" : "italic",
          mono && value && "font-mono",
        )}
      >
        {value || placeholder}
      </div>
    </div>
  );
}

/**
 * Thân form Lập / Sửa phiếu kiểm kê — cùng khuôn với phiếu nhập: thẻ "Thông tin phiếu" (gồm cả tổ kiểm
 * kê), thông tin bổ sung, thẻ tóm tắt bên phải.
 *
 * <p>Phạm vi (cả trường / một phòng) và đợt của cấp trên chỉ chọn lúc LẬP: lưu phiếu là chụp sổ tài
 * sản đúng phạm vi đó thành các dòng kiểm đếm, nên đổi phạm vi sau đó nghĩa là phải lập lại phiếu.
 */
function InventoryFormBody({ control, record, setValue, creating, submitting, campaign }: {
  control: Control<any>;
  /** Đợt đã chọn sẵn (mở form từ dòng "Lập phiếu cho đợt này") — để ô chọn vẽ được tên trước khi danh sách tải xong. */
  campaign?: { id: number; name: string };
  record?: InventorySession;
  setValue: any;
  creating: boolean;
  submitting: boolean;
}) {
  const navigate = useNavigate();
  const config = useVoucherForm(RESOURCE);
  const schoolId = useVoucherSchoolId(control, record);
  const scoped = schoolId ? [{ field: "school.id", operator: "eq" as const, value: schoolId }] : [];
  const title = useWatch({ control, name: "title" });
  // Đợt của cấp trên là kiểm kê TOÀN BỘ: đã chọn đợt thì phạm vi là cả trường, không chọn phòng (máy chủ
  // cũng từ chối). Trường tự kiểm kê định kỳ (không gắn đợt) mới chọn được một phòng.
  const campaignId = useWatch({ control, name: "campaign.id" });
  useEffect(() => {
    if (creating && campaignId) setValue("room.id", null);
  }, [creating, campaignId, setValue]);

  const main = (
    <>
      <Card className="py-4">
        <CardContent className="space-y-4 px-4">
          <StepTitle
            title="Thông tin phiếu"
            hint={
              creating
                ? "Lưu phiếu là chốt danh sách thiết bị cần kiểm."
                : "Phạm vi và đợt không đổi được sau khi lập."
            }
          />
          <div className="form-flow">
            {creating ? <VoucherSchoolField control={control} record={record} setValue={setValue} /> : null}
            <DateField control={control} name="inventoryDate" label="Ngày kiểm kê" rules={{ required: "Chọn ngày" }} />
            {creating ? (
              <CampaignPickerField control={control} name="campaign" label="Đợt của Sở"
                hint="Chọn khi kiểm kê theo đợt cấp trên phát động." current={campaign}
                // Chọn đợt thì tên đợt của cấp trên thành tên phiếu, nếu người lập chưa gõ gì.
                onPicked={(c) => { if (!title && c?.name) setValue("title", c.name, { shouldDirty: true }); }} />
            ) : (
              <ReadOnlyCell label="Đợt của Sở" value={record?.campaign?.name} placeholder="Trường tự kiểm kê" />
            )}
            {creating && campaignId ? (
              <ReadOnlyCell label="Phạm vi kiểm kê" value="Cả trường" placeholder="—" />
            ) : creating ? (
              <RefField control={control} name="room" resource="rooms" label="Phạm vi kiểm kê" placeholder="Cả trường"
                hint="Chọn một phòng nếu chỉ kiểm kê phòng đó."
                filters={scoped} disabledHint={schoolId ? undefined : "Chọn trường trước"} />
            ) : (
              <ReadOnlyCell label="Phạm vi kiểm kê" value={record?.room?.name ?? "Cả trường"} placeholder="—" />
            )}
            <TextField control={control} name="title" label="Tên phiếu" rule="NAME" rules={{ required: "Nhập tên" }}
              placeholder="VD: Kiểm kê cuối năm" />
            {/* Tổ kiểm kê chọn từ nhân sự của trường, không gõ tay họ tên. */}
            <StaffListField control={control} name="council" label="Tổ kiểm kê" schoolId={schoolId} required
              mustFill="Chọn người trong tổ kiểm kê" />
            <TextareaField control={control} name="note" label="Ghi chú" rule="NOTE" inGrid />
            {!creating ? <TextareaField control={control} name="conclusion" label="Kết luận của tổ kiểm kê" rule="LONG_TEXT" max={2000} inGrid /> : null}
          </div>
        </CardContent>
      </Card>

      <Card className="py-4">
        <CardContent className="px-4">
          <Controller
            control={control}
            name="details"
            render={({ field }) => (
              <VoucherDetailsFields config={config} value={field.value} onChange={field.onChange} schoolId={schoolId} />
            )}
          />
        </CardContent>
      </Card>
    </>
  );

  const side = (
    <Card className="gap-0 py-0">
      <SideSection title="Phiếu kiểm kê">
        <SideFact label="Số phiếu">
          {record?.code ? <span className="font-mono">{record.code}</span> : <span className="text-muted-foreground font-normal">Cấp khi duyệt</span>}
        </SideFact>
        {record?.school?.name ? <SideFact label="Trường">{record.school.name}</SideFact> : null}
        <SideFact label="Tên phiếu">{title || <span className="text-warning-text font-normal">Chưa nhập</span>}</SideFact>
        <p className="bg-neutral-subtle text-neutral-text rounded-md px-2.5 py-2 text-xs">
          {creating
            ? campaignId
              ? "Kiểm kê toàn bộ theo đợt của cấp trên. Lưu là chụp danh sách thiết bị của cả trường thành danh sách kiểm đếm."
              : "Trường tự kiểm kê. Lưu là chụp danh sách thiết bị trong phạm vi đã chọn thành danh sách kiểm đếm."
            : "Phạm vi và đợt kiểm kê đã chốt lúc lập phiếu. Kết quả kiểm đếm ghi ở màn biên bản."}
        </p>
      </SideSection>
      <SideSection>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" className="min-w-0" onClick={() => navigate(-1)}>
            <span className="truncate">Huỷ</span>
          </Button>
          <Button type="submit" className="min-w-0" disabled={submitting}>
            <Save />
            <span className="truncate">{submitting ? "Đang lưu…" : creating ? "Lưu và lấy danh sách" : "Lưu thay đổi"}</span>
          </Button>
        </div>
      </SideSection>
    </Card>
  );

  return <VoucherTwoColumn main={main} side={side} />;
}

export const InventorySessionCreate = () => {
  const {
    refineCore: { onFinish },
    ...form
  } = useForm({ refineCoreProps: { redirect: "show" }, defaultValues: DEFAULTS as any });

  // Mở từ "Lập phiếu cho đợt này" (?campaign=<id>): chọn sẵn đợt và lấy tên đợt làm tên phiếu.
  const [params] = useSearchParams();
  const campaignId = Number(params.get("campaign")) || null;
  const { result: picked } = useOne<any>({ resource: "inventory_campaigns", id: campaignId ?? "", queryOptions: { enabled: campaignId != null } });
  useEffect(() => {
    if (!picked?.id) return;
    form.setValue("campaign.id" as any, picked.id);
    if (!form.getValues("title" as any)) form.setValue("title" as any, picked.title ?? picked.name ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked?.id]);

  // Không mở từ một đợt cụ thể mà Sở đang mở ĐÚNG MỘT đợt: chọn sẵn đợt đó — phần lớn phiếu kiểm kê là theo đợt của
  // Sở; người lập vẫn đổi được sang "Trường tự kiểm kê".
  const { result: openCampaigns } = useList<any>({
    resource: "inventory_campaigns",
    pagination: { currentPage: 1, pageSize: 50 },
    queryOptions: { enabled: campaignId == null },
  });
  const onlyOpen = (openCampaigns?.data ?? []).filter((c: any) => !c.closed);
  const soleOpen = onlyOpen.length === 1 ? onlyOpen[0] : null;
  useEffect(() => {
    if (!soleOpen?.id || form.getValues("campaign.id" as any)) return;
    form.setValue("campaign.id" as any, soleOpen.id);
    if (!form.getValues("title" as any)) form.setValue("title" as any, soleOpen.title ?? soleOpen.name ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soleOpen?.id]);

  return (
    <CreateView>
      <CreateViewHeader />
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((v: any) =>
            onFinish({
              school: v.school?.id ? { id: v.school.id } : null,
              campaign: v.campaign?.id ? { id: v.campaign.id } : null,
              title: v.title,
              inventoryDate: v.inventoryDate,
              room: v.room?.id ? { id: v.room.id } : null,
              council: v.council,
              note: v.note,
              details: v.details ?? {},
            }),
          )}
          className="w-full"
        >
          <InventoryFormBody control={form.control as any} setValue={form.setValue} creating submitting={form.formState.isSubmitting}
            campaign={picked?.id ? { id: picked.id, name: picked.name ?? picked.title } : undefined} />
        </form>
      </Form>
    </CreateView>
  );
};

export const InventorySessionEdit = () => {
  const navigate = useNavigate();
  const {
    refineCore: { onFinish, query },
    ...form
  } = useForm({ refineCoreProps: { redirect: "show" }, defaultValues: DEFAULTS as any });
  const record = query?.data?.data as InventorySession | undefined;

  useEffect(() => {
    if (!record) return;
    form.reset({
      title: record.title,
      inventoryDate: record.inventoryDate,
      council: record.council ?? "",
      conclusion: record.conclusion ?? "",
      note: record.note ?? "",
      details: record.details ?? {},
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record?.id, record?.updatedAt]);

  if (query?.isLoading) {
    return (
      <EditView>
        <EditViewHeader />
        <Skeleton className="h-96 w-full" />
      </EditView>
    );
  }
  if (record && record.status !== "DRAFT") {
    return (
      <EditView>
        <EditViewHeader />
        <Alert>
          <Lock className="text-warning-text" />
          <AlertTitle>Biên bản không còn sửa được</AlertTitle>
          <AlertDescription>
            <p>Chỉ sửa được phiếu nháp. Biên bản đã trình thì chờ lãnh đạo trả lại mới sửa được, đã duyệt thì không sửa nữa.</p>
            <Button type="button" variant="outline" size="sm" onClick={() => navigate(-1)}>
              Quay lại biên bản
            </Button>
          </AlertDescription>
        </Alert>
      </EditView>
    );
  }

  return (
    <EditView>
      <EditViewHeader />
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((v: any) =>
            onFinish({
              title: v.title,
              inventoryDate: v.inventoryDate,
              council: v.council,
              conclusion: v.conclusion,
              note: v.note,
              details: v.details ?? {},
            }),
          )}
          className="w-full"
        >
          <InventoryFormBody control={form.control as any} record={record} setValue={form.setValue}
            creating={false} submitting={form.formState.isSubmitting} />
        </form>
      </Form>
    </EditView>
  );
};
