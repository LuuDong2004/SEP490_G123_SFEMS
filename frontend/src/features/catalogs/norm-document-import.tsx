import { useInvalidate, useNotification } from "@refinedev/core";
import { FileUp, Loader2 } from "lucide-react";
import { useImperativeHandle, useMemo, useRef, useState, type Ref } from "react";

import { kyInstance } from "@/shared/api/data";
import { DetailTable, type DetailColumn, type DetailFilter } from "@/shared/components/data-table/detail-table";
import { errorMessage } from "@/shared/lib/api-error";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

/** Một môn của văn bản so với bộ — `POST /equipment_norms/import-document`. */
type SubjectResult = {
  heading: string | null;
  subjectId: number | null;
  subjectName: string | null;
  perRoom: boolean;
  perRoomSource: string | null;
  rows: number;
  perRoomRows: number;
  noQuantity: number;
  added: number;
  changed: number;
  unchanged: number;
  removed: number;
};
type Change = { kind: "ADDED" | "CHANGED" | "REMOVED"; subjectName: string; name: string; topic: string | null; before: string | null; after: string | null };
type ImportResult = { dryRun: boolean; level: string; rows: number; subjects: SubjectResult[]; changes: Change[]; created: number; deleted: number };

const KIND_LABEL: Record<Change["kind"], string> = { CHANGED: "Đổi", ADDED: "Mới", REMOVED: "Bỏ" };
const COLUMNS: DetailColumn[] = [
  { key: "kind", label: "Loại" },
  { key: "subjectName", label: "Môn" },
  { key: "name", label: "Thiết bị" },
  { key: "topic", label: "Chủ đề" },
  { key: "before", label: "Bộ hiện tại" },
  { key: "after", label: "Văn bản" },
];

/**
 * Đọc phụ lục thông tư từ tệp Word (.docx) vào bộ đang xem. Bước 1 đọc thử (`dryRun`): hiện từng môn văn bản có,
 * môn đó có "tính cho 01 phòng học bộ môn" không, và so với bộ — Mới / Đổi / Không đổi / Bỏ. Bước 2 (chỉ bộ NHÁP)
 * thay các môn có trong văn bản bằng dòng vừa đọc; môn khác giữ nguyên.
 */
/** Mở chọn tệp từ nơi khác (mục trong menu thao tác) — khi đó không vẽ nút riêng. */
export type NormDocumentImportHandle = { pick: () => void };

