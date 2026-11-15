import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";

import { kyInstance } from "@/shared/api/data";
import { DateField, TextareaField, TextField } from "@/shared/components/form/simple-fields";
import { errorMessage } from "@/shared/lib/api-error";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { Label } from "@/shared/ui/label";
import { RadioGroup, RadioGroupItem } from "@/shared/ui/radio-group";

type Kind = "AMENDMENT" | "CORRECTION";

/** Một thông tư Sở có thể chọn điều chỉnh — bộ đang áp dụng của một cấp. */
export type ReviseTarget = { id: number; circular: string; level: string; busy: boolean };

type Values = {
  standardIds: number[];
  kind: Kind;
  document: { documentNo: string; documentName: string; issuingAuthority: string; issueDate: string | null; effectiveDate: string | null };
  reason: string;
  standardVersion: string;
};

const KINDS: { value: Kind; label: string; hint: string }[] = [
  { value: "AMENDMENT", label: "Sửa đổi, bổ sung", hint: "Bộ ra thông tư sửa đổi, bổ sung danh mục" },
  { value: "CORRECTION", label: "Đính chính", hint: "Sửa cho khớp văn bản đang có, hoặc theo quyết định đính chính" },
];

const EMPTY: Values = {
  standardIds: [],
  kind: "AMENDMENT",
  document: { documentNo: "", documentName: "", issuingAuthority: "Bộ Giáo dục và Đào tạo", issueDate: null, effectiveDate: null },
  reason: "",
  standardVersion: "",
};

/**
 * Lập bộ mới — một lần sửa danh mục tối thiểu phải có CĂN CỨ. Danh mục mỗi cấp chỉ có một thông tư gốc; Bộ chỉ sửa nó
 * bằng thông tư sửa đổi, bổ sung (khai văn bản) hoặc đính chính (ghi lý do, có quyết định thì khai kèm). Máy chủ kiểm
 * lại cùng luật (`EquipmentStandardService.reviseMany`) và báo lỗi theo ô.
 *
 * Sở chọn thông tư cần điều chỉnh — chỉ TT 37, hay 38 và 39, hay cả ba (TT 26/2023 sửa chung cả ba). Mỗi thông tư được
 * chọn có một bản nháp riêng, cùng văn bản; kiểm tra xong thì Áp dụng từng bộ — từ lúc đó mới tính đủ / thiếu theo nó.
 */
