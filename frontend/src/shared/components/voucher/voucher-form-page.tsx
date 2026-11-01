import { useCan, useGetIdentity, useInvalidate, useNavigation, useNotification, useResourceParams, useTranslate } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";
import { Loader2, Lock, Save, Send } from "lucide-react";
import { memo, useEffect, useState, type ReactNode } from "react";
import { useWatch, type Control, type UseFormSetValue, type UseFormWatch } from "react-hook-form";
import { useNavigate } from "react-router";

import { kyInstance } from "@/shared/api/data";
import { CreateView, CreateViewHeader } from "@/shared/components/views/create-view";
import { EditView, EditViewHeader } from "@/shared/components/views/edit-view";
import { CompletionList, SideFact, SideSection, StepTitle, VoucherLinesSlot, VoucherTwoColumn, type ChecklistItem } from "@/shared/components/voucher/voucher-layout";
import { useApprovalSteps } from "@/shared/hooks/use-approval-steps";
import { usePerspective } from "@/shared/hooks/use-perspective";
import { errorMessage } from "@/shared/lib/api-error";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Form, RequiredFieldsProvider } from "@/shared/ui/form";
import { Skeleton } from "@/shared/ui/skeleton";
import type { VoucherBase } from "@/domains/voucher/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Ô có giá trị chưa: tham chiếu `{id}` cần id, chuỗi không rỗng, số / ngày có mặt. */
function filledValue(v: unknown): boolean {
  if (v == null || v === "") return false;
  if (typeof v === "object" && !Array.isArray(v)) return (v as { id?: unknown }).id != null && (v as { id?: unknown }).id !== "";
  return true;
}

export type VoucherFieldsProps = {
  control: Control<any>;
  watch: UseFormWatch<any>;
  setValue: UseFormSetValue<any>;
  record?: any;
};

/**
 * Phần riêng của loại phiếu (ô đầu phiếu, bảng dòng) — tách thành component ghi nhớ: `VoucherFormPage`
 * theo dõi CẢ form (cho "Cần hoàn thiện"), nên vẽ lại theo mỗi phím gõ; không có lớp này thì mỗi phím
 * vẽ lại luôn cả bảng dòng. Các ô bên trong tự cập nhật qua `Controller` / `useWatch` của chính chúng.
 */
const VoucherFields = memo(function VoucherFields({ render, ...props }: VoucherFieldsProps & { render: (p: VoucherFieldsProps) => ReactNode }) {
  return <>{render(props)}</>;
});

/**
 * Trang lập / sửa phiếu dùng chung. Lưu xong đi thẳng tới màn chi tiết: việc tiếp theo của người vừa
 * lập phiếu (trình duyệt) nằm ở đó. Màn sửa chỉ mở với phiếu NHÁP.
 *
 * HAI CỘT: trái là các thẻ xếp theo thứ tự điền — thông tin phiếu (`children` vẽ các ô), bảng dòng
 * (form của loại phiếu vẽ qua `VoucherLinesCard`); phải là thẻ tóm tắt dính khi cuộn — số phiếu,
 * người lập, còn thiếu gì, và hai nút Lưu nháp · Trình (lưu rồi trình một lần bấm).
 *
 * Cách dùng:
 * <pre>
 * <VoucherFormPage mode="create" defaults={{ intakeDate: "", supplier: "", lines: [] }}
 *     toPayload={(v) => ({ intakeDate: v.intakeDate, supplier: v.supplier, lines: linesPayload(v.lines) })}
 *     required={[{ name: "intakeDate", label: "Ngày nhập" }]}>
 *   {({ control }) => <>...các ô...<VoucherLinesCard>...bảng dòng...</VoucherLinesCard></>}
 * </VoucherFormPage>
 * </pre>
 *
 * @param toForm    bản ghi → giá trị form (màn sửa)
 * @param toPayload giá trị form → payload gửi lên (bỏ các trường chỉ để hiển thị)
 */
