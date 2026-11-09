import { useWatch, type Control, type UseFormSetValue } from "react-hook-form";

import { AsyncCombobox } from "@/shared/components/form/async-combobox";
import { FormHint } from "@/shared/components/form/help-hint";
import { DateField, TextareaField, TextField } from "@/shared/components/form/simple-fields";
import { VoucherFormPage, type VoucherFieldsProps } from "@/shared/components/voucher/voucher-form-page";
import { StepTitle } from "@/shared/components/voucher/voucher-layout";
import { todayLocal } from "@/shared/lib/format";
import { Card, CardContent } from "@/shared/ui/card";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import type { InventoryCampaign, InventorySession } from "@/domains/inventory/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

type CampaignValue = { id: number | null; name?: string | null };

const DEFAULTS = {
  campaign: { id: null } as CampaignValue,
  title: "",
  // Getter: tính lúc form mở, không chốt lúc tải trang.
  get inventoryDate() {
    return todayLocal();
  },
  council: "",
  conclusion: "",
  note: "",
};

const textOrNull = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

function toForm(r: InventorySession) {
  return {
    campaign: r.campaign ? { id: r.campaign.id, name: r.campaign.name } : { id: null },
    title: r.title ?? "",
    inventoryDate: r.inventoryDate ?? "",
    council: r.council ?? "",
    conclusion: r.conclusion ?? "",
    note: r.note ?? "",
  };
}

function toPayload(v: typeof DEFAULTS) {
  return {
    campaign: v.campaign?.id ? { id: v.campaign.id } : null,
    title: textOrNull(v.title),
    inventoryDate: v.inventoryDate || null,
    council: textOrNull(v.council),
    conclusion: textOrNull(v.conclusion),
    note: textOrNull(v.note),
  };
}

/** Ô chỉ xem cùng hình với ô nhập — thứ đã chốt lúc lập phiếu. */
function ReadOnlyCell({ label, value, placeholder }: { label: string; value?: string | null; placeholder: string }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm leading-none font-medium">{label}</span>
      <div className={`bg-muted/60 flex h-9 items-center truncate rounded-md border px-3 text-sm ${value ? "" : "text-muted-foreground italic"}`}>
        {value || placeholder}
      </div>
    </div>
  );
}

/** Chọn đợt của Sở. Chọn đợt mà tên phiếu còn trống thì lấy tên đợt làm tên phiếu. */
function CampaignField({ control, setValue }: { control: Control<any>; setValue: UseFormSetValue<any> }) {
  const title = useWatch({ control, name: "title" });
  return (
    <FormField
      control={control}
      name="campaign"
      render={({ field }) => {
        const current = field.value as CampaignValue | null;
        return (
          <FormItem>
            <FormLabel>Đợt của Sở</FormLabel>
            <FormControl>
              <AsyncCombobox<InventoryCampaign>
                resource="inventory_campaigns"
                value={current?.id ?? null}
                onChange={(id) => field.onChange({ id })}
                onPick={(campaign) => {
                  if (!title) setValue("title", campaign.title, { shouldDirty: true });
                }}
                labelOf={(campaign) => campaign.title}
                fallbackLabel={current?.name ?? undefined}
                sortField="cutoffDate"
                placeholder="Trường tự kiểm kê"
                clearLabel="Không theo đợt"
              />
            </FormControl>
            <FormHint>Chọn khi kiểm kê theo đợt Sở phát động.</FormHint>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}

/**
 * Thân form Lập / Sửa phiếu kiểm kê. Đợt chỉ chọn lúc LẬP: lưu phiếu là chụp sổ tài sản thành các
 * dòng kiểm đếm, nên đổi phạm vi sau đó nghĩa là phải lập lại phiếu.
 */
function InventoryFields({ control, setValue, record }: VoucherFieldsProps) {
  const creating = !record;
  const session = record as InventorySession | undefined;
  return (
    <Card className="py-4">
      <CardContent className="space-y-4 px-4">
        <StepTitle
          title="Thông tin phiếu"
          hint={creating ? "Lưu phiếu là chốt danh sách tài sản cần kiểm." : "Phạm vi và đợt không đổi được sau khi lập."}
        />
        <div className="form-flow">
          <DateField control={control} name="inventoryDate" label="Ngày kiểm kê" rules={{ required: "Chọn ngày" }} />
          {creating ? (
            <CampaignField control={control} setValue={setValue} />
          ) : (
            <ReadOnlyCell label="Đợt của Sở" value={session?.campaign?.name} placeholder="Trường tự kiểm kê" />
          )}
          <ReadOnlyCell label="Phạm vi kiểm kê" value={session?.room?.name ?? "Cả trường"} placeholder="—" />
          <TextField control={control} name="title" label="Tên phiếu" placeholder="VD: Kiểm kê cuối năm"
            rules={{ required: "Nhập tên", maxLength: { value: 255, message: "Tên phiếu tối đa 255 ký tự" } }} />
          <TextareaField control={control} name="council" label="Tổ kiểm kê" inGrid
            placeholder="VD: Nguyễn Văn A (Hiệu trưởng), Trần Thị B (Cán bộ thiết bị)"
            rules={{ required: "Chọn người trong tổ kiểm kê", maxLength: { value: 1000, message: "Tổ kiểm kê tối đa 1000 ký tự" } }} />
          <TextareaField control={control} name="note" label="Ghi chú" inGrid
            rules={{ maxLength: { value: 500, message: "Ghi chú tối đa 500 ký tự" } }} />
          {!creating ? (
            <TextareaField control={control} name="conclusion" label="Kết luận của tổ kiểm kê" inGrid
              rules={{ maxLength: { value: 2000, message: "Kết luận tối đa 2000 ký tự" } }} />
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

const REQUIRED = [
  { name: "inventoryDate", label: "Ngày kiểm kê" },
  { name: "title", label: "Tên phiếu" },
  { name: "council", label: "Tổ kiểm kê" },
];

/** Lập / sửa phiếu kiểm kê (KK-03). */
function InventorySessionForm({ mode }: { mode: "create" | "edit" }) {
  return (
    <VoucherFormPage mode={mode} defaults={DEFAULTS} toForm={toForm} toPayload={toPayload} required={REQUIRED} linesOptional>
      {(props) => <InventoryFields {...props} />}
    </VoucherFormPage>
  );
}

export const InventorySessionCreate = () => <InventorySessionForm mode="create" />;
export const InventorySessionEdit = () => <InventorySessionForm mode="edit" />;
