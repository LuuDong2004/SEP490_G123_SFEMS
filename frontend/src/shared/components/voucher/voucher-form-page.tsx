import { useCan, useGetIdentity, useGo, useInvalidate, useListButton, useNavigation, useNotification, useResourceParams, useTranslate } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";
import { CircleAlert, Loader2, Lock, Save, Send, X } from "lucide-react";
import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import { Controller, useWatch, type Control, type UseFormWatch } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router";

import { CreateView, CreateViewHeader } from "@/shared/components/views/create-view";
import { EditView, EditViewHeader } from "@/shared/components/views/edit-view";
import { useQuery } from "@tanstack/react-query";
import { kyInstance } from "@/shared/api/data";
import { useConfirmDiscard } from "@/shared/components/form/unsaved-changes-guard";
import { useScreenName } from "@/shared/hooks/use-screen-name";
import { errorMessage } from "@/shared/lib/api-error";
import { AttachmentsPanel } from "@/shared/components/voucher/attachments-panel";
import { PendingAttachments, usePendingAttachments } from "@/shared/components/voucher/pending-attachments";
import { CompletionList, SideFact, SideSection, StepTitle, VoucherLinesSlot, VoucherTwoColumn, type ChecklistItem } from "@/shared/components/voucher/voucher-layout";
import { Card } from "@/shared/ui/card";
import { cn } from "@/shared/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
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
 * <p>`dialog`: phiếu ÍT Ô (phiếu mượn) mở thành HỘP THOẠI trên danh sách thay vì một trang riêng — cùng
 * form, cùng luật; các thẻ xếp một cột, "còn thiếu gì" và các nút xuống thanh chân. Route lập / sửa của
 * phiếu đó phải lồng dưới route danh sách (`VoucherList` vẽ `<Outlet />`), và đóng hộp là về danh sách.
 *
 * @param toForm      bản ghi → giá trị form (màn sửa)
 * @param toPayload   giá trị form → payload gửi lên (bỏ các trường chỉ để hiển thị)
 * @param variantField trường của phiếu quyết định mục nào hiện (vd. "kind" của phiếu ghi giảm)
 */
