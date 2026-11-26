import { useInvalidate, useNavigation, useNotification } from "@refinedev/core";
import { useQueryClient } from "@tanstack/react-query";
import { Ban, CheckCircle2, CornerUpLeft, PackageCheck, Send, XCircle } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { kyInstance } from "@/shared/api/data";
import { DeleteButton } from "@/shared/components/buttons/delete";
import { EditButton } from "@/shared/components/buttons/edit";
import { AlertDialog } from "@/shared/ui/alert-dialog";
import { ConfirmContent } from "@/shared/components/confirm/confirm-content";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { maxLengthOf, textError } from "@/shared/lib/field-rules";
import { errorMessage } from "@/shared/lib/api-error";
import type { VoucherAction, VoucherBase } from "@/domains/voucher/types";

type WorkflowAction = "submit" | "approve" | "return" | "reject" | "cancel" | "complete";

type ActionText = {
  label: string;
  title: string;
  description: ReactNode;
  confirm: string;
  done: string;
  /** Lời nhắn: không hỏi, hỏi nhưng không bắt buộc, hay bắt buộc. */
  note?: "optional" | "required";
  noteLabel?: string;
  /** Có = chưa làm được việc này: nút mờ, lý do ghi ngay dưới nút (vd. "Còn 3191 thiết bị chưa kiểm"). */
  blocked?: string | null;
};

const DEFAULT_TEXT: Record<WorkflowAction, ActionText> = {
  submit: {
    label: "Trình duyệt",
    title: "Trình phiếu lên duyệt?",
    description: "Phiếu được chuyển tới người duyệt. Trong lúc chờ duyệt thì không sửa được.",
    confirm: "Trình duyệt",
    done: "Đã trình phiếu",
  },
  approve: {
    label: "Duyệt",
    title: "Duyệt phiếu?",
    description: "Phiếu sang bước duyệt tiếp theo, hoặc xong nếu đây là bước cuối.",
    confirm: "Duyệt",
    done: "Đã duyệt phiếu",
    note: "optional",
    noteLabel: "Ý kiến (không bắt buộc)",
  },
  return: {
    label: "Trả lại",
    title: "Trả phiếu về người lập?",
    description: "Người lập sẽ sửa rồi trình lại. Số phiếu giữ nguyên.",
    confirm: "Trả lại",
    done: "Đã trả phiếu về người lập",
    note: "required",
    noteLabel: "Cần sửa gì",
  },
  reject: {
    label: "Từ chối",
    title: "Từ chối phiếu?",
    description: "Phiếu dừng hẳn, không trình lại được. Thiết bị vẫn như trước khi lập phiếu.",
    confirm: "Từ chối",
    done: "Đã từ chối phiếu",
    note: "required",
    noteLabel: "Lý do từ chối",
  },
  cancel: {
    label: "Huỷ phiếu",
    title: "Huỷ phiếu này?",
    description: 'Phiếu không bị xoá, vẫn nằm trong danh sách với trạng thái "Đã huỷ".',
    confirm: "Huỷ phiếu",
    done: "Đã huỷ phiếu",
    note: "optional",
    noteLabel: "Lý do (không bắt buộc)",
  },
  complete: {
    label: "Hoàn tất",
    title: "Hoàn tất phiếu?",
    description: "Hệ thống sẽ cập nhật thiết bị theo phiếu. Sau đó phiếu không sửa được nữa.",
    confirm: "Hoàn tất",
    done: "Đã hoàn tất phiếu",
    note: "optional",
    noteLabel: "Ghi chú (không bắt buộc)",
  },
};

/**
 * Chữ của nút "trình" khi phiếu KHÔNG qua cấp duyệt nào (`submit_direct`): không ai chờ duyệt, bấm là hệ
 * thống ghi nhận và khoá phiếu — gọi là "Duyệt", cùng chữ với nút trên form lập phiếu.
 */
const DIRECT_SUBMIT_TEXT: ActionText = {
  label: "Duyệt",
  title: "Duyệt phiếu?",
  description: "Phiếu này không cần trình lên cấp trên. Duyệt xong hệ thống ghi nhận ngay và phiếu không sửa được nữa.",
  confirm: "Duyệt",
  done: "Đã duyệt, hệ thống đã ghi nhận phiếu",
};

const ICONS: Record<WorkflowAction, ReactNode> = {
  submit: <Send />,
  approve: <CheckCircle2 />,
  return: <CornerUpLeft />,
  reject: <XCircle />,
  cancel: <Ban />,
  complete: <PackageCheck />,
};

/** Việc của phiếu mà màn có menu ⚙ đưa vào menu thay vì để thành nút. */
export type TuckedAction = "cancel" | "delete" | "reject";