export function NormDocumentImport({ standardId, editable, handle, onBusy, onImported }: {
  standardId: number;
  editable: boolean;
  handle?: Ref<NormDocumentImportHandle>;
  onBusy?: (busy: boolean) => void;
  onImported?: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState<"read" | "import" | null>(null);
  const invalidate = useInvalidate();
  const { open: notify } = useNotification();
  useImperativeHandle(handle, () => ({ pick: () => input.current?.click() }), []);

  const send = async (f: File, dryRun: boolean) => {
    const form = new FormData();
    form.append("file", f);
    form.append("standardId", String(standardId));
    form.append("dryRun", String(dryRun));
    return kyInstance.post("equipment_norms/import-document", { body: form, timeout: 180_000 }).json<ImportResult>();
  };

  const read = async (f: File) => {
    setBusy("read");
    onBusy?.(true);
    try {
      setFile(f);
      setPreview(await send(f, true));
    } catch (error) {
      notify?.({ type: "error", message: await errorMessage(error), description: "Không đọc được văn bản" });
    } finally {
      setBusy(null);
      onBusy?.(false);
      if (input.current) input.current.value = "";
    }
  };

  const apply = async () => {
    if (!file) return;
    setBusy("import");
    try {
      const res = await send(file, false);
      notify?.({ type: "success", message: `Đã nhập ${res.created} dòng vào bản nháp, thay ${res.deleted} dòng cũ.` });
      invalidate({ resource: "equipment_norms", invalidates: ["list"] });
      onImported?.();
      setPreview(null);
    } catch (error) {
      notify?.({ type: "error", message: await errorMessage(error), description: "Chưa nhập dòng nào" });
    } finally {
      setBusy(null);
    }
  };

  const unknown = preview?.subjects.filter((s) => s.subjectId == null) ?? [];
  const known = preview?.subjects.filter((s) => s.subjectId != null) ?? [];
  const filters = useMemo<DetailFilter<Change>[]>(
    () => [{ key: "kind", label: "loại", values: (r) => [r.kind], options: (["CHANGED", "ADDED", "REMOVED"] as const).map((k) => ({ key: k, label: KIND_LABEL[k] })) }],
    [],
  );

  return (
    <>
      <input ref={input} type="file" accept=".docx" className="hidden" aria-hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void read(f); }} />
      {handle ? null : (
        <Button type="button" variant="outline" size="sm" disabled={busy === "read"} onClick={() => input.current?.click()}>
          {busy === "read" ? <Loader2 className="animate-spin" /> : <FileUp />}
          Đọc văn bản (.docx)
        </Button>
      )}

      <Dialog open={!!preview} onOpenChange={(o) => { if (!o && busy !== "import") setPreview(null); }}>
        <DialogContent size="wide">
          <DialogHeader>
            <DialogTitle>Đọc văn bản · <span className="font-normal text-muted-foreground">{file?.name}</span></DialogTitle>
          </DialogHeader>

          {preview ? (
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pe-1">
              {/* Cuộn cả thân hộp: bảng tóm tắt nhiều môn (cả cấp) cao quá thì bảng thay đổi không bị ép đè lên chân hộp. */}
              <div className="bg-card shrink-0 overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader className="bg-muted">
                    <TableRow>
                      <TableHead>Môn</TableHead>
                      <TableHead>Tính cho 01 phòng bộ môn</TableHead>
                      <TableHead className="text-right">Dòng</TableHead>
                      <TableHead className="text-right">Đổi</TableHead>
                      <TableHead className="text-right">Mới</TableHead>
                      <TableHead className="text-right">Bỏ</TableHead>
                      <TableHead className="text-right">Không đổi</TableHead>
                      <TableHead className="text-right">Chưa có số lượng</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {known.map((s) => (
                      <TableRow key={s.subjectId}>
                        <TableCell className="font-medium">{s.subjectName}</TableCell>
                        <TableCell title={s.perRoomSource ?? undefined}>
                          {s.perRoom ? <Badge variant="info">Có · {s.perRoomRows} dòng</Badge> : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{s.rows}</TableCell>
                        <TableCell className={cn("text-right tabular-nums", s.changed && "font-semibold text-warning-text")}>{s.changed || "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{s.added || "—"}</TableCell>
                        <TableCell className={cn("text-right tabular-nums", s.removed && "font-semibold text-destructive-text")}>{s.removed || "—"}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{s.unchanged || "—"}</TableCell>
                        <TableCell className={cn("text-right tabular-nums", s.noQuantity && "text-destructive-text")}>{s.noQuantity || "—"}</TableCell>
                      </TableRow>
                    ))}
                    {unknown.map((s, i) => (
                      <TableRow key={`u${i}`}>
                        <TableCell colSpan={8} className="text-destructive-text">Không nhận ra môn của bảng "{s.heading}" ({s.rows} dòng)</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {preview.changes.length ? (
                <div className="flex h-[28rem] shrink-0 flex-col">
                <DetailTable columns={COLUMNS} rows={preview.changes} filters={filters} compact searchPlaceholder="Tìm thiết bị…"
                  context={known.length === 1 && known[0].subjectName ? [known[0].subjectName] : undefined}
                  text={(r, c) => (c.key === "kind" ? KIND_LABEL[r.kind] : String(r[c.key as keyof Change] ?? ""))} />
                </div>
              ) : null}
            </div>
          ) : null}

          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline" disabled={busy === "import"}>Đóng</Button></DialogClose>
            <Button type="button" disabled={!editable || unknown.length > 0 || busy === "import"} onClick={apply}
              title={!editable ? "Chỉ nhập vào bản nháp — Lập bộ mới trước" : unknown.length ? "Có bảng chưa nhận ra môn" : undefined}>
              {busy === "import" ? <Loader2 className="animate-spin" /> : null}
              Thay {known.length} môn trong bản nháp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