/** Ô có giá trị chưa: tham chiếu `{id}` cần id, chuỗi không rỗng, số / ngày có mặt. */
function filledValue(v: unknown): boolean {
  if (v == null || v === "") return false;
  if (typeof v === "object" && !Array.isArray(v)) return (v as { id?: unknown }).id != null && (v as { id?: unknown }).id !== "";
  return true;
}

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
  variantField,
  required = [],
  lineIssue,
  linesOptional,
  submit,
  directSubmit,
  directText,
  dialog,
  dialogClassName,
  attachments = true,
  requiredAttachment,
  notice,
}: {
  /**
   * Tệp BẮT BUỘC lúc trình (điều chuyển: tệp quyết định) — tên khung tệp, có dấu *, và một mục "Cần hoàn thiện" tới
   * khi có ít nhất một tệp. Máy chủ cũng kiểm lúc trình.
   */
  requiredAttachment?: string;
  /**
   * Lời nhắc KHÔNG CHẶN dưới "Cần hoàn thiện" (đề xuất mua sắm: thiết bị đã có trong đề xuất khác) — khác
   * `required`, nó không làm tắt nút Trình. Là một component nên tự đọc dữ liệu nó cần.
   */
  notice?: (props: { control: Control<any>; record?: any }) => ReactNode;
  /** `false`: form không có khung tệp đính kèm (phiếu chỉ để ghi nhận, vd. mượn phòng) — màn chi tiết vẫn có. */
  attachments?: boolean;
  mode: "create" | "edit";
  /** Mở thành hộp thoại trên danh sách (phiếu ít ô) thay vì một trang riêng. */
  dialog?: boolean;
  /** Bề rộng riêng của hộp thoại (vd. phiếu tiêu hao vài ô thì hẹp lại, lưới tự về hai cột, không chừa lỗ). */
  dialogClassName?: string;
  variantField?: string;
  /**
   * Ô BẮT BUỘC của phần chính (Phòng nhận, Vật tư, Hạn trả…) — vào danh sách "Cần hoàn thiện" như
   * dòng và thông tin bổ sung, để nút Trình không sáng khi máy chủ sẽ từ chối. `when` làm bắt buộc
   * CÓ ĐIỀU KIỆN (chi phí của phiếu báo hỏng chỉ bắt buộc khi "Thuê sửa"): vắng mặt là luôn bắt buộc.
   */
  required?: { name: string; label: string; when?: (values: Record<string, unknown>) => boolean }[];
  /** Lỗi số lượng của từng dòng; hiện trong “Cần hoàn thiện” và chặn gửi phiếu. */
  lineIssue?: (line: any, index: number) => string | null;
  /** Bảng dòng là tuỳ chọn (đặt phòng: thiết bị dùng kèm) — phiếu không dòng vẫn trình được. */
  linesOptional?: boolean;
  /** Tên của việc "trình" ở loại phiếu không qua duyệt (phiếu mượn: "Ghi nhận mượn") — cùng chữ với màn chi tiết. */
  submit?: { label: string; done: string };
  /**
   * Luật miễn duyệt theo NỘI DUNG phiếu (báo hỏng không thuê sửa, sửa chữa tại chỗ…) — cùng luật với
   * `approvalExempt()` của phiếu ở máy chủ. Trả `true` thì phiếu bấm là xong dù loại phiếu có cấp duyệt.
   */
  directSubmit?: (values: Record<string, any>, record?: any) => boolean;
  /**
   * Tên của nút khi phiếu miễn duyệt THEO NỘI DUNG (`directSubmit`) mà "Duyệt" là chữ sai người: sửa chữa tại chỗ
   * do cán bộ thiết bị bấm, nên là "Ghi nhận" — cán bộ không duyệt phiếu sửa.
   */
  directText?: { label: string; done: string };
  defaults: Record<string, any>;
  toForm?: (record: any) => Record<string, any>;
  toPayload: (values: any) => Record<string, any>;
  children: (props: { control: Control<any>; watch: UseFormWatch<any>; record?: any; setValue: any }) => ReactNode;
}) {
  const navigate = useNavigate();
  // Lập phiếu từ chỗ khác (hồ sơ tài sản → "Đổi" vị trí; chuột phải ở bảng Theo tài sản): `?kind=RELOCATE&equipment.id=12`
  // điền sẵn loại phiếu và dòng tài sản; nhiều tài sản là `equipment.id=12,13,14` (hoặc lặp khoá). Phiếu một tài sản
  // (ghi tiêu hao — ô `equipment`) lấy cái đầu. Chỉ nhận khoá phiếu đã khai trong `defaults`.
  const [params] = useSearchParams();
  const presets: Record<string, any> = {};
  if (mode === "create") {
    const ids = params.getAll("equipment.id").flatMap((v) => v.split(",")).map(Number).filter((id) => id > 0);
    if (ids.length && Array.isArray(defaults.lines)) {
      presets.lines = ids.map((id) => ({ equipment: { id }, note: "", details: {} }));
    } else if (ids.length && defaults.equipment && typeof defaults.equipment === "object") {
      presets.equipment = { id: ids[0] };
    }
    params.forEach((value, key) => {
      if (key !== "equipment.id" && key in defaults && typeof defaults[key] !== "object") presets[key] = value;
      // Ô chọn một bản ghi (`plan: { id }`): `?plan.id=5` — vd. "Tạo phiếu bảo dưỡng" từ kế hoạch bảo trì.
      const ref = key.endsWith(".id") ? key.slice(0, -3) : null;
      if (ref && ref !== "equipment" && defaults[ref] && typeof defaults[ref] === "object" && Number(value) > 0) {
        presets[ref] = { id: Number(value) };
      }
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
  const variant = useWatch({ control: form.control, name: variantField ?? "__none" });
  const [lines, details] = useWatch({ control: form.control, name: ["lines", "details"] });
  const requiredValues = useWatch({ control: form.control, name: required.map((r) => r.name) }) as unknown[];
  // watch() nguyên form: `when` của ô bắt buộc có điều kiện đọc ô KHÁC (`handling` chẳng hạn) —
  // thứ không nằm trong `required` nên requiredValues không chứa.
  const formValues = form.watch();
  const translate = useTranslate();
  const { show } = useNavigation();
  const invalidate = useInvalidate();
  const { open: notify } = useNotification();
  const { data: me } = useGetIdentity<{ fullName?: string; username?: string }>();
  const [linesSlot, setLinesSlot] = useState<HTMLElement | null>(null);
  const [busy, setBusy] = useState<"save" | "submit" | null>(null);
  const canApprove = useCan({ resource: resource?.name, action: "approve" }).data?.can ?? false;
  const { perspective } = usePerspective();
  const pending = usePendingAttachments(resource?.name ?? "");
  // Tệp bắt buộc: lúc lập là tệp đang chờ lưu; lúc sửa là tệp đã lưu — cùng khoá với khung tệp nên thêm / xoá
  // tệp ở khung là mục "Cần hoàn thiện" cập nhật ngay.
  const { data: savedFiles } = useQuery({
    queryKey: ["attachments", resource?.name ?? "", record?.id],
    enabled: !!requiredAttachment && record?.id != null,
    queryFn: ({ signal }) => kyInstance.get("attachments", { signal,  searchParams: { resource: resource?.name ?? "", recordId: String(record?.id) } }).json<unknown[]>(),
  });
  const fileCount = record?.id != null ? (Array.isArray(savedFiles) ? savedFiles.length : 0) : pending.files.length;
  const go = useGo();
  const { to: listUrl } = useListButton({});
  const confirmDiscard = useConfirmDiscard();
  const screen = useScreenName();
  // Đóng hộp thoại (nút X, Esc, bấm ra ngoài, "Huỷ") là về danh sách — có hỏi lại nếu đang gõ dở.
  const dismiss = () => confirmDiscard(() => go({ to: listUrl, type: "replace" }));
  /** Khung của trạng thái "đang tải" / "không sửa được" khi form là hộp thoại. */
  const inDialog = (body: ReactNode) => (
    <Dialog open onOpenChange={(o) => { if (!o) dismiss(); }}>
      <DialogContent size="auto" className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{screen.title || "Phiếu"}</DialogTitle>
          <DialogDescription className="sr-only">Lập hoặc sửa phiếu</DialogDescription>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );

  useEffect(() => {
    if (mode === "edit" && record && toForm) form.reset({ ...toForm(record), details: record.details ?? {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, record?.id, record?.updatedAt]);

  const Header = mode === "create" ? CreateViewHeader : EditViewHeader;
  const View = mode === "create" ? CreateView : EditView;

  if (mode === "edit" && query?.isLoading) {
    if (dialog) return inDialog(<Skeleton className="h-64 w-full" />);
    return (
      <View>
        <Header />
        <Skeleton className="h-96 w-full" />
      </View>
    );
  }
  if (mode === "edit" && record && record.status !== "DRAFT") {
    if (dialog) return inDialog(<p className="text-muted-foreground text-sm">Chỉ sửa được phiếu nháp. Phiếu đang chờ duyệt thì phải được trả lại mới sửa được.</p>);
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
  const title = translate(`${name}.${name}`, (resource?.meta?.label as string | undefined) ?? "Phiếu");
  const creator = record?.createdBy?.name ?? (record ? undefined : (me?.fullName ?? me?.username));
  const hasLines = Array.isArray(defaults.lines);
  const lineCount = Array.isArray(lines) ? lines.length : 0;
  const head = headFillCount(config, details, undefined, variantField ? String(variant ?? "") : null);
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
    // Tài khoản phải CHỌN trường (quản trị, Sở, UBND) — ô Trường là ô đầu tiên của phiếu.
    ...(!record && perspective !== "school"
      ? [{ key: "school", label: "Trường", ok: filledValue(schoolId), onClick: goTo("voucher-head", "Trường") }]
      : []),
    // Ô có `when` không đúng điều kiện thì KHÔNG hiện — mục của loại phiếu khác (thanh lý không có "Ngày phát hiện
    // mất"), không phải mục "đã đủ".
    ...required.flatMap(({ name, label, when }, i) => (when && !when(formValues) ? [] : [{
      key: `f:${name}`,
      label,
      ok: filledValue(requiredValues?.[i]),
      onClick: goTo("voucher-head", label),
    }])),
    ...(hasLines && !linesOptional ? [{ key: "lines", label: "Dòng trên phiếu", ok: lineCount > 0, onClick: goTo("voucher-lines") }] : []),
    ...(lineIssue && Array.isArray(formValues.lines) ? formValues.lines : []).flatMap((line: any, index: number) => {
      const issue = lineIssue?.(line, index);
      return issue ? [{ key: `quantity:${index}`, label: `Dòng ${index + 1}: ${issue}`, ok: false, onClick: goToQuantity(index) }] : [];
    }),
    // Trường bắt buộc của DÒNG: máy chủ từ chối lúc trình ("Dòng 1 còn thiếu: …"), nên phải đếm ở đây.
    ...(Array.isArray(formValues.lines) ? formValues.lines : []).flatMap((l: any, i: number) =>
      (config?.line ?? [])
        .filter((f) => f.required && !f.stage && !filledValue(l?.details?.[f.key]))
        .map((f) => ({ key: `l:${i}:${f.key}`, label: `Dòng ${i + 1}: ${f.label}`, ok: false, onClick: goTo("voucher-lines") })),
    ),
    ...head.missing.map((label) => ({ key: `d:${label}`, label, ok: false, onClick: goTo("voucher-details", label) })),
    ...(requiredAttachment
      ? [{ key: "attachment", label: requiredAttachment, ok: fileCount > 0, onClick: goTo("voucher-files") }]
      : []),
  ];
  const missing = items.filter((i) => !i.ok);
  // Ô bắt buộc lúc TRÌNH (đang đúng điều kiện `when`): nhãn của ô tự gắn dấu *, như ô bắt buộc khi lưu.
  const submitRequired = new Set(required.filter(({ when }) => !when || when(formValues)).map(({ name }) => name));
  // Người DUYỆT của trường (lãnh đạo trường) không có nút Trình: trình là việc của người lập gửi lên
  // cho họ. Phiếu đã lưu thì theo đúng danh sách hành động máy chủ trả về.
  const maySubmit = record ? (record._actions ?? []).includes("submit") : !(canApprove && perspective === "school");
  // Phiếu KHÔNG qua cấp duyệt nào: bấm là hệ thống ghi nhận và khoá phiếu ngay, không ai chờ duyệt — nên
  // hai nút là "Lưu" và "Duyệt" chứ không phải "Lưu nháp" và "Trình". Loại phiếu không có cấp duyệt
  // (`approvalSteps` rỗng — Sở cấu hình ở "Luồng phê duyệt") hoặc nội dung phiếu được miễn (`directSubmit`).
  // Loại phiếu có tên riêng cho việc này (`submit`, vd. "Ghi nhận mượn") thì giữ tên đó.
  const direct = !submit && (config?.approvalSteps?.length === 0 || !!directSubmit?.(formValues, record));
  const saveLabel = direct ? "Lưu" : "Lưu nháp";
  // Người lập bấm nút này: "Duyệt" đọc như tự duyệt phiếu của mình, nên mặc định là "Ghi nhận".
  const submitLabel = submit?.label ?? (direct ? directText?.label ?? "Ghi nhận" : "Trình");
  // Phiếu có dòng mà chưa có dòng nào thì không lưu: một phiếu nháp trống không dùng được vào việc gì (E2E-03).
  const noLines = hasLines && !linesOptional && lineCount === 0;
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
      notify?.({ type: "success", message: submit?.done ?? (waiting || !direct ? "Đã trình phiếu" : directText?.done ?? "Đã ghi nhận phiếu") });
    } catch (error) {
      notify?.({ type: "error", message: await errorMessage(error), description: submit ? "Đã lưu nháp" : direct ? "Đã lưu nhưng chưa duyệt được" : "Đã lưu nháp nhưng chưa trình được" });
    } finally {
      silentSave.current = false;
      setBusy(null);
      if (id) {
        invalidate({ resource: name, invalidates: ["list", "detail"], id });
        show(name, id, "replace");
      }
    }
  });

  // Trong hộp thoại các phần không mang khung thẻ riêng: hộp thoại đã là khung, thẻ lồng thẻ chỉ thêm viền và
  // khoảng trống. Các phần ngăn nhau bằng một đường kẻ mảnh ở mép trên (phần đầu không có); riêng bảng
  // tài sản giữ một khung bo góc — đó là vùng dữ liệu, cần thấy rõ nó bắt đầu và hết ở đâu.
  const flat = dialog ? "rounded-none border-x-0 border-b-0 bg-transparent px-0 py-5 shadow-none" : "";
  // Khung tệp có lề trong riêng (đầu và thân thẻ `px-4`): kéo ra hai bên cho thẳng mép các phần khác.
  const flatFiles = dialog
    ? "rounded-none border-x-0 border-b-0 bg-transparent py-5 shadow-none [&>[data-slot=card-content]]:px-0 [&>[data-slot=card-header]]:px-0"
    : undefined;

  const main = (
    <>
      <InventoryFreezeNotice resource={name} className={dialog ? "mt-4" : undefined} />
      <Card id="voucher-head" className={cn("@container gap-4 px-4 py-4", flat, dialog && "border-t-0")}>
        <StepTitle title="Thông tin phiếu" />
        <VoucherLinesSlot.Provider value={linesSlot}>
          <RequiredFieldsProvider names={submitRequired}>
            <VoucherFields render={children} control={form.control} watch={form.watch} record={record} setValue={form.setValue} />
          </RequiredFieldsProvider>
        </VoucherLinesSlot.Provider>
      </Card>

      {/* Bảng dòng: form của loại phiếu vẽ vào đây qua `VoucherLinesCard`. Loại phiếu không có bảng dòng thì thẻ tự ẩn. */}
      <Card id="voucher-lines" ref={setLinesSlot} className={cn("gap-0 overflow-hidden py-0 empty:hidden", dialog && "mb-5 shadow-none")} />

      {config?.sections.length ? (
        <Card id="voucher-details" className={cn("@container gap-0 px-4 py-4 empty:hidden", flat)}>
          <Controller
            control={form.control}
            name="details"
            // Cùng luật máy chủ kiểm ở `VoucherForms` — lỗi hiện ngay dưới từng ô, đây chỉ chặn lưu.
            rules={{ validate: (v) => detailsError(config, v) ?? true }}
            render={({ field }) => (
              <VoucherDetailsFields config={config} value={field.value} onChange={field.onChange}
                // Có ô bắt buộc (bảo dưỡng: loại, nội dung công việc) thì đây không còn là phần "bổ sung".
                title={config.sections.some((s) => !s.stage && s.fields.some((f) => f.required)) ? "Nội dung phiếu" : undefined}
                schoolId={schoolId} variant={variantField ? String(variant ?? "") : null} />
            )}
          />
        </Card>
      ) : null}

      {!attachments ? null : (
        <div id="voucher-files">
          {record?.id ? (
            <AttachmentsPanel resource={name} recordId={record.id} canWrite compact className={flatFiles}
              title={requiredAttachment} required={!!requiredAttachment} />
          ) : (
            <PendingAttachments files={pending.files} onChange={pending.setFiles} className={flatFiles}
              title={requiredAttachment} required={!!requiredAttachment} />
          )}
        </div>
      )}
    </>
  );

  const side = (
    <Card className="gap-0 py-0">
      <SideSection title={title}>
        <SideFact label="Số phiếu">
          {record?.code ? <span className="font-mono">{record.code}</span> : <span className="text-muted-foreground font-normal">{submit || (direct && directText) ? "Cấp khi ghi nhận" : "Cấp khi duyệt"}</span>}
        </SideFact>
        {creator ? <SideFact label="Người lập">{creator}</SideFact> : null}
        {hasLines ? <SideFact label="Số dòng"><span className="tabular-nums">{lineCount}</span></SideFact> : null}
      </SideSection>

      <SideSection title={missing.length ? `Cần hoàn thiện (${missing.length})` : submit ? "Kiểm tra" : direct ? "Kiểm tra trước khi ghi nhận" : "Kiểm tra trước khi trình"}>
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
              title={missing.length ? "Hoàn thiện các mục ở trên trước" : submit ? undefined : direct ? "Lưu và ghi nhận — phiếu này không cần trình lên cấp trên" : "Lưu và trình phiếu"}
              onClick={() => void saveAndSubmit()}>
              {busy === "submit" ? <Loader2 className="animate-spin" /> : <Send />}
              {submitLabel}
            </Button>
          ) : null}
        </div>
        {/* Nút đủ cỡ có viền như hai nút trên — chữ nhỏ không viền trước đây nhìn như nhãn, không thấy là nút. Về danh
            sách phiếu (không "lùi một trang": mở form từ liên kết dán vào thì lùi là ra chỗ khác), có hỏi lại nếu đang gõ dở. */}
        <Button type="button" variant="outline" className="w-full" disabled={busy != null} onClick={dismiss}>
          <X />
          Huỷ
        </Button>
      </SideSection>
    </Card>
  );

  if (dialog) {
    return (
      <Dialog open onOpenChange={(o) => { if (!o) dismiss(); }}>
        <DialogContent size="wide" className={cn("flex max-h-[92dvh] outline-none max-w-[min(80rem,calc(100vw-4rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(80rem,calc(100vw-4rem))]", dialogClassName)}>
          <DialogHeader className="border-b px-6 py-4 pr-12">
            <DialogTitle>{screen.title || title}</DialogTitle>
            <DialogDescription className="sr-only">Điền thông tin phiếu rồi lưu nháp hoặc ghi nhận.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={(e) => { e.preventDefault(); void saveDraft(); }}
              // Enter trong một ô không lưu phiếu: lưu là việc của nút.
              onKeyDown={(e) => { if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") e.preventDefault(); }}
              className="grid min-h-0 flex-1 auto-rows-max content-start overflow-y-auto px-6"
            >
              {main}
            </form>
          </Form>
          <DialogFooter className="items-center border-t px-6 py-4 sm:justify-between">
            {/* Còn thiếu gì: bấm là tới đúng ô đầu tiên còn trống. */}
            {missing.length ? (
              <button type="button" onClick={missing[0].onClick} className="text-warning-text hover:underline flex min-w-0 items-center gap-2 text-start text-sm font-medium"
                title={missing.map((m) => m.label).join("\n")}>
                <CircleAlert className="size-4 shrink-0" />
                <span className="truncate">{missing.length === 1 ? `Còn thiếu: ${missing[0].label}` : `Còn ${missing.length} mục cần hoàn thiện`}</span>
              </button>
            ) : <span />}
            <div className="flex shrink-0 items-center gap-3">
              <Button type="button" variant="ghost" disabled={busy != null} onClick={dismiss}>
                Huỷ
              </Button>
              <Button type="button" variant={maySubmit ? "outline" : "default"} disabled={busy != null || noLines} title={saveTitle} onClick={() => void saveDraft()}>
                {busy === "save" ? <Loader2 className="animate-spin" /> : <Save />}
                {saveLabel}
              </Button>
              {maySubmit ? (
                <Button type="button" disabled={busy != null || missing.length > 0} onClick={() => void saveAndSubmit()}>
                  {busy === "submit" ? <Loader2 className="animate-spin" /> : <Send />}
                  {submitLabel}
                </Button>
              ) : null}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

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

/** Dòng phiếu → payload: chỉ id tài sản và ghi chú (cộng các trường riêng nếu có). */
export function linesPayload(lines: any[] | undefined, extra?: (line: any) => Record<string, any>) {
  return (lines ?? []).map((l) => ({
    equipment: { id: l.equipment?.id },
    note: l.note || null,
    details: l.details ?? undefined,
    ...(extra ? extra(l) : {}),
  }));
}