/**
 * Cụm nút của vòng duyệt, dùng chung cho mọi loại phiếu.
 *
 * <p>Nút nào hiện là do SERVER nói ({@code _actions}), không phải màn hình tự
 * suy ra từ trạng thái: chỉ server biết người đang xem có đúng là người thuộc cấp
 * đang chờ duyệt không. Tự suy ra ở đây thì một lãnh đạo trường khác sẽ thấy nút
 * "Duyệt" và bấm vào một lỗi 422.
 *
 * @param text      thay câu chữ cho loại phiếu cụ thể — vd. "Duyệt và ghi tăng"
 * @param invalidates tài nguyên khác cần làm mới sau khi phiếu đổi trạng thái
 *                  (thiết bị, tồn kho...)
 * @param layout    "side": cụm nút nằm trong thẻ tóm tắt bên phải (mục riêng có viền trên) — việc chính (Trình /
 *                  Duyệt / Hoàn tất, cộng `extra`) là nút đậm đủ bề rộng, việc phụ (Sửa, Trả lại, Huỷ phiếu) xếp hàng
 *                  hai bên dưới. Không có nút nào thì không vẽ mục. Mặc định "bar": hàng nút ở đầu trang.
 * @param extra     nút riêng của loại phiếu, đứng cùng nhóm việc chính (vd. "Hàng về, lập phiếu ghi tăng").
 * @param tucked    màn có menu ⚙ thì đưa hai việc ÍT DÙNG và nguy hiểm — Huỷ phiếu, Xoá — vào menu đó:
 *                  ở đây không vẽ nút của chúng, menu báo việc được chọn qua `request` và cụm này mở đúng
 *                  hộp hỏi lại như khi bấm nút. Hàng nút chỉ còn việc chính (Sửa, Trình / Duyệt…).
 */

