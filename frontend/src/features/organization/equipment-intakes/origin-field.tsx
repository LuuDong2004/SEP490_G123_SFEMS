import { useInvalidate, useNotification, useOne } from "@refinedev/core";
import { Lock, X } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useEffect, useRef, useState } from "react";
import { useController, useFormContext, useWatch, type Control } from "react-hook-form";

import { kyInstance } from "@/shared/api/data";
import { ConfirmContent } from "@/shared/components/confirm/confirm-content";
import { errorMessage } from "@/shared/lib/api-error";
import { AlertDialog } from "@/shared/ui/alert-dialog";
import { ChoiceWithNote } from "@/shared/components/form/choice-with-note";
import { FormHint } from "@/shared/components/form/help-hint";
import { useOriginRules } from "@/shared/hooks/use-origin-rules";
import { FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { fundingAllowed } from "@/domains/equipment/types";
import { VOUCHER_ROUTES } from "@/domains/equipment/types";
import type { IntakeSource } from "@/domains/equipment-intake/types";
import { IntakeSourceButton, IntakeSourcePicker, isSourceKind } from "./source-picker";
import { maxLengthOf, textRules } from "@/shared/lib/field-rules";
import { headFieldsOf } from "./head-fields";

/* eslint-disable @typescript-eslint/no-explicit-any */

const SOURCE_LABELS: Record<string, string> = {
  purchase_proposals: "đề xuất mua sắm",
  inventory_sessions: "biên bản kiểm kê",
};

/** "đề xuất mua sắm DX-2026-00012" — liên kết tới phiếu nguồn nếu biết đường dẫn của loại phiếu đó. */
export function IntakeSourceLink({ source }: { source: IntakeSource }) {
  // Hàng mua: nguồn là KẾ HOẠCH mua sắm đã duyệt; phiếu nhớ đề xuất của trường trong kế hoạch đó, nên tên kế
  // hoạch đọc qua đề xuất. Chưa đọc được (đang tải, không có quyền) thì rơi về số đề xuất như cũ.
  const viaProposal = source.resource === "purchase_proposals" && source.id != null;
  const { result: proposal } = useOne<{ plan?: { id: number; title: string } | null }>({
    resource: "purchase_proposals",
    id: source.id ?? "",
    queryOptions: { enabled: viaProposal, retry: false, staleTime: 5 * 60_000 },
    errorNotification: false,
  });
  if (viaProposal && proposal?.plan) {
    // Chỉ tên kế hoạch (trưởng nhóm 14/11/2026: "Lập từ" + tên kế hoạch) — ô ngay trên đã ghi "Kế hoạch mua sắm".
    return (
      <Link to={`/procurement-plans/show/${proposal.plan.id}`} className="text-primary font-medium hover:underline" title={proposal.plan.title}>
        {proposal.plan.title}
      </Link>
    );
  }
  const route = VOUCHER_ROUTES[source.resource];
  const text = `${SOURCE_LABELS[source.resource] ?? "phiếu"} ${source.code ?? ""}`.trim();
  return route && source.id ? (
    <Link to={`${route}/show/${source.id}`} className="text-primary font-medium hover:underline">
      {text}
    </Link>
  ) : (
    <span className="font-medium">{text}</span>
  );
}

/**
 * NGUỒN HÌNH THÀNH của cả phiếu ghi tăng — một lần ghi tăng là một nguồn: mua sắm, được Sở phân bổ,
 * được tặng, kiểm kê thừa, tự làm, khác. Chỉ chọn, không gõ tay (báo cáo đếm theo nó).
 *
 * <p>Nó là ô đầu tiên về NGUỒN vì mọi ô nguồn khác đi theo nó: nguồn kinh phí nào chọn được ở từng
 * dòng, và dòng có hình thức mua sắm hay không. Đổi nguồn hình thành thì những gì ở các dòng KHÔNG còn
 * đi với nó được gỡ ngay tại đây — nguồn kinh phí không hợp lệ, hình thức mua sắm của hàng không phải
 * mua — thay vì để lại rồi máy chủ từ chối lúc lưu.
 *
 * <p>Phiếu lập từ phiếu nghiệp vụ khác (đề xuất mua sắm, biên bản kiểm kê) thì nguồn hình thành là hệ
 * quả của phiếu nguồn: ô bị khoá và nói rõ vì sao.
 */
export function IntakeOriginFields({ control, record }: { control: Control<any>; record?: any }) {
  const { origins, ruleOf } = useOriginRules();
  const { getValues, setValue } = useFormContext();
  const originId = useWatch({ control, name: "originSource.id" });
  const rule = ruleOf(originId);
  // Nguồn "Khác" (luật đòi ghi rõ): phần ghi rõ gõ ngay trong ô Nguồn hình thành, bắt buộc khi đang chọn nó.
  const otherOrigin = origins.find((o) => ruleOf(o.id)?.noteRequired);
  const { field: noteField, fieldState: noteState } = useController({
    control, name: "originNote", rules: rule?.noteRequired ? textRules("SHORT_TEXT", "Ghi rõ nguồn hình thành", { max: 200, min: 5 }) : undefined,
  });
  const source: IntakeSource | null = record?.source ?? null;
  // Đã có thiết bị thì KHOÁ nguồn hình thành (trưởng nhóm 13/11/2026): đổi nguồn sau khi đã chọn hàng là ra phiếu
  // "Kế hoạch mua sắm" / "Kiểm kê thừa" không theo kế hoạch, biên bản nào, và nguồn kinh phí của dòng lệch nguồn.
  // Muốn đổi thì xoá hết thiết bị trước.
  const lineCount = ((useWatch({ control, name: "lines" }) as unknown[] | undefined) ?? []).length;
  const lockedByLines = !source && lineCount > 0;
  // Lập tay với nguồn "Mua sắm" / "Kiểm kê thừa": hỏi ngay phiếu nguồn. Chỉ lúc LẬP — phiếu đã
  // lưu thì hoặc đã mang phiếu nguồn, hoặc người lập đã chọn lập tay.
  const schoolId = useWatch({ control, name: "school.id" }) as number | null | undefined;
  const originCode = origins.find((o) => String(o.id) === String(originId ?? ""))?.systemKey;
  const sourceKind = !record && isSourceKind(originCode) ? originCode : null;
  const [picking, setPicking] = useState(false);

  // CHỌN LẠI phiếu nguồn của một phiếu nháp lập từ đề xuất mua sắm: phiếu nháp là hệ quả của đề xuất đã
  // chọn (dòng, đơn giá chép từ nó), nên đổi đề xuất = bỏ phiếu nháp này rồi chọn lại từ đầu. Xoá phiếu
  // nháp là đề xuất tự trở lại "chờ nhập hàng" (khoá ngoại `intake_id` ON DELETE SET NULL). Phiếu nháp từ
  // biên bản kiểm kê thì không: nó do hệ thống lập lúc duyệt biên bản, xoá đi không có lối lập lại.
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const { open: notify } = useNotification();
  const mayRepick = !!record && source?.resource === "purchase_proposals" && record.status === "DRAFT" && (record._actions ?? []).includes("delete");
  const [repick, setRepick] = useState(false);
  const [repicking, setRepicking] = useState(false);
  async function dropAndRepick() {
    setRepicking(true);
    try {
      await kyInstance.delete(`equipment_intakes/${record.id}`);
      invalidate({ resource: "equipment_intakes", invalidates: ["list"] });
      invalidate({ resource: "purchase_proposals", invalidates: ["list", "detail"] });
      navigate("/equipment-intakes/create?pick=MUA_SAM", { replace: true });
    } catch (error) {
      notify?.({ type: "error", message: await errorMessage(error) });
      setRepicking(false);
      setRepick(false);
    }
  }
  // Vừa bỏ phiếu nháp để chọn lại (`?pick=<mã nguồn>`): chọn sẵn nguồn hình thành đó và mở hộp chọn phiếu.
  const [params] = useSearchParams();
  const pickCode = record ? null : params.get("pick");
  useEffect(() => {
    if (!pickCode || getValues("originSource.id")) return;
    const origin = origins.find((o) => o.systemKey === pickCode);
    if (!origin) return;
    setValue("originSource", { id: origin.id, name: origin.name }, { shouldValidate: true });
    setPicking(isSourceKind(origin.systemKey));
  }, [pickCode, origins, getValues, setValue]);
  // Nguồn đang chọn TRƯỚC khi đổi sang nguồn phải đi theo phiếu nguồn — đóng hộp chọn mà không chọn gì thì trả về nó.
  const before = useRef<{ id: number | null; name?: string } | null>(null);
  const change = (id: string) => {
    before.current = (getValues("originSource") as { id: number | null; name?: string } | null) ?? null;
    // Radix `Select` bắn `onValueChange("")` khi giá trị đang có chưa khớp mục nào (danh sách tới sau):
    // nhận nó là ghi `Number("") = 0` đè lên nguồn hình thành của phiếu, và mọi ô nguồn phía dưới bị khoá.
    if (!id) return;
    setValue("originSource", { id: Number(id), name: origins.find((o) => String(o.id) === id)?.name }, { shouldDirty: true, shouldValidate: true });
    if (!record && isSourceKind(origins.find((o) => String(o.id) === id)?.systemKey)) setPicking(true);
    const next = ruleOf(id);
    if (!next) return;
    // Ô chứng từ mà nguồn mới không có thì gỡ giá trị — không để một số hoá đơn ẩn đi theo phiếu tặng.
    const shown = headFieldsOf(origins.find((o) => String(o.id) === id)?.systemKey);
    if (!shown.supplier) setValue("supplier", "", { shouldDirty: true });
    if (!shown.documentNo) setValue("documentNo", "", { shouldDirty: true });
    if (!shown.documentDate) setValue("documentDate", null, { shouldDirty: true });
    if (!next.noteRequired) setValue("originNote", "", { shouldDirty: true });
    if (!fundingAllowed(next, getValues("fundingSource"))) setValue("fundingSource", null, { shouldDirty: true });
    if (!next.acquisitionMethod) {
      setValue("acquisitionMethod", { id: null }, { shouldDirty: true });
      setValue("acquisitionNoteHead", "", { shouldDirty: true });
    }
    ((getValues("lines") ?? []) as any[]).forEach((line, i) => {
      if (!fundingAllowed(next, line?.fundingSource)) setValue(`lines.${i}.fundingSource`, null, { shouldDirty: true });
      if (!next.acquisitionMethod && line?.acquisitionMethod?.id) setValue(`lines.${i}.acquisitionMethod`, { id: null }, { shouldDirty: true });
    });
  };

  // "Kế hoạch mua sắm" chỉ đi theo một kế hoạch đã duyệt (trưởng nhóm 13/11/2026): đóng hộp chọn kế hoạch mà không
  // chọn thì KHÔNG giữ nguồn này — trả về nguồn trước đó (hoặc để trống), không để phiếu mua sắm không kế hoạch.
  // Kiểm kê thừa cũng vậy: thiết bị thừa phải đi từ một biên bản kiểm kê đã duyệt.
  const cancelPick = () => {
    const prev = before.current;
    setValue("originSource", prev?.id ? prev : { id: null }, { shouldDirty: true, shouldValidate: true });
    notify?.(sourceKind === "KIEM_KE_THUA"
      ? { type: "error", message: "Chưa chọn biên bản kiểm kê", description: "Nguồn hình thành \"Kiểm kê thừa\" phải theo một biên bản kiểm kê đã duyệt." }
      : { type: "error", message: "Chưa chọn kế hoạch mua sắm", description: "Nguồn hình thành \"Kế hoạch mua sắm\" phải theo một kế hoạch đã duyệt của Sở." });
  };

  return (
    <>
      <FormField
        control={control}
        name="originSource.id"
        // Bắt buộc cả khi LƯU NHÁP (15/11/2026): form trống không lưu thành phiếu rỗng; máy chủ cũng chặn.
        rules={{ validate: (v) => (v != null && v !== "" ? true : "Vui lòng chọn nguồn hình thành") }}
        render={({ field, fieldState }) => (
          // Cột co theo khung: dòng "Lập từ …" dài cắt bớt, không kéo ô đè lên ô bên cạnh.
          <FormItem className="grid-cols-[minmax(0,1fr)]">
            <FormLabel required>Nguồn hình thành</FormLabel>
            <FormHint>
              {source
                ? "Phiếu lập từ phiếu nghiệp vụ khác nên nguồn hình thành theo phiếu đó, không đổi được."
                : originCode === "PHAN_BO"
                  ? "Cấp trên giao về theo quyết định: Sở, Phòng, UBND mua sắm tập trung rồi bàn giao; dự án giao về; đơn vị không dùng hệ thống chuyển sang."
                  : "Thiết bị trên phiếu này từ đâu ra. Một phiếu một nguồn; hàng từ nguồn khác thì lập phiếu khác."}
            </FormHint>
            {/* "Khác" ghi rõ ngay trong ô — không có ô "Ghi rõ nguồn hình thành" riêng. Giá trị đang có mà danh mục
                chưa tải xong vẫn phải có mục của nó — Radix không vẽ được giá trị thiếu mục. */}
            {/* Ô bị khoá thì biểu tượng khoá nằm TRONG ô, đè lên mũi tên chọn (trưởng nhóm 13/11/2026). */}
            <div className="relative">
            <ChoiceWithNote value={field.value == null ? "" : String(field.value)} onChange={change} disabled={!!source || lockedByLines}
              invalid={!!fieldState.error || !!noteState.error}
              options={[
                ...(field.value != null && !origins.some((o) => String(o.id) === String(field.value)) && record?.originSource?.name
                  ? [{ value: String(field.value), label: record.originSource.name as string }] : []),
                ...origins.map((o) => ({ value: String(o.id), label: o.name })),
              ]}
              otherValue={otherOrigin ? String(otherOrigin.id) : "__"}
              placeholder="Vui lòng chọn nguồn hình thành" notePlaceholder="Nguồn khác: ghi rõ" noteMax={maxLengthOf("SHORT_TEXT", 200)}
              note={noteField.value} onNoteChange={noteField.onChange} onNoteBlur={noteField.onBlur} />
            {source || lockedByLines ? (
              <span className="bg-muted pointer-events-none absolute top-[1.125rem] right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded">
                <Lock className="text-muted-foreground size-3.5" />
              </span>
            ) : null}
            </div>
            {lockedByLines ? (
              <p className="text-muted-foreground text-xs" title="Xoá hết thiết bị trong danh sách để đổi nguồn hình thành">
                Đã có danh sách thiết bị ghi tăng
              </p>
            ) : null}
            {source ? (
              <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <span className="min-w-0 truncate">Lập từ <IntakeSourceLink source={source} /></span>
                {mayRepick ? (
                  <button type="button" aria-label="Bỏ phiếu nguồn để chọn lại" title="Bỏ phiếu nguồn để chọn lại"
                    className="hover:bg-muted hover:text-destructive-text ms-auto shrink-0 rounded-sm p-0.5" onClick={() => setRepick(true)}>
                    <X className="size-3.5" />
                  </button>
                ) : null}
              </p>
            ) : null}
            {sourceKind ? <IntakeSourceButton kind={sourceKind} onClick={() => setPicking(true)} /> : null}
            <FormMessage>{noteState.error?.message}</FormMessage>
          </FormItem>
        )}
      />
      <AlertDialog open={repick} onOpenChange={(o) => !repicking && setRepick(o)}>
        <ConfirmContent
          tone="warning"
          title="Bỏ phiếu nháp này để chọn kế hoạch khác?"
          description={`Phiếu ghi tăng nháp này bị xoá cùng những gì đã sửa trên nó, và đề xuất ${source?.code ?? ""} trở lại chờ nhập hàng. Sau đó chọn lại kế hoạch mua sắm, hoặc lập tay không theo kế hoạch nào.`}
          cancelLabel="Giữ phiếu này"
          confirmLabel="Bỏ phiếu, chọn lại"
          destructive
          busy={repicking}
          keepOpen
          onConfirm={() => void dropAndRepick()}
        />
      </AlertDialog>
      {sourceKind ? <IntakeSourcePicker kind={sourceKind} schoolId={schoolId} open={picking} onOpenChange={setPicking}
        onCancel={cancelPick} /> : null}
    </>
  );
}
