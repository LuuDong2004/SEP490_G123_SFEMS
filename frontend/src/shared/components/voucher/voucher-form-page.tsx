import { useCan, useGetIdentity, useGo, useInvalidate, useListButton, useNavigation, useNotification, useResourceParams, useTranslate } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";
import { ArrowLeft, Loader2, Lock, Save, Send } from "lucide-react";
import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import { Controller, useWatch, type Control, type UseFormWatch } from "react-hook-form";
import { Navigate, useNavigate, useSearchParams } from "react-router";

import { CreateView, CreateViewHeader } from "@/shared/components/views/create-view";
import { EditView, EditViewHeader } from "@/shared/components/views/edit-view";
import { kyInstance } from "@/shared/api/data";
import { useConfirmDiscard } from "@/shared/components/form/unsaved-changes-guard";
import { errorMessage } from "@/shared/lib/api-error";
import { lowerLabel } from "@/shared/lib/label";
import { AttachmentsPanel } from "@/shared/components/voucher/attachments-panel";
import { PendingAttachments, usePendingAttachments } from "@/shared/components/voucher/pending-attachments";
import { CompletionList, SideFact, SideSection, StepTitle, VoucherLinesSlot, VoucherTwoColumn, type ChecklistItem } from "@/shared/components/voucher/voucher-layout";
import { Card } from "@/shared/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Button } from "@/shared/ui/button";
import { Form, RequiredFieldsProvider } from "@/shared/ui/form";
import { Skeleton } from "@/shared/ui/skeleton";
import { detailsError, headFillCount, VoucherDetailsFields } from "@/shared/components/voucher/voucher-details";
import { usePerspective } from "@/shared/hooks/use-perspective";
import { useVoucherForm } from "@/shared/hooks/use-voucher-form";
import { InventoryFreezeNotice } from "@/shared/components/voucher/inventory-freeze-notice";
import type { VoucherBase } from "@/domains/voucher/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Trang lập / sửa phiếu dùng chung. Lưu xong đi thẳng tới màn chi tiết: việc tiếp
 * theo của người vừa lập phiếu (trình duyệt, đính kèm chứng từ) nằm ở đó.
 *
 * <p>Màn sửa chỉ mở với phiếu NHÁP. Phiếu đã trình thì hiện lời giải thích thay
 * vì một form sẽ bị server từ chối khi lưu.
 *
 * <p>HAI CỘT như phiếu nhập (`voucher-layout.tsx`): trái là các thẻ xếp theo thứ tự điền — thông tin
 * phiếu, bảng dòng (form của loại phiếu vẽ qua `VoucherLinesCard`), thông tin bổ sung, tệp đính
 * kèm; phải là thẻ tóm tắt dính khi cuộn — số phiếu, người lập, còn thiếu gì, và hai nút Lưu nháp ·
 * Trình (lưu rồi trình một lần bấm).
 *
 * <p>Dưới phần riêng của loại phiếu là các mục trường chứng từ (theo app Jmix cũ,
 * cấu hình ở {@code voucher-forms}) — trang này tự vẽ, tự nạp và tự gửi chúng
 * trong {@code details}, nên trang của từng loại phiếu không phải biết tới.
 *
 * @param toForm      bản ghi → giá trị form (màn sửa)
 * @param toPayload   giá trị form → payload gửi lên (bỏ các trường chỉ để hiển thị)
 */
/** Ô có giá trị chưa: tham chiếu `{id}` cần id, chuỗi không rỗng, số / ngày có mặt. */
function filledValue(v: unknown): boolean {
  if (v == null || v === "") return false;
  if (typeof v === "object" && !Array.isArray(v)) return (v as { id?: unknown }).id != null && (v as { id?: unknown }).id !== "";
  return true;
}

/** Loại lỗi gắn cho ô bắt buộc lúc trình khi người dùng bấm mục đó ở "Cần hoàn thiện" — tự gỡ khi ô đã điền. */
const MISSING = "submit-required";

type FieldsRender = (props: { control: Control<any>; watch: UseFormWatch<any>; record?: any; setValue: any }) => ReactNode;

/**
 * Phần riêng của loại phiếu (ô đầu phiếu, bảng dòng) — tách thành component ghi nhớ.
 *
 * `VoucherFormPage` theo dõi CẢ form (`form.watch()`, cần cho "Cần hoàn thiện"), nên vẽ lại theo mỗi phím gõ.
 * Không có lớp này thì mỗi phím vẽ lại luôn cả bảng dòng vài trăm tài sản. Các ô bên trong tự cập nhật qua
 * `Controller` / `useWatch` của chính chúng; `render` của trang loại phiếu ổn định qua các lần vẽ của form
 * (trang cha không vẽ lại khi gõ). Đừng đọc `watch(...)` trong lúc vẽ ở phần này — nó sẽ không vẽ lại.
 */
