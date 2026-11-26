import { useNotification } from "@refinedev/core";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";

import { kyInstance } from "@/shared/api/data";
import { errorMessage } from "@/shared/lib/api-error";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import type { InitClasses, InitResult } from "@/domains/school-year/types";

const CLASS_OPTIONS: { value: InitClasses; label: string; hint: string }[] = [
  { value: "PROMOTE", label: "Lên lớp tự động", hint: "6A1 → 7A1; lớp cuối cấp ra trường" },
  { value: "COPY", label: "Chép nguyên danh sách lớp năm trước", hint: "Giữ khối, tên lớp, chủ nhiệm" },
  { value: "EMPTY", label: "Để trống", hint: "Trường tự khai lớp" },
];

/**
 * Khai dữ liệu năm học mới (năm vừa thành hiện hành) cho trường của người dùng: lớp, phân công giáo viên, điều chỉnh chuẩn chép từ năm liền trước.
 * Việc của từng trường — Sở không khởi tạo thay.
 */
export function InitYearDialog({ fromYear, target, onClose, onDone }: {
  fromYear?: string;
  target: { id: number; name: string };
  onClose: () => void;
  onDone: (yearId: number) => void;
}) {
  const { open: notify } = useNotification();
  const qc = useQueryClient();
  const [classes, setClasses] = useState<InitClasses>("PROMOTE");
  const [assignments, setAssignments] = useState(true);
  const [adjustments, setAdjustments] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await kyInstance.post("school_year_profiles/init", {
        json: { schoolYearId: target.id, classes, copyAssignments: assignments, copyAdjustments: adjustments },
        timeout: 120_000,
      }).json<InitResult>();
      notify?.({
        type: "success",
        message: `Đã khai dữ liệu ${target.name.toLowerCase()}, rà soát rồi xác nhận đã khai`,
        description: `${r.classes} lớp · ${r.assignments} phân công · ${r.adjustments} điều chỉnh`,
      });
      await qc.invalidateQueries();
      onDone(target.id);
    } catch (e) {
      setError(await errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Khai dữ liệu {target.name.toLowerCase()}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <fieldset className="space-y-2">
            <legend className="mb-2 font-medium">Lớp học{fromYear ? ` (từ ${fromYear.toLowerCase()})` : ""}</legend>
            {CLASS_OPTIONS.map((o) => (
              <label key={o.value} className={cn("flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5",
                classes === o.value && "border-primary bg-primary/[0.04]")}>
                <input type="radio" name="init-classes" className="accent-primary mt-0.5 size-4" checked={classes === o.value}
                  onChange={() => setClasses(o.value)} />
                <span>
                  <span className="block font-medium">{o.label}</span>
                  <span className="text-muted-foreground text-xs">{o.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <label className="flex items-center gap-3">
            <Checkbox checked={assignments} onCheckedChange={(v) => setAssignments(v === true)} />
            Chép phân công giáo viên (bỏ cán bộ đã nghỉ)
          </label>
          <label className="flex items-center gap-3">
            <Checkbox checked={adjustments} onCheckedChange={(v) => setAdjustments(v === true)} />
            Chép điều chỉnh chuẩn tối thiểu, chờ xác nhận lại
          </label>
          {error ? <p className="text-destructive-text">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Huỷ</Button>
          <Button type="button" disabled={busy} onClick={() => void run()}>
            {busy ? <Loader2 className="animate-spin" /> : null}
            Khai dữ liệu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