export function VoucherFormPage({
  mode,
  defaults,
  toForm,
  toPayload,
  children,
  required = [],
  linesOptional,
  notice,
}: {
  mode: "create" | "edit";
  defaults: Record<string, any>;
  toForm?: (record: any) => Record<string, any>;
  toPayload: (values: any) => Record<string, any>;
  children: (props: VoucherFieldsProps) => ReactNode;
  /**
   * Ô BẮT BUỘC của phần chính — vào danh sách "Cần hoàn thiện" để nút Trình không sáng khi máy chủ sẽ
   * từ chối. `when` làm bắt buộc CÓ ĐIỀU KIỆN: vắng mặt là luôn bắt buộc.
   */
  required?: { name: string; label: string; when?: (values: Record<string, unknown>) => boolean }[];
  /** Bảng dòng là tuỳ chọn — phiếu không dòng vẫn trình được. */
  linesOptional?: boolean;
  /** Lời nhắc KHÔNG CHẶN dưới "Cần hoàn thiện" — không làm tắt nút Trình. */
  notice?: (props: { control: Control<any>; record?: any }) => ReactNode;
}) {
  const navigate = useNavigate();
  const {
    refineCore: { onFinish, query },
    ...form
  } = useForm({
    refineCoreProps: { redirect: "show" },
    defaultValues: { ...defaults } as Record<string, any>,
  });
  const record = query?.data?.data as (VoucherBase & Record<string, any>) | undefined;
  const { resource } = useResourceParams();
  const name = resource?.name ?? "";
  const steps = useApprovalSteps(name || undefined);
  const lines = useWatch({ control: form.control, name: "lines" });
  const requiredValues = useWatch({ control: form.control, name: required.map((r) => r.name) }) as unknown[];
  // watch() nguyên form: `when` của ô bắt buộc có điều kiện đọc ô KHÁC, thứ không nằm trong `required`.
  const formValues = form.watch();
  const translate = useTranslate();
  const { show } = useNavigation();
  const invalidate = useInvalidate();
  const { open: notify } = useNotification();
  const { data: me } = useGetIdentity<{ fullName?: string; username?: string }>();
  const [linesSlot, setLinesSlot] = useState<HTMLElement | null>(null);
  const [busy, setBusy] = useState<"save" | "submit" | null>(null);
  const canApprove = useCan({ resource: name, action: "approve" }).data?.can ?? false;
  const { perspective } = usePerspective();

  useEffect(() => {
    if (mode === "edit" && record && toForm) form.reset(toForm(record));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, record?.id, record?.updatedAt]);

  const Header = mode === "create" ? CreateViewHeader : EditViewHeader;
  const View = mode === "create" ? CreateView : EditView;

  if (mode === "edit" && query?.isLoading) {
    return (
      <View>
        <Header />
        <Skeleton className="h-96 w-full" />
      </View>
    );
  }
  if (mode === "edit" && record && record.status !== "DRAFT") {
    return (
      <View>
        <Header />
        <Alert>
          <Lock className="text-warning-text" />
          <AlertTitle>Phiếu không còn sửa được</AlertTitle>
          <AlertDescription>
            <p>Chỉ sửa được phiếu nháp. Phiếu đang chờ duyệt thì phải được trả lại mới sửa được.</p>
            <Button type="button" variant="outline" size="sm" onClick={() => navigate(-1)}>
              Quay lại phiếu
            </Button>
          </AlertDescription>
        </Alert>
      </View>
    );
  }

  const title = translate(`${name}.${name}`, (resource?.meta?.label as string | undefined) ?? "Phiếu");
  const creator = record ? undefined : (me?.fullName ?? me?.username);
  const hasLines = Array.isArray(defaults.lines);
  const lineCount = Array.isArray(lines) ? lines.length : 0;
  // Bấm một mục "cần hoàn thiện" là cuộn tới đúng khối chứa ô đó.
  const goTo = (containerId: string) => () =>
    document.getElementById(containerId)?.scrollIntoView({ behavior: "smooth", block: "center" });
  const items: ChecklistItem[] = [
    ...required.map(({ name: field, label, when }, i) => ({
      key: `f:${field}`,
      label: `Chưa chọn / nhập: ${label}`,
      ok: (when && !when(formValues)) || filledValue(requiredValues?.[i]),
      onClick: goTo("voucher-head"),
    })),
    ...(hasLines && !linesOptional
      ? [{ key: "lines", label: "Chưa có dòng nào trên phiếu", ok: lineCount > 0, onClick: goTo("voucher-lines") }]
      : []),
  ];
  const missing = items.filter((i) => !i.ok);
  const submitRequired = new Set(required.filter(({ when }) => !when || when(formValues)).map(({ name }) => name));
  // Người DUYỆT của trường (lãnh đạo trường) không có nút Trình: trình là việc của người lập gửi lên
  // cho họ. Phiếu đã lưu thì theo đúng danh sách hành động máy chủ trả về.
  const maySubmit = record ? (record._actions ?? []).includes("submit") : !(canApprove && perspective === "school");
  // Loại phiếu KHÔNG qua cấp duyệt nào: bấm là hệ thống ghi nhận và khoá phiếu ngay — hai nút là "Lưu"
  // và "Duyệt" chứ không phải "Lưu nháp" và "Trình".
  const direct = steps?.length === 0;
  const saveLabel = direct ? "Lưu" : "Lưu nháp";
  const submitLabel = direct ? "Duyệt" : "Trình";

  const send = async (values: any) => onFinish(toPayload(values)) as Promise<any>;
  const saveDraft = form.handleSubmit(async (values) => {
    setBusy("save");
    try {
      await send(values);
    } finally {
      setBusy(null);
    }
  });
  /**
   * Lưu rồi trình. Trình hỏng (luật máy chủ từ chối) thì phiếu ĐÃ là nháp — mở phiếu đó, không ở lại
   * form tạo: bấm lần nữa ở đây là thành hai phiếu.
   */
  const saveAndSubmit = form.handleSubmit(async (values) => {
    setBusy("submit");
    let id: number | undefined;
    try {
      const res: any = await Promise.resolve(send(values)).catch(() => null);
      id = res?.data?.id ?? record?.id;
      if (!res || !id) return;
      const after = await kyInstance.post(`${name}/${id}/submit`).json<{ status?: string }>();
      const waiting = after?.status === "PENDING";
      notify?.({ type: "success", message: waiting || !direct ? "Đã trình phiếu" : "Đã duyệt, hệ thống đã ghi nhận phiếu" });
    } catch (error) {
      notify?.({ type: "error", message: await errorMessage(error), description: direct ? "Đã lưu nhưng chưa duyệt được" : "Đã lưu nháp nhưng chưa trình được" });
    } finally {
      setBusy(null);
      if (id) {
        invalidate({ resource: name, invalidates: ["list", "detail"], id });
        show(name, id, "replace");
      }
    }
  });

  const main = (
    <>
      <Card id="voucher-head" className="@container gap-4 px-4 py-4">
        <StepTitle title="Thông tin phiếu" />
        <VoucherLinesSlot.Provider value={linesSlot}>
          <RequiredFieldsProvider names={submitRequired}>
            <VoucherFields render={children} control={form.control} watch={form.watch} record={record} setValue={form.setValue} />
          </RequiredFieldsProvider>
        </VoucherLinesSlot.Provider>
      </Card>
      {/* Bảng dòng: form của loại phiếu vẽ vào đây qua `VoucherLinesCard`. Loại phiếu không có bảng dòng thì thẻ tự ẩn. */}
      <Card id="voucher-lines" ref={setLinesSlot} className="gap-0 overflow-hidden py-0 empty:hidden" />
    </>
  );

  const side = (
    <Card className="gap-0 py-0">
      <SideSection title={title}>
        <SideFact label="Số phiếu">
          {record?.code ? <span className="font-mono">{record.code}</span> : <span className="text-muted-foreground font-normal">Cấp khi trình</span>}
        </SideFact>
        {creator ? <SideFact label="Người lập">{creator}</SideFact> : null}
        {hasLines ? <SideFact label="Số dòng"><span className="tabular-nums">{lineCount}</span></SideFact> : null}
      </SideSection>

      <SideSection title={missing.length ? `Cần hoàn thiện (${missing.length})` : direct ? "Kiểm tra trước khi duyệt" : "Kiểm tra trước khi trình"}>
        <CompletionList items={items} />
        {notice?.({ control: form.control, record })}
      </SideSection>

      <SideSection className="space-y-2">
        <div className={maySubmit ? "grid grid-cols-2 gap-2" : "grid gap-2"}>
          <Button type="button" variant={maySubmit ? "outline" : "default"} disabled={busy != null} onClick={() => void saveDraft()}>
            {busy === "save" ? <Loader2 className="animate-spin" /> : <Save />}
            {saveLabel}
          </Button>
          {maySubmit ? (
            <Button type="button" disabled={busy != null || missing.length > 0}
              title={missing.length ? "Hoàn thiện các mục ở trên trước" : direct ? "Lưu và duyệt — phiếu này không cần trình lên cấp trên" : "Lưu và trình phiếu"}
              onClick={() => void saveAndSubmit()}>
              {busy === "submit" ? <Loader2 className="animate-spin" /> : <Send />}
              {submitLabel}
            </Button>
          ) : null}
        </div>
        <Button type="button" variant="ghost" size="sm" className="w-full" disabled={busy != null} onClick={() => navigate(-1)}>
          Huỷ
        </Button>
      </SideSection>
    </Card>
  );

  return (
    <View>
      <Header />
      <Form {...form}>
        <form
          onSubmit={(e) => { e.preventDefault(); void saveDraft(); }}
          // Enter trong một ô không lưu phiếu: lưu là việc của nút.
          onKeyDown={(e) => { if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") e.preventDefault(); }}
          className="w-full"
        >
          <VoucherTwoColumn main={main} side={side} />
        </form>
      </Form>
    </View>
  );
}

/** Dòng phiếu → payload: chỉ các khoá được giữ (`keep`) cộng các trường riêng. */
export function linesPayload(lines: any[] | undefined, extra?: (line: any) => Record<string, any>) {
  return (lines ?? []).map((l) => ({
    ...(l.id ? { id: l.id } : {}),
    note: l.note || null,
    ...(extra ? extra(l) : {}),
  }));
}