const VoucherFields = memo(function VoucherFields({ render, control, watch, record, setValue }: {
  render: FieldsRender;
  control: Control<any>;
  watch: UseFormWatch<any>;
  record?: any;
  setValue: any;
}) {
  return <>{render({ control, watch, record, setValue })}</>;
});

export function VoucherFormPage({
  mode,
  defaults,
  toForm,
  toPayload,
  children,
  required = [],
  lineIssue,
  notice,
}: {
  /**
   * Lời nhắc KHÔNG CHẶN dưới "Cần hoàn thiện" (đề xuất mua sắm: thiết bị đã có trong đề xuất khác) — khác
   * `required`, nó không làm tắt nút Trình. Là một component nên tự đọc dữ liệu nó cần.
   */
  notice?: (props: { control: Control<any>; record?: any }) => ReactNode;
  mode: "create" | "edit";
  /**
   * Ô BẮT BUỘC của phần chính (Lý do đề xuất…) — vào danh sách "Cần hoàn thiện" như
   * dòng và thông tin bổ sung, để nút Trình không sáng khi máy chủ sẽ từ chối. `when` làm bắt buộc
   * CÓ ĐIỀU KIỆN: vắng mặt là luôn bắt buộc. `valid` trả lỗi của giá trị đã điền (vd. năm ngân sách 110) — mục chỉ
   * "đã đủ" khi có giá trị VÀ hợp lệ, không chỉ khi có chữ.
   */
  required?: {
    name: string;
    label: string;
    when?: (values: Record<string, unknown>) => boolean;
    valid?: (value: unknown, values: Record<string, unknown>) => string | null;
  }[];
  /** Lỗi của từng dòng (số lượng, trùng dòng khác…); hiện trong “Cần hoàn thiện” và chặn gửi phiếu. `lines`: mọi dòng. */
  lineIssue?: (line: any, index: number, lines: any[]) => string | null;
  defaults: Record<string, any>;
  toForm?: (record: any) => Record<string, any>;
  toPayload: (values: any) => Record<string, any>;
  children: (props: { control: Control<any>; watch: UseFormWatch<any>; record?: any; setValue: any }) => ReactNode;
}) {
  const navigate = useNavigate();
  // Mở form từ chỗ khác: tham số trên đường dẫn điền sẵn ô cùng tên. Chỉ nhận khoá phiếu đã khai trong `defaults`.
  const [params] = useSearchParams();
  const presets: Record<string, any> = {};
  if (mode === "create") {
    params.forEach((value, key) => {
      if (key in defaults && typeof defaults[key] !== "object") presets[key] = value;
    });
  }
  // Lưu rồi trình / ghi nhận ngay: chỉ báo một câu nói điều đã xảy ra ("Đã trình phiếu"), không kèm câu lưu.
  const silentSave = useRef(false);
  const {
    refineCore: { onFinish, query },
    ...form
  } = useForm({
    refineCoreProps: {
      redirect: "show",
      successNotification: () => (silentSave.current ? false : { type: "success", message: "Đã lưu phiếu" }),
    },
    defaultValues: { ...defaults, ...presets, details: {} } as Record<string, any>,
  });
  const record = query?.data?.data as (VoucherBase & Record<string, any>) | undefined;
  const { resource } = useResourceParams();
  const config = useVoucherForm(resource?.name);
  const schoolId = useWatch({ control: form.control, name: "school.id" }) ?? record?.school?.id;
  const [lines, details] = useWatch({ control: form.control, name: ["lines", "details"] });
  const requiredValues = useWatch({ control: form.control, name: required.map((r) => r.name) }) as unknown[];
  // watch() nguyên form: `when` của ô bắt buộc có điều kiện đọc ô KHÁC (`handling` chẳng hạn) —
  // thứ không nằm trong `required` nên requiredValues không chứa.
  const formValues = form.watch();
  const translate = useTranslate();
  const { show, showUrl } = useNavigation();
  const invalidate = useInvalidate();
  const { open: notify } = useNotification();
  const { data: me } = useGetIdentity<{ fullName?: string; username?: string }>();
  const [linesSlot, setLinesSlot] = useState<HTMLElement | null>(null);
  const [busy, setBusy] = useState<"save" | "submit" | null>(null);
  const canApprove = useCan({ resource: resource?.name, action: "approve" }).data?.can ?? false;
  const { perspective } = usePerspective();
  const pending = usePendingAttachments(resource?.name ?? "");
  const go = useGo();
  const { to: listUrl } = useListButton({});
  const confirmDiscard = useConfirmDiscard();
  // "Quay lại" là về danh sách — có hỏi lại nếu đang gõ dở.
  const dismiss = () => confirmDiscard(() => go({ to: listUrl, type: "replace" }));
  useEffect(() => {
    if (mode === "edit" && record && toForm) form.reset({ ...toForm(record), details: record.details ?? {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, record?.id, record?.updatedAt]);
  // Ô bắt buộc lúc trình được đánh dấu lỗi khi bấm mục đó ở "Cần hoàn thiện" (viền đỏ + câu nhắc); điền xong thì tự gỡ.
  useEffect(() => {
    required.forEach(({ name }, i) => {
      if (filledValue(requiredValues?.[i]) && form.getFieldState(name).error?.type === MISSING) form.clearErrors(name);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(requiredValues)]);

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
            <p>
              Chỉ sửa được phiếu nháp. Phiếu đang chờ duyệt thì phải được trả lại mới sửa được.
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => navigate(-1)}>
              Quay lại phiếu
            </Button>
          </AlertDescription>
        </Alert>
      </View>
    );
  }

  const name = resource?.name ?? "";
  if (mode === "edit" && record?._actions && !record._actions.includes("edit")) {
    return <Navigate to={showUrl(name, record.id)} replace />;
  }
  const title = translate(`${name}.${name}`, (resource?.meta?.label as string | undefined) ?? "Phiếu");
  const creator = record?.createdBy?.name ?? (record ? undefined : (me?.fullName ?? me?.username));
  const hasLines = Array.isArray(defaults.lines);
  const lineCount = Array.isArray(lines) ? lines.length : 0;
  const head = headFillCount(config, details);
  // Bấm một mục "cần hoàn thiện" là tới ĐÚNG ô đó và mở nó ra — chỉ cuộn tới khối chứa ô thì trên form
  // ngắn (mọi thứ đã nằm trong màn hình) trông như bấm không có tác dụng gì.
  const goTo = (containerId: string, label?: string) => () => {
    const root = document.getElementById(containerId);
    if (!root) return;
    const wanted = label?.trim().toLowerCase();
    const labelEl = wanted
      ? [...root.querySelectorAll("label")].find((l) => (l.textContent ?? "").replace("*", "").trim().toLowerCase().startsWith(wanted))
      : undefined;
    // Ô của nhãn: theo `for`, không có thì ô đầu tiên trong cùng khối với nhãn (ô chọn bằng hộp thoại là
    // một nút không mang id). Dấu "?" giải thích nằm ngoài thứ tự Tab nên bị loại ở đây.
    const focusable = 'input, textarea, select, button:not([tabindex="-1"])';
    const target =
      (labelEl?.htmlFor ? document.getElementById(labelEl.htmlFor) : null) ??
      labelEl?.parentElement?.querySelector<HTMLElement>(focusable) ??
      root.querySelector<HTMLElement>(focusable);
    (target ?? root).scrollIntoView({ behavior: "smooth", block: "center" });
    if (!target) return;
    target.focus({ preventScroll: true });
    // Ô chọn (danh sách xổ, hộp chọn cán bộ / phòng / tài sản) là một nút: mở luôn, khỏi bấm lần nữa.
    if (target instanceof HTMLButtonElement) target.click();
  };
  const goToQuantity = (index: number) => () => {
    const cell = document.querySelector<HTMLElement>(`#voucher-lines [data-quantity-line="${index}"]`);
    const input = cell?.querySelector<HTMLElement>("input");
    (input ?? cell)?.scrollIntoView({ behavior: "smooth", block: "center" });
    input?.focus({ preventScroll: true });
  };
  const items: ChecklistItem[] = [
    // Tài khoản phải CHỌN trường (quản trị, Sở) — ô Trường là ô đầu tiên của phiếu.
    ...(!record && perspective !== "school"
      ? [{ key: "school", label: "Trường", ok: filledValue(schoolId), onClick: goTo("voucher-head", "Trường") }]
      : []),
    // Ô có `when` không đúng điều kiện thì KHÔNG hiện — không phải mục "đã đủ".
    ...required.flatMap(({ name, label, when, valid }, i) => {
      if (when && !when(formValues)) return [];
      const filled = filledValue(requiredValues?.[i]);
      const invalid = filled && valid ? valid(requiredValues?.[i], formValues) : null;
      return [{
        key: `f:${name}`,
        label: invalid ? `${label}: ${invalid}` : label,
        ok: filled && !invalid,
        onClick: () => {
          // Đánh dấu ô là lỗi (viền đỏ, câu nhắc dưới ô) rồi mới tới ô đó — chỉ nhảy tới thì ô trông như bình thường.
          form.setError(name, { type: MISSING, message: invalid ?? `Vui lòng ${/^(Ngày|Trường)/.test(label) ? "chọn" : "nhập"} ${lowerLabel(label)}` });
          goTo("voucher-head", label)();
        },
      }];
    }),
    ...(hasLines ? [{ key: "lines", label: "Dòng trên phiếu", ok: lineCount > 0, onClick: goTo("voucher-lines") }] : []),
    ...(lineIssue && Array.isArray(formValues.lines) ? formValues.lines : []).flatMap((line: any, index: number) => {
      const issue = lineIssue?.(line, index, formValues.lines);
      return issue ? [{ key: `quantity:${index}`, label: `Dòng ${index + 1}: ${issue}`, ok: false, onClick: goToQuantity(index) }] : [];
    }),
    // Trường bắt buộc của DÒNG: máy chủ từ chối lúc trình ("Dòng 1 còn thiếu: …"), nên phải đếm ở đây.
    ...(Array.isArray(formValues.lines) ? formValues.lines : []).flatMap((l: any, i: number) =>
      (config?.line ?? [])
        .filter((f) => f.required && !filledValue(l?.details?.[f.key]))
        .map((f) => ({ key: `l:${i}:${f.key}`, label: `Dòng ${i + 1}: ${f.label}`, ok: false, onClick: goTo("voucher-lines") })),
    ),
    ...head.missing.map((label) => ({ key: `d:${label}`, label, ok: false, onClick: goTo("voucher-details", label) })),
  ];
  const missing = items.filter((i) => !i.ok);
  // Ô bắt buộc lúc TRÌNH (đang đúng điều kiện `when`): nhãn của ô tự gắn dấu *, như ô bắt buộc khi lưu.
  const submitRequired = new Set(required.filter(({ when }) => !when || when(formValues)).map(({ name }) => name));
  // Người DUYỆT của trường (lãnh đạo trường) không có nút Trình: trình là việc của người lập gửi lên
  // cho họ. Phiếu đã lưu thì theo đúng danh sách hành động máy chủ trả về.
  const maySubmit = record ? (record._actions ?? []).includes("submit") : !(canApprove && perspective === "school");
  // Phiếu KHÔNG qua cấp duyệt nào: bấm là hệ thống ghi nhận và khoá phiếu ngay, không ai chờ duyệt — nên
  // hai nút là "Lưu" và "Duyệt" chứ không phải "Lưu nháp" và "Trình". Loại phiếu không có cấp duyệt
  // (`approvalSteps` rỗng — cấu hình ở "Luồng phê duyệt").
  const direct = config?.approvalSteps?.length === 0;
  const saveLabel = direct ? "Lưu" : "Lưu nháp";
  // Người lập bấm nút này: "Duyệt" đọc như tự duyệt phiếu của mình, nên mặc định là "Ghi nhận".
  const submitLabel = direct ? "Ghi nhận" : "Trình";
  // Phiếu có dòng mà chưa có dòng nào thì không lưu: một phiếu nháp trống không dùng được vào việc gì (E2E-03).
  const noLines = hasLines && lineCount === 0;
  const saveTitle = noLines ? "Thêm ít nhất một dòng trước khi lưu" : undefined;

  // Tệp chọn lúc lập phiếu được đẩy lên ngay sau khi phiếu có id.
  const send = async (values: any) => {
    const res: any = await onFinish({ ...toPayload(values), details: values.details ?? {} });
    await pending.uploadTo(res?.data?.id);
    return res;
  };
  const saveDraft = form.handleSubmit(async (values) => {
    if (noLines) return;
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
    silentSave.current = true;
    try {
      const res: any = await Promise.resolve(send(values)).catch(() => null);
      id = res?.data?.id ?? record?.id;
      if (!res || !id) return;
      const after = await kyInstance.post(`${name}/${id}/submit`, { json: { note: null } }).json<{ status?: string }>();
      // Nói theo điều ĐÃ xảy ra: phiếu còn chờ duyệt thì là "đã trình", kể cả khi nút ghi "Duyệt" (ngưỡng
      // tiền do Sở đặt có thể đưa một phiếu tưởng miễn duyệt vào luồng duyệt).
      const waiting = after?.status === "PENDING";
      notify?.({ type: "success", message: waiting || !direct ? "Đã trình phiếu" : "Đã ghi nhận phiếu" });
    } catch (error) {
      notify?.({ type: "error", message: await errorMessage(error), description: direct ? "Đã lưu nhưng chưa duyệt được" : "Đã lưu nháp nhưng chưa trình được" });
    } finally {
      silentSave.current = false;
      setBusy(null);
      if (id) {
        invalidate({ resource: name, invalidates: ["list", "detail"], id });
        show(name, id, "replace");
      }
    }
  });

  const main = (
    <>
      <InventoryFreezeNotice resource={name} />
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

      {config?.sections.some((s) => !s.inline) ? (
        <Card id="voucher-details" className="@container gap-0 px-4 py-4 empty:hidden">
          <Controller
            control={form.control}
            name="details"
            // Cùng luật máy chủ kiểm ở `VoucherForms` — lỗi hiện ngay dưới từng ô, đây chỉ chặn lưu.
            rules={{ validate: (v) => detailsError(config, v) ?? true }}
            render={({ field }) => (
              <VoucherDetailsFields config={config} value={field.value} onChange={field.onChange}
                // Có ô bắt buộc thì đây không còn là phần "bổ sung".
                title={config.sections.some((s) => s.fields.some((f) => f.required)) ? "Nội dung phiếu" : undefined}
                schoolId={schoolId} />
            )}
          />
        </Card>
      ) : null}

      <div id="voucher-files">
        {record?.id ? (
          <AttachmentsPanel resource={name} recordId={record.id} canWrite compact />
        ) : (
          <PendingAttachments files={pending.files} onChange={pending.setFiles} />
        )}
      </div>
    </>
  );

  const side = (
    <Card className="gap-0 py-0">
      <SideSection title={title}>
        <SideFact label="Số phiếu">
          {record?.code ? <span className="font-mono">{record.code}</span> : <span className="text-muted-foreground font-normal">{direct ? "Cấp khi ghi nhận" : "Cấp khi trình"}</span>}
        </SideFact>
        {creator ? <SideFact label="Người lập">{creator}</SideFact> : null}
        {hasLines ? <SideFact label="Số dòng"><span className="tabular-nums">{lineCount}</span></SideFact> : null}
      </SideSection>

      <SideSection title={missing.length ? `Cần hoàn thiện (${missing.length})` : direct ? "Kiểm tra trước khi ghi nhận" : "Kiểm tra trước khi trình"}>
        <CompletionList items={items} showDone />
        {notice?.({ control: form.control, record })}
      </SideSection>

      <SideSection className="space-y-2">
        <div className={maySubmit ? "grid grid-cols-2 gap-2" : "grid gap-2"}>
          <Button type="button" variant={maySubmit ? "outline" : "default"} disabled={busy != null || noLines} title={saveTitle} onClick={() => void saveDraft()}>
            {busy === "save" ? <Loader2 className="animate-spin" /> : <Save />}
            {saveLabel}
          </Button>
          {maySubmit ? (
            <Button type="button" disabled={busy != null || missing.length > 0}
              title={missing.length ? "Hoàn thiện các mục ở trên trước" : direct ? "Lưu và ghi nhận — phiếu này không cần trình lên cấp trên" : "Lưu và trình phiếu"}
              onClick={() => void saveAndSubmit()}>
              {busy === "submit" ? <Loader2 className="animate-spin" /> : <Send />}
              {submitLabel}
            </Button>
          ) : null}
        </div>
        {/* Nút đủ cỡ có viền như hai nút trên — chữ nhỏ không viền trước đây nhìn như nhãn, không thấy là nút. Về danh
            sách phiếu (không "lùi một trang": mở form từ liên kết dán vào thì lùi là ra chỗ khác), có hỏi lại nếu đang gõ dở. */}
        {/* Gọi "Quay lại", không gọi "Huỷ": phiếu đã trình rồi bị trả về mà mở màn sửa, chữ "Huỷ" bị hiểu là huỷ phiếu
            (thực ra chỉ ra khỏi màn sửa). Huỷ phiếu thật nằm ở menu ⚙ màn xem phiếu. */}
        <Button type="button" variant="outline" className="w-full" disabled={busy != null} onClick={dismiss}>
          <ArrowLeft />
          Quay lại
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
