import { useNotification } from "@refinedev/core";
import { FileSpreadsheet, Loader2, X } from "lucide-react";
import { useState } from "react";

import { kyInstance, DOWNLOAD_TIMEOUT } from "@/shared/api/data";
import { AsyncCombobox } from "@/shared/components/form/async-combobox";
import { errorMessage } from "@/shared/lib/api-error";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Label } from "@/shared/ui/label";

type School = { id: number; name: string };

/** Tải tệp Excel của bảng tổng hợp thiết bị với một bộ tham số. */
export async function downloadSummary(params: Record<string, string>, filename: string) {
  const blob = await kyInstance.get("equipment/summary.xlsx", { searchParams: params, timeout: DOWNLOAD_TIMEOUT }).blob();
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement("a"), { href: url, download: filename }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Xuất Excel cho cơ quan quản lý: xuất cả phạm vi đang xem hoặc chỉ những trường tự chọn, và tuỳ chọn
 * MỖI TRƯỜNG MỘT TRANG TÍNH (trang đầu là tổng hợp). Tài khoản của một trường không cần hộp này — nút
 * Xuất tải thẳng.
 */
export function EquipmentExportDialog({ open, onOpenChange, params, filename, run: runWith, perSchoolOption = true }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Bộ lọc đang xem của bảng (chế độ, cây lọc, ô tìm). */
  params: Record<string, string>;
  filename: string;
  /** Cách xuất riêng (dạng Từng thiết bị): danh sách trường đã chọn (null = mọi trường đang xem), mỗi trường một trang. */
  run?: (schoolIds: number[] | null, perSchool: boolean) => Promise<void>;
  /** Có ô "Mỗi trường một trang tính" không (bảng Từng thiết bị ghi dạng luồng một trang, xếp theo trường). */
  perSchoolOption?: boolean;
}) {
  const { open: notify } = useNotification();
  const [scope, setScope] = useState<"view" | "pick">("view");
  const [picked, setPicked] = useState<School[]>([]);
  const [perSchool, setPerSchool] = useState(true);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      if (runWith) {
        await runWith(scope === "pick" ? picked.map((s) => s.id) : null, perSchool);
      } else {
        // "Mọi trường" là mọi trường thật (trưởng nhóm 24/11/2026), không giữ ô lọc trường của bảng.
        const next: Record<string, string> = { ...params, perSchool: String(perSchool) };
        delete next["school.id"];
        delete next.schoolBody;
        if (scope === "pick") next.schools = picked.map((s) => s.id).join(",");
        await downloadSummary(next, filename);
      }
      onOpenChange(false);
    } catch (error) {
      notify?.({ type: "error", message: await errorMessage(error), description: "Không xuất được Excel" });
    } finally {
      setBusy(false);
    }
  };

  const option = (value: "view" | "pick", label: string) => (
    <button type="button" role="radio" aria-checked={scope === value} onClick={() => setScope(value)}
      className={cn("h-8 flex-1 rounded-md px-3 text-sm font-medium transition-colors",
        scope === value ? "bg-primary text-primary-foreground shadow-e1" : "text-muted-foreground hover:text-foreground")}>
      {label}
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Xuất Excel</DialogTitle>
          <DialogDescription>Theo bộ lọc đang xem của bảng (loại, môn, ô tìm).</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div role="radiogroup" aria-label="Trường được xuất" className="bg-muted/60 flex gap-0.5 rounded-lg border p-0.5">
            {option("view", "Mọi trường")}
            {option("pick", "Chọn trường")}
          </div>

          {/* Khối giữa CAO CỐ ĐỊNH: đổi giữa hai lựa chọn thì hộp không co giãn, nút không nhảy chỗ. */}
          <div className="h-36">
          {scope === "pick" ? (
            <div className="space-y-2">
              <AsyncCombobox<School>
                resource="schools"
                value={null}
                onChange={() => {}}
                onPick={(s) => setPicked((prev) => (prev.some((x) => x.id === s.id) ? prev : [...prev, s]))}
                labelOf={(x) => x.name}
                placeholder="Thêm trường…"
                searchPlaceholder="Tìm trường…"
                clearable={false}
              />
              {picked.length ? (
                <ul className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
                  {picked.map((s) => (
                    <li key={s.id} className="bg-muted flex items-center gap-1 rounded-full py-0.5 ps-2.5 pe-1 text-sm">
                      {s.name}
                      <button type="button" aria-label={`Bỏ ${s.name}`} onClick={() => setPicked((prev) => prev.filter((x) => x.id !== s.id))}
                        className="text-muted-foreground hover:text-foreground rounded-full p-0.5">
                        <X className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-sm">Chưa chọn trường nào.</p>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground bg-muted/40 rounded-lg border border-dashed px-3 py-3 text-sm">
              Xuất mọi trường, theo bộ lọc loại, môn, ô tìm của bảng.
            </p>
          )}
          </div>

          {perSchoolOption ? (
          <div className="flex items-start gap-2">
            <Checkbox id="per-school" checked={perSchool} onCheckedChange={(c) => setPerSchool(c === true)} className="mt-0.5" />
            <Label htmlFor="per-school" className="flex-col items-start gap-0.5 font-normal">
              <span className="font-medium">Mỗi trường một trang tính</span>
              <span className="text-muted-foreground text-xs">Trang đầu là tổng hợp; chỉ trường có thiết bị mới có trang riêng.</span>
            </Label>
          </div>
          ) : (
            <p className="text-muted-foreground text-xs">Một trang tính, các dòng xếp theo trường. Máy chủ ghi tệp theo từng khúc nên xuất được cả nghìn dòng.</p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Huỷ</Button>
          <Button type="button" disabled={busy || (scope === "pick" && picked.length === 0)} onClick={() => void run()}>
            {busy ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
            Xuất Excel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