export function VoucherActions({
  resource,
  record,
  text,
  invalidates = [],
  hide = [],
  tucked,
  layout = "bar",
  extra,
}: {
  resource: string;
  record: VoucherBase | undefined;
  text?: Partial<Record<WorkflowAction, Partial<ActionText>>>;
  invalidates?: string[];
  hide?: VoucherAction[];
  tucked?: { request: TuckedAction | null; clear: () => void };
  layout?: "bar" | "side";
  extra?: ReactNode;
}) {
  const { open } = useNotification();
  const invalidate = useInvalidate();
  const { list } = useNavigation();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<WorkflowAction | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const deleteButton = useRef<HTMLButtonElement>(null);
  const request = tucked?.request ?? null;
  const clearRequest = tucked?.clear;
  useEffect(() => {
    if (!request) return;
    if (request === "cancel" || request === "reject") {
      setNote("");
      setPending(request);
    } else {
      // Nút Xoá vẫn là `DeleteButton` (quyền, hộp hỏi lại, điều hướng sau khi xoá đều của nó) — chỉ ẩn đi.
      deleteButton.current?.click();
    }
    clearRequest?.();
  }, [request, clearRequest]);

  if (!record) return null;
  const allowed = new Set((record._actions ?? []).filter((a) => !hide.includes(a)));
  const direct = allowed.has("submit_direct");
  const texts = (action: WorkflowAction): ActionText => ({
    ...(action === "submit" && direct ? DIRECT_SUBMIT_TEXT : DEFAULT_TEXT[action]),
    ...text?.[action],
  });
  const current = pending ? texts(pending) : null;

  async function run(action: WorkflowAction) {
    if (!record) return;
    const t = texts(action);
    if (t.note === "required" && !note.trim()) {
      open?.({ type: "error", message: `Hãy ghi ${t.noteLabel?.toLowerCase() ?? "lời nhắn"}` });
      return;
    }
    // `VoucherController.NoteRequest`: NOTE, tối đa 500. Lý do bắt buộc (trả lại, từ chối…) thêm luật REASON của
    // `VoucherWorkflow.requireNote`: có chữ, tối thiểu 5 ký tự.
    const noteProblem = t.note === "required"
      ? textError("REASON", t.noteLabel ?? "Lý do", note, 500, 5)
      : textError("NOTE", t.noteLabel ?? "Ghi chú", note);
    if (noteProblem) {
      open?.({ type: "error", message: noteProblem });
      return;
    }
    setBusy(true);
    try {
      await kyInstance.post(`${resource}/${record.id}/${action}`, { json: { note: note.trim() || null } });
      open?.({ type: "success", message: t.done });
      setPending(null);
      setNote("");
      invalidate({ resource, invalidates: ["list", "detail"], id: record.id });
      for (const other of invalidates) invalidate({ resource: other, invalidates: ["list"] });
      queryClient.invalidateQueries({ queryKey: ["voucher_events", resource, record.id] });
    } catch (error) {
      open?.({ type: "error", message: await errorMessage(error), description: "Không thực hiện được" });
    } finally {
      setBusy(false);
    }
  }

  const side = layout === "side";
  const button = (action: WorkflowAction, variant: "default" | "outline" | "destructive" = "outline", className?: string) => {
    if (!allowed.has(action)) return null;
    const why = texts(action).blocked;
    const el = (
      <Button
        key={action}
        type="button"
        variant={variant}
        size={side && variant === "default" ? "lg" : undefined}
        className={cn(side && "w-full", className)}
        disabled={busy || !!why}
        title={why ?? undefined}
        onClick={() => {
          setNote("");
          setPending(action);
        }}
      >
        {ICONS[action]}
        {texts(action).label}
      </Button>
    );
    return why ? (
      <div key={action} className={cn("space-y-1", side && "w-full")}>
        {el}
        <p className="text-muted-foreground text-center text-xs">{why}</p>
      </div>
    ) : el;
  };

  // Huỷ phiếu thường nằm trong menu ⚙. Phiếu bị trả về thì đưa ra ngoài: lúc đó người lập chỉ còn hai lựa chọn — sửa
  // rồi trình lại, hoặc huỷ hẳn.
  const cancelOut = !tucked || !!record.returnNote;
  const cancelTone = "text-destructive hover:bg-destructive/10 hover:text-destructive";
  // Nút Xoá vẫn là `DeleteButton` (quyền, hộp hỏi lại, điều hướng sau khi xoá đều của nó) — có menu ⚙ thì chỉ ẩn đi.
  const deleteEl = allowed.has("delete") ? (
    <DeleteButton
      ref={deleteButton}
      variant="outline"
      className={tucked ? "hidden" : cn(side && "w-full", "text-destructive hover:bg-destructive hover:text-destructive-foreground")}
      recordItemId={record.id}
      record={record}
      noun="phiếu"
      // Màn này nói về đúng phiếu vừa xoá: ở lại là đứng trên một bản ghi không còn.
      onSuccess={() => list(resource, "replace")}
    />
  ) : null;

  const dialog = (
    <AlertDialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
      <ConfirmContent
        tone={pending === "reject" || pending === "cancel" ? "danger" : pending === "return" ? "warning" : "neutral"}
        icon={pending ? ICONS[pending] : undefined}
        title={current?.title}
        description={current?.description}
        cancelLabel={pending === "cancel" ? "Giữ phiếu" : "Chưa, để sau"}
        confirmLabel={current?.confirm}
        busy={busy}
        keepOpen
        onConfirm={() => {
          if (pending) void run(pending);
        }}
      >
        {current?.note ? (
          <div className="space-y-2">
            <Label htmlFor="voucher-note">
              {current.noteLabel}
              {current.note === "required" ? <span className="text-destructive"> *</span> : null}
            </Label>
            <Textarea id="voucher-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={maxLengthOf("NOTE")} />
            {textError("NOTE", current.noteLabel ?? "Ghi chú", note) ? (
              <p className="text-destructive text-sm">{textError("NOTE", current.noteLabel ?? "Ghi chú", note)}</p>
            ) : null}
          </div>
        ) : null}
      </ConfirmContent>
    </AlertDialog>
  );

  if (side) {
    const primary = [button("submit", "default"), button("approve", "default"), button("complete", "default")].filter(Boolean);
    const secondary = [
      allowed.has("edit") ? <EditButton key="edit" variant="outline" className="w-full" recordItemId={record.id} /> : null,
      button("return"),
      tucked ? null : button("reject", "outline", cancelTone),
      cancelOut ? button("cancel", "outline", cancelTone) : null,
      tucked ? null : deleteEl,
    ].filter(Boolean);
    const shown = primary.length + secondary.length + (extra ? 1 : 0) > 0;
    return (
      <>
        {shown ? (
          <section className="bg-muted/30 grid gap-2 border-t px-4 py-3.5 last:rounded-b-[inherit]">
            {primary}
            {extra}
            {secondary.length ? (
              // Một nút phụ thì đủ bề rộng; từ hai nút thì hàng hai, nút lẻ cuối kéo hết hàng.
              <div className={cn("grid gap-2", secondary.length > 1 && "grid-cols-2 [&>*:last-child:nth-child(odd)]:col-span-2")}>
                {secondary}
              </div>
            ) : null}
          </section>
        ) : null}
        {tucked ? deleteEl : null}
        {dialog}
      </>
    );
  }

  return (
    <>
      {cancelOut ? button("cancel") : null}
      {allowed.has("edit") ? <EditButton variant="outline" recordItemId={record.id} /> : null}
      {deleteEl}
      {button("submit", "default")}
      {/* Có menu ⚙ thì Từ chối vào đó: lúc chờ duyệt hàng nút chỉ còn Trả lại · Duyệt. */}
      {tucked ? null : button("reject")}
      {button("return")}
      {button("approve", "default")}
      {button("complete", "default")}
      {extra}
      {dialog}
    </>
  );
}