export function ReviseDialog({ targets, initialId, open, onOpenChange, onCreated }: {
  /** Bộ đang áp dụng của các cấp — mỗi bộ là một thông tư gốc. */
  targets: ReviseTarget[];
  /** Thông tư của cấp đang xem — chọn sẵn. */
  initialId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (drafts: { id: number; educationLevel?: { name: string } | null }[]) => void;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ô dùng chung nhận `Control<any>`
  const form = useForm<any>({ defaultValues: EMPTY, mode: "onChange" });
  const { control, reset, setError, getValues } = form;
  const kind = useWatch({ control, name: "kind" });
  const docNo = useWatch({ control, name: "document.documentNo" });
  const amendment = kind === "AMENDMENT";
  const picked = (useWatch({ control, name: "standardIds" }) ?? []) as number[];
  useEffect(() => {
    if (!open) return;
    const first = targets.find((t) => t.id === initialId && !t.busy);
    reset({ ...EMPTY, standardIds: first ? [first.id] : [] });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ đặt lại khi mở hộp
  }, [open, reset]);
  const toggle = (id: number, on: boolean) => {
    form.setValue("standardIds", on ? [...picked, id] : picked.filter((x) => x !== id), { shouldValidate: true });
  };

  const submit = form.handleSubmit(async (raw) => {
    const v = raw as Values;
    const withDoc = amendment || v.document.documentNo.trim() !== "";
    try {
      const created = await kyInstance
        .post("equipment_standards/revise", {
          json: {
            standardIds: v.standardIds,
            kind: v.kind,
            document: withDoc ? v.document : null,
            reason: v.reason.trim() || null,
            standardVersion: v.standardVersion.trim() || null,
          },
        })
        .json<{ id: number; educationLevel?: { name: string } | null }[]>();
      onCreated(created);
    } catch (error) {
      const errors = (error as { errors?: Record<string, string> })?.errors;
      if (errors && Object.keys(errors).length) {
        for (const [field, message] of Object.entries(errors)) {
          setError(field, { type: "server", message }, { shouldFocus: true });
        }
      } else {
        setError("root", { message: await errorMessage(error) });
      }
    }
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !form.formState.isSubmitting && onOpenChange(o)}>
      {/* Cỡ cố định: đổi Sửa đổi / Đính chính (số ô khác nhau) hộp không co giãn; nút ở đáy. */}
      <DialogContent size="form">
        <DialogHeader>
          <DialogTitle>Lập bộ mới</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={submit} className="space-y-5">
            <RadioGroup value={kind} onValueChange={(v) => { form.setValue("kind", v as Kind); form.clearErrors(); }}
              className="grid gap-2 sm:grid-cols-2">
              {KINDS.map((k) => (
                <Label key={k.value} htmlFor={`kind-${k.value}`}
                  className={cn("flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 font-normal",
                    kind === k.value && "border-primary bg-primary/5")}>
                  <RadioGroupItem id={`kind-${k.value}`} value={k.value} className="mt-0.5" />
                  <span className="grid gap-0.5">
                    <span className="font-medium">{k.label}</span>
                    <span className="text-muted-foreground text-xs">{k.hint}</span>
                  </span>
                </Label>
              ))}
            </RadioGroup>

            <FormField control={control} name="standardIds" rules={{ validate: (ids: number[]) => ids?.length > 0 || "Chọn thông tư cần điều chỉnh" }}
              render={() => (
                <FormItem>
                  <FormLabel required>Thông tư điều chỉnh</FormLabel>
                  <div className="flex flex-wrap gap-2">
                    {targets.map((t) => (
                      <label key={t.id} title={t.busy ? "Đang có bản nháp chưa áp dụng" : undefined}
                        className={cn("flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm",
                          t.busy ? "text-muted-foreground cursor-not-allowed opacity-60" : "cursor-pointer",
                          picked.includes(t.id) && "border-primary bg-primary/5")}>
                        <Checkbox checked={picked.includes(t.id)} disabled={t.busy} onCheckedChange={(v) => toggle(t.id, v === true)} />
                        <span className="font-medium">TT {t.circular}</span>
                        <span className="text-muted-foreground">{t.level}{t.busy ? " · đang có nháp" : ""}</span>
                      </label>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )} />

            {amendment ? (
              <div className="grid items-start gap-x-4 gap-y-5 sm:grid-cols-2">
                <TextField control={control} name="document.documentNo" label="Số hiệu văn bản" placeholder="12/2026/TT-BGDĐT"
                  rule="SHORT_TEXT" max={100} rules={{ required: "Nhập số hiệu văn bản" }} />
                <TextField control={control} name="document.issuingAuthority" label="Cơ quan ban hành" rule="NAME" />
                <TextareaField control={control} name="document.documentName" label="Trích yếu" rule="NOTE" className="sm:col-span-2"
                  placeholder="Sửa đổi, bổ sung Danh mục thiết bị dạy học tối thiểu…" rules={{ required: "Nhập trích yếu" }} />
                <DateField control={control} name="document.issueDate" label="Ngày ban hành" dateRule="PAST_OR_TODAY"
                  rules={{ required: "Nhập ngày ban hành", deps: ["document.effectiveDate"] }} />
                <DateField control={control} name="document.effectiveDate" label="Ngày hiệu lực"
                  rules={{
                    required: "Nhập ngày hiệu lực",
                    validate: (d: string | null) => {
                      const issued = getValues("document.issueDate");
                      return !d || !issued || d >= issued || "Không được trước ngày ban hành";
                    },
                  }} />
              </div>
            ) : (
              <div className="grid items-start gap-x-4 gap-y-5 sm:grid-cols-2">
                <TextareaField control={control} name="reason" label="Lý do đính chính" rule="NOTE" className="sm:col-span-2"
                  placeholder="VD: Phụ lục XI mục II số 8 — sửa tên theo QĐ 1450/QĐ-BGDĐT" rules={{ required: "Nhập lý do đính chính" }} />
                <TextField control={control} name="document.documentNo" label="Quyết định đính chính" placeholder="Không bắt buộc"
                  rule="SHORT_TEXT" max={100} />
                <DateField control={control} name="document.issueDate" label="Ngày ban hành" dateRule="PAST_OR_TODAY"
                  rules={{ validate: (d: string | null) => !docNo?.trim() || !!d || "Nhập ngày ban hành của quyết định" }} />
              </div>
            )}

            <TextField control={control} name="standardVersion" label="Phiên bản của bộ mới" className="sm:max-w-[22rem]"
              placeholder="Để trống thì tự đặt theo lần sửa" rule="SHORT_TEXT" max={50} />

            {form.formState.errors.root?.message ? (
              <p className="text-destructive text-sm">{form.formState.errors.root.message}</p>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={form.formState.isSubmitting}>
                Huỷ
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Đang lập…" : "Lập bộ nháp"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
