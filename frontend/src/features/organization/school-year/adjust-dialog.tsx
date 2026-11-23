import { useQuery } from "@tanstack/react-query";
import { History, Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm, type FieldValues } from "react-hook-form";

import { kyInstance } from "@/shared/api/data";
import { TextareaField, TextField } from "@/shared/components/form/simple-fields";
import { LoadingText } from "@/shared/components/spinner";
import { EmptyState } from "@/shared/components/data-table/table-empty";
import { errorMessage } from "@/shared/lib/api-error";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Form } from "@/shared/ui/form";
import { SCHOOL_ADJUST_LABELS, type SchoolAdjustKind, type YearRow } from "@/domains/school-year/types";

const ACTIONS: Record<string, string> = {
  SAVE: "Áp dụng", REMOVE: "Bỏ", RECONFIRM: "Xác nhận lại", EXPIRE: "Hết hiệu lực", COPY: "Chép từ năm trước",
};

/**
 * Trường áp dụng điều chỉnh trên một dòng (bước 3) cho một điểm trường × năm học, đúng kiểu Sở cho: Giảm / Thay thế /
 * Dùng chung / Chọn trong nhóm; dòng "Không được phép" chỉ nhập nhu cầu ngoài thông tư. Lý do bắt buộc; máy chủ kiểm
 * thiết bị thay thế / dùng chung trên sổ.
 */
export function AdjustDialog({ row, yearId, campusId, onClose, onSaved }: {
  row: YearRow;
  yearId: number;
  campusId: number | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const kind: SchoolAdjustKind = row.allowedKind === "NONE" ? "OUTSIDE" : row.allowedKind;
  const current = row.adjustment && row.adjustment.status !== "EXPIRED" ? row.adjustment : null;
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(current?.substituteConfirmed ?? false);
  const form = useForm<FieldValues>({
    mode: "onTouched",
    defaultValues: { outsideNeed: current?.outsideNeed ?? "", reason: current?.reason ?? "" },
  });
  const submit = form.handleSubmit(async (v) => {
    setError(null);
    try {
      await kyInstance.post("school_norm_adjustments", {
        json: {
          schoolYearId: yearId, campusId, normId: row.normId, kind,
          outsideNeed: kind === "OUTSIDE" ? Number(v.outsideNeed) : null,
          substituteConfirmed: kind === "SUBSTITUTE" ? confirmed : null,
          chosen: kind === "CHOOSE_IN_GROUP" ? true : null,
          reason: v.reason,
        },
      }).json();
      onSaved();
    } catch (e) {
      setError(await errorMessage(e));
    }
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle className="pe-6">{SCHOOL_ADJUST_LABELS[kind]}: {row.name}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={(e) => void submit(e)} className="grid items-start gap-x-4 gap-y-5">
            <dl className="bg-surface grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 rounded-lg border px-4 py-3 text-sm">
              <dt className="text-muted-foreground">Theo thông tư</dt>
              <dd className="tabular-nums">{row.requiredTt ?? "—"} {row.unitName ?? ""}</dd>
              {row.allowedText ? (<><dt className="text-muted-foreground">Sở cho</dt><dd>{row.allowedText}</dd></>) : null}
              {row.basisText ? (<><dt className="text-muted-foreground">Căn cứ</dt><dd className="italic">{row.basisText}</dd></>) : null}
            </dl>
            {kind === "OUTSIDE" ? (
              <TextField control={form.control} name="outsideNeed" label="Nhu cầu thực tế ngoài thông tư" type="number"
                numberRule="QUANTITY" rules={{ required: "Vui lòng nhập nhu cầu thực tế" }} className="max-w-[12rem]" />
            ) : null}
            {/* Thay bằng thiết bị của danh mục: máy chủ kiểm trên sổ; hình thức khác thì trường xác nhận. */}
            {kind === "SUBSTITUTE" && !row.allowedText?.startsWith("Thay bằng thiết bị") ? (
              <label className="flex items-center gap-3 text-sm">
                <Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(v === true)} />
                Trường đã có thứ thay thế
              </label>
            ) : null}
            {kind === "CHOOSE_IN_GROUP" ? (
              <p className="text-sm">Chọn thiết bị này; thiết bị khác cùng nhóm chưa chọn về 0.</p>
            ) : null}
            <TextareaField control={form.control} name="reason" label="Lý do" rule="LONG_TEXT" max={1000} rows={2}
              rules={{ required: "Vui lòng nhập lý do" }} />
            {error ? <p className="text-destructive-text text-sm">{error}</p> : null}
            <DialogFooter className="justify-self-end">
              <Button type="button" variant="outline" onClick={onClose}>Đóng</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : null}
                {current ? "Lưu" : "Áp dụng"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

type Event = { id: number; action: string; kind: string | null; detail: string | null; reason: string | null; actorName: string | null; createdAt: string };

/** Lưu vết điều chỉnh của một dòng ở một điểm trường. */
export function AdjustHistoryDialog({ row, schoolId, campusId, onClose }: {
  row: YearRow;
  schoolId: number | null;
  campusId: number | null;
  onClose: () => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["school_norm_adjustments", "history", schoolId, row.normId, campusId],
    queryFn: ({ signal }) => kyInstance.get("school_norm_adjustments/history", {
      signal,
      searchParams: {
        normId: String(row.normId),
        ...(campusId != null ? { campusId: String(campusId) } : {}),
        ...(schoolId ? { schoolId: String(schoolId) } : {}),
      },
    }).json<Event[]>(),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle className="pe-6">Lịch sử điều chỉnh: {row.name}</DialogTitle>
        </DialogHeader>
        {isLoading ? <LoadingText /> : !data?.length ? (
          <EmptyState icon={<History />} title="Chưa có điều chỉnh nào" />
        ) : (
          <ol className="space-y-3 text-sm">
            {data.map((e) => (
              <li key={e.id} className="border-s-2 ps-3">
                <div className="font-medium">
                  {ACTIONS[e.action] ?? e.action}{e.kind ? ` · ${SCHOOL_ADJUST_LABELS[e.kind as SchoolAdjustKind] ?? e.kind}` : ""}
                </div>
                {e.detail ? <div>{e.detail}</div> : null}
                {e.reason ? <div className="text-muted-foreground">Lý do: {e.reason}</div> : null}
                <div className="text-muted-foreground text-xs">{e.createdAt}{e.actorName ? ` · ${e.actorName}` : ""}</div>
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}
