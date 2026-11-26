import { useQuery } from "@tanstack/react-query";
import { History, Loader2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useForm, type FieldValues } from "react-hook-form";

import { kyInstance } from "@/shared/api/data";
import { FormHint } from "@/shared/components/form/help-hint";
import { TextareaField } from "@/shared/components/form/simple-fields";
import { LoadingText } from "@/shared/components/spinner";
import { EmptyState } from "@/shared/components/data-table/table-empty";
import { errorMessage } from "@/shared/lib/api-error";
import { mergeRules, numberRules } from "@/shared/lib/field-rules";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { Input } from "@/shared/ui/input";
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
  const unit = row.unitName ?? "";
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle className="pe-6 leading-snug">{SCHOOL_ADJUST_LABELS[kind]}: {row.name}</DialogTitle>
          <DialogDescription>{KIND_HELP[kind]}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          {/* Không `items-start`: CSS chung của hộp (`.dialog-fixed > form`) biến form thành cột flex, `items-start` làm
              mọi ô co lại bằng nội dung (ô số, ô lý do hẹp như cái tem). Để mặc định thì ô trải hết bề ngang hộp. */}
          <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-5">
            <dl className="bg-surface-subtle divide-y rounded-lg border text-sm">
              <Fact label="Theo thông tư">
                {row.requiredTt == null ? <span className="text-muted-foreground">Chưa tính được</span> : <><span className="text-base font-semibold tabular-nums">{row.requiredTt}</span> {unit}</>}
              </Fact>
              {row.allowedText ? <Fact label="Sở cho">{row.allowedText}</Fact> : null}
              {row.basisText ? <Fact label="Căn cứ"><span className="italic">{row.basisText}</span></Fact> : null}
            </dl>
            {kind === "OUTSIDE" ? (
              <FormField control={form.control} name="outsideNeed"
                rules={mergeRules(numberRules("QUANTITY", "Nhu cầu thực tế"), { required: "Vui lòng nhập nhu cầu thực tế" })}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nhu cầu thực tế</FormLabel>
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Input type="number" inputMode="numeric" min={1} className="w-36 tabular-nums" placeholder="Ví dụ 10"
                          value={field.value ?? ""} name={field.name} ref={field.ref} onBlur={field.onBlur}
                          onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))} />
                      </FormControl>
                      {unit ? <span className="text-muted-foreground text-sm">{unit}</span> : null}
                    </div>
                    <FormHint>
                      Số lượng trường thực sự cần. Mức theo thông tư ({row.requiredTt == null ? "chưa tính được" : `${row.requiredTt} ${unit}`.trim()}) giữ nguyên, số này hiện ở
                      cột Ngoài TT để Sở xem xét.
                    </FormHint>
                    <FormMessage />
                  </FormItem>
                )} />
            ) : null}
            {/* Thay bằng thiết bị của danh mục: máy chủ kiểm trên sổ; hình thức khác thì trường xác nhận. */}
            {kind === "SUBSTITUTE" && !row.allowedText?.startsWith("Thay bằng thiết bị") ? (
              <label className="bg-surface-subtle flex items-center gap-3 rounded-lg border px-4 py-3 text-sm">
                <Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(v === true)} />
                Trường đã có thứ thay thế
              </label>
            ) : null}
            <TextareaField control={form.control} name="reason" label="Lý do" rule="LONG_TEXT" max={1000} rows={3}
              className="max-w-none @2xl:max-w-none @4xl:max-w-none"
              placeholder={kind === "OUTSIDE" ? "Ví dụ: trường có 10 lớp học thực hành, mỗi lớp cần một bộ" : "Ghi rõ vì sao trường điều chỉnh"}
              rules={{ required: "Vui lòng nhập lý do" }} />
            {error ? <p className="text-destructive-text text-sm" role="alert">{error}</p> : null}
            <DialogFooter>
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

/** Một câu nói hình thức điều chỉnh làm gì — đặt dưới tiêu đề hộp. */
const KIND_HELP: Record<SchoolAdjustKind, string> = {
  OUTSIDE: "Sở không cho điều chỉnh thiết bị này. Trường ghi nhu cầu thực tế kèm lý do để Sở xem xét.",
  REDUCE: "Trường cần ít hơn mức thông tư, trong giới hạn Sở cho.",
  SUBSTITUTE: "Trường dùng thứ khác thay cho thiết bị này, không cần mua theo thông tư.",
  SHARED: "Trường dùng chung thiết bị đã có trên sổ, không cần mua riêng.",
  CHOOSE_IN_GROUP: "Trường chọn thiết bị này trong nhóm. Các thiết bị khác cùng nhóm chưa chọn tính về 0.",
};

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-baseline gap-3 px-4 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
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
