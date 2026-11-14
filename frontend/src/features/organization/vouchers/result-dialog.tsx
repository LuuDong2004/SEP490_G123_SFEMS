import { useInvalidate, useNotification } from "@refinedev/core";
import { useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck } from "lucide-react";
import { useState } from "react";

import { kyInstance } from "@/shared/api/data";
import { DateInput } from "@/shared/components/form/date-input";
import { MoneyInput } from "@/shared/components/form/money-input";
import { VoucherDetailsFields, detailsError } from "@/shared/components/voucher/voucher-details";
import { useVoucherForm } from "@/shared/hooks/use-voucher-form";
import { errorMessage } from "@/shared/lib/api-error";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Textarea } from "@/shared/ui/textarea";
import { EQUIPMENT_CONDITION_LABELS } from "@/domains/equipment/types";
import { CostVariance } from "@/features/organization/vouchers/cost-variance";
import { todayLocal } from "@/shared/lib/format";
import { maxLengthOf, numberError, textError } from "@/shared/lib/field-rules";

const money = new Intl.NumberFormat("vi-VN");
/** Kết quả mà tài sản không dùng lại được — tình trạng sau là Hỏng, tài sản chờ xử lý. */
const FAILED_RESULTS = ["UNREPAIRABLE", "FAIL", "REJECTED"];
/** Tình trạng sau khi sửa / bảo trì được (QLTB-557): Tốt · Khá · Trung bình · Kém. */
const WORKING_CONDITIONS = ["TOT", "TRUNG_BINH", "KEM"];

/**
 * Hộp thoại ghi kết quả của phiếu sửa chữa, bảo hành, bảo dưỡng: kết quả, ngày,
 * chi phí, tình trạng sau, ghi chú. Tên các trường ngày / chi phí khác nhau giữa
 * ba loại phiếu nên truyền vào; phần còn lại giống hệt.
 *
 * Dưới đó là các trường chứng từ của CHÍNH bước này (giai đoạn "result" trong cấu hình phiếu: số
 * biên bản nghiệm thu, người bàn giao, người nhận lại…). Chúng từng nằm trên form lập phiếu, lúc
 * chưa ai biết để điền; khai ở đây thì khai lúc có thật.
 */
export function ResultDialog({
  resource,
  id,
  schoolId,
  title,
  description,
  results,
  dateKey,
  dateLabel,
  costKey,
  estimatedCost,
  costRequired = false,
  hint,
}: {
  resource: string;
  id: number;
  /** Trường của phiếu — ô chọn cán bộ trong phần biên bản lấy người của đúng trường này. */
  schoolId?: number | null;
  title: string;
  description: string;
  results: Record<string, string>;
  dateKey: string;
  dateLabel: string;
  costKey: string;
  /**
   * Chi phí dự kiến đã duyệt (phiếu sửa chữa). Có thì hộp hiện nó cạnh chi phí thực tế, kèm chênh lệch, và
   * vượt dự kiến thì bắt ghi lý do — cùng luật với `RepairOrderService.recordResult`.
   */
  estimatedCost?: number | null;
  /** Chi phí thực tế bắt buộc (sửa thuê ngoài) — cùng luật với `RepairOrderService.recordResult`. */
  costRequired?: boolean;
  /** Câu giải thích hiện theo kết quả đang chọn. */
  hint?: (result: string) => string | null;
}) {
  const { open: notify } = useNotification();
  const invalidate = useInvalidate();
  const queryClient = useQueryClient();
  const first = Object.keys(results)[0];
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState(first);
  const [day, setDay] = useState(todayLocal);
  const [cost, setCost] = useState<number | null>(null);
  const [condition, setCondition] = useState("TOT");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [details, setDetails] = useState<Record<string, unknown>>({});
  const config = useVoucherForm(resource);

  async function save() {
    setBusy(true);
    try {
      await kyInstance.post(`${resource}/${id}/result`, {
        json: {
          result,
          [dateKey]: day,
          [costKey]: cost,
          conditionAfter: failed ? "HONG" : condition,
          note: note || null,
          details,
        },
      });
      notify?.({ type: "success", message: "Đã ghi kết quả" });
      setOpen(false);
      invalidate({ resource, invalidates: ["list", "detail"], id });
      invalidate({ resource: "equipment", invalidates: ["list"] });
      queryClient.invalidateQueries({ queryKey: ["voucher_events", resource, id] });
    } catch (error) {
      notify?.({ type: "error", message: await errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  const failed = FAILED_RESULTS.includes(result);
  const help = hint?.(result);
  const estimated = estimatedCost == null ? null : Number(estimatedCost);
  const over = estimated != null && cost != null && cost > estimated;
  const missingReason = over && note.trim() === "";
  const missingCost = costRequired && cost == null;
  const noteError = textError("LONG_TEXT", "Ghi chú", note, 1000);
  const costError = numberError("MONEY", "Chi phí thực tế", cost);
  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <ClipboardCheck />
        Ghi kết quả
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Kết quả</Label>
              <Select value={result} onValueChange={setResult}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(results).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>{dateLabel}</Label><DateInput value={day} onChange={(v) => setDay(v ?? day)} /></div>
            {estimated != null ? (
              <div className="space-y-2">
                <Label>Chi phí dự kiến (đã duyệt)</Label>
                <Input readOnly tabIndex={-1} className="bg-muted tabular-nums" value={`${money.format(estimated)} đ`} />
              </div>
            ) : null}
            <div className="space-y-2"><Label>Chi phí thực tế (đ){costRequired ? <span className="text-destructive"> *</span> : null}</Label>
              <MoneyInput value={cost} onChange={setCost} />
              {costError ? <p className="text-destructive text-sm">{costError}</p> : null}</div>
            {estimated != null ? <CostVariance estimated={estimated} actual={cost} className="sm:col-span-2" /> : null}
            <div className="space-y-2">
              <Label>Tình trạng sau</Label>
              {failed ? (
                <Input readOnly tabIndex={-1} className="bg-muted" value="Hỏng — chờ xử lý" />
              ) : (
                <Select value={condition} onValueChange={setCondition}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WORKING_CONDITIONS.map((v) => <SelectItem key={v} value={v}>{EQUIPMENT_CONDITION_LABELS[v]}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Ghi chú{over ? <span className="text-destructive"> *</span> : null}</Label>
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={maxLengthOf("LONG_TEXT", 1000)}
                placeholder={over ? "Vì sao vượt chi phí dự kiến? (VD: phát sinh thay bo mạch)" : undefined}
                aria-invalid={missingReason || undefined} />
              {missingReason ? <p className="text-destructive text-sm">Chi phí thực tế vượt dự kiến đã duyệt — ghi rõ lý do.</p> : null}
              {noteError ? <p className="text-destructive text-sm">{noteError}</p> : null}
            </div>
          </div>
          {help ? <p className="text-muted-foreground text-sm">{help}</p> : null}
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <VoucherDetailsFields config={config} value={details as any} onChange={setDetails as any} schoolId={schoolId} stage="result" compact />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>Quay lại</Button>
            <Button type="button" onClick={() => void save()} disabled={busy || missingReason || missingCost || !!noteError || !!costError || !!detailsError(config, details as Parameters<typeof detailsError>[1])}>Ghi kết quả</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
