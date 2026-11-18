import { ArrowLeftRight, SlidersHorizontal, TrendingDown } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Label } from "@/shared/ui/label";
import { Slider } from "@/shared/ui/slider";
import { Switch } from "@/shared/ui/switch";
import { Textarea } from "@/shared/ui/textarea";
import { cn } from "@/shared/lib/utils";
import { maxLengthOf, textError } from "@/shared/lib/field-rules";
import { type AdjustRule, type RuleItem } from "@/domains/standard-adjustment/types";

export const EMPTY_RULE = (catalogId: number): AdjustRule => ({
  catalogId, allowReduce: false, reduceFloor: 50, allowSubstitute: false, substitutes: [], allowCustom: false, basis: null,
});

const TICKS = [0, 25, 50, 75, 100];

/** Một cách điều chỉnh: biểu tượng, tên, một câu giải thích, công tắc bên phải; bật thì mở phần khai bên dưới. */
function Option({ on, onChange, icon, title, hint, children }: {
  on: boolean;
  onChange: (on: boolean) => void;
  icon: ReactNode;
  title: string;
  hint: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn("rounded-xl border transition-colors", on ? "border-primary/40 bg-primary/[0.04] shadow-e1" : "bg-card")}>
      <label className="flex cursor-pointer items-center gap-3 px-4 py-3.5">
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg [&_svg]:size-[1.125rem]",
          on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{title}</span>
          <span className="text-muted-foreground block text-xs">{hint}</span>
        </span>
        <Switch checked={on} onCheckedChange={onChange} />
      </label>
      {on && children ? <div className="space-y-3 border-t border-dashed px-4 py-3.5">{children}</div> : null}
    </div>
  );
}

/**
 * Cấu hình điều chỉnh của MỘT thiết bị (Sở): cho đổi số lượng (giảm không thấp hơn mức sàn % chuẩn Bộ) và cho thay
 * thế — tích thì TRƯỜNG tự khai thiết bị thay thế và tỉ lệ quy đổi (`allowCustom`). Sở không chọn sẵn thiết bị thay thế
 * trong danh mục nữa (theo trưởng nhóm; `allowSubstitute` còn ở máy chủ). "Xong" chỉ ghi vào thay đổi chưa lưu.
 */
export function RuleSheet({ item, rule, readOnly, onDone, onClose }: {
  item: RuleItem | null;
  rule: AdjustRule | null;
  readOnly: boolean;
  onDone: (rule: AdjustRule) => void;
  onClose: () => void;
}) {
  const [r, setR] = useState<AdjustRule | null>(null);
  useEffect(() => {
    if (item) setR(structuredClone(rule ?? EMPTY_RULE(item.catalogId)));
  }, [item, rule]);
  if (!item || !r) return null;

  const patch = (p: Partial<AdjustRule>) => setR((x) => (x ? { ...x, ...p } : x));
  const basisError = textError("NOTE", "Căn cứ, ghi chú", r.basis);

  return (
    <Dialog open onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="flex flex-col gap-0 p-0">
        <DialogHeader className="space-y-2 border-b px-6 pt-5 pb-4 text-left">
          <div className="flex items-start gap-3">
            <span className="bg-brand-gradient text-primary-foreground flex size-10 shrink-0 items-center justify-center rounded-xl [&_svg]:size-5">
              <SlidersHorizontal />
            </span>
            <div className="min-w-0 space-y-1.5">
              <DialogTitle className="text-base leading-snug">{item.name}</DialogTitle>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="bg-muted rounded-md px-2 py-0.5 font-mono text-xs">{item.code}</span>
                {item.quantityText ? <Badge variant="neutral">Chuẩn Bộ {item.quantityText}</Badge> : null}
                {item.subjectName ? <Badge variant="neutral">{item.subjectName}</Badge> : null}
              </div>
            </div>
          </div>
          <DialogDescription className={cn("rounded-md px-3 py-2 text-sm", r.allowReduce || r.allowCustom ? "bg-primary/[0.06] text-foreground" : "bg-muted")}>
            {r.allowReduce || r.allowCustom ? (
              <>
                Trường được{" "}
                {r.allowReduce ? <><b>đổi số lượng</b> (giảm không thấp hơn {r.reduceFloor}% chuẩn Bộ)</> : null}
                {r.allowReduce && r.allowCustom ? " và " : null}
                {r.allowCustom ? <b>thay thế</b> : null}.
              </>
            ) : "Bắt buộc theo chuẩn Bộ — trường không được điều chỉnh."}
          </DialogDescription>
        </DialogHeader>

        <fieldset disabled={readOnly} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <Option on={r.allowReduce} onChange={(on) => patch({ allowReduce: on })} icon={<TrendingDown />}
            title="Đổi số lượng" hint="Trường được tăng hoặc giảm số phải có.">
            <div className="space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium">Mức sàn khi giảm</span>
                <span className="text-primary text-sm font-semibold tabular-nums">{r.reduceFloor}% chuẩn Bộ</span>
              </div>
              <Slider value={[r.reduceFloor]} min={0} max={100} step={5} aria-label="Mức sàn khi giảm"
                onValueChange={([v]) => patch({ reduceFloor: v })} />
              <div className="text-muted-foreground flex justify-between text-xs">
                {TICKS.map((f) => (
                  <button key={f} type="button" onClick={() => patch({ reduceFloor: f })}
                    className={cn("tabular-nums hover:text-foreground", r.reduceFloor === f && "text-primary font-semibold")}>
                    {f}%
                  </button>
                ))}
              </div>
            </div>
            <p className="text-muted-foreground text-xs">
              {r.reduceFloor === 0
                ? "0%: trường được bỏ hẳn thiết bị này."
                : r.reduceFloor === 100
                  ? "100%: trường chỉ được tăng, không được giảm."
                  : "Trường tăng tự do; giảm không thấp hơn mức sàn."}
            </p>
          </Option>

          <Option on={r.allowCustom} onChange={(on) => patch({ allowCustom: on })} icon={<ArrowLeftRight />}
            title="Cho thay thế" hint="Bật thì trường tự khai thiết bị thay thế và tỉ lệ quy đổi khi đề nghị." />

          <div className="space-y-1.5">
            <Label htmlFor="r-basis">Căn cứ, ghi chú</Label>
            <Textarea id="r-basis" rows={2} value={r.basis ?? ""} onChange={(e) => patch({ basis: e.target.value })}
              placeholder="Số văn bản, lý do cho phép" maxLength={maxLengthOf("NOTE")} />
            {basisError ? <p className="text-destructive text-sm">{basisError}</p> : null}
          </div>
        </fieldset>

        <DialogFooter className="border-t px-6 py-3">
          <Button type="button" variant="outline" onClick={onClose}>{readOnly ? "Đóng" : "Huỷ"}</Button>
          {readOnly ? null : <Button type="button" disabled={!!basisError} onClick={() => onDone(r)}>Xong</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
