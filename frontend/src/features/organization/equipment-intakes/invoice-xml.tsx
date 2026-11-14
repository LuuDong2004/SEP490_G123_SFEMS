import { useNotification } from "@refinedev/core";
import { FileCode2, Loader2 } from "lucide-react";
import { useRef, useState } from "react";

import type { PickedCatalog } from "@/domains/equipment-catalog/types";
import { kyInstance } from "@/shared/api/data";
import { formatPlainDate } from "@/shared/lib/format";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

const money = new Intl.NumberFormat("vi-VN");
const SKIP = "__skip__";

type Item = { name: string; unit: string; quantity: number; unitPrice: number };
type Parsed = { supplier: string; taxCode: string; contact: string; documentNo: string; documentDate: string | null; items: Item[] };
type Row = Item & { candidates: PickedCatalog[]; pick: string };

/** Kết quả đọc hoá đơn: chứng từ + các dòng đã ghép với danh mục. */
export type InvoiceImport = {
  supplier: string;
  taxCode: string;
  contact: string;
  documentNo: string;
  documentDate: string | null;
  file: File;
  rows: { catalog: PickedCatalog; quantity: number; unitPrice: number }[];
};

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/gi, "d").toLowerCase();
const words = (s: string) => fold(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 2);

/**
 * Hoá đơn điện tử (tệp XML nhà cung cấp gửi kèm): người bán (tên, mã số thuế), số, ngày lập và các dòng hàng hoá. Đọc
 * theo tên thẻ, không phụ thuộc không gian tên — các nhà cung cấp hoá đơn điện tử dùng cùng bộ thẻ.
 */
function parseInvoice(text: string): Parsed {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("Tệp không phải XML hợp lệ");
  const tag = (el: Element | Document | undefined, name: string) => el?.getElementsByTagName(name)[0]?.textContent?.trim() ?? "";
  const seller = doc.getElementsByTagName("NBan")[0];
  const items = [...doc.getElementsByTagName("HHDVu")].map((h) => ({
    name: tag(h, "THHDVu"),
    unit: tag(h, "DVTinh"),
    quantity: Math.round(Number(tag(h, "SLuong").replace(",", ".")) || 0),
    unitPrice: Math.round(Number(tag(h, "DGia").replace(",", ".")) || 0),
  })).filter((i) => i.name);
  if (!seller || !items.length) throw new Error("Không thấy người bán hoặc dòng hàng trong tệp — có đúng là hoá đơn điện tử?");
  const date = tag(doc, "NLap").slice(0, 10);
  return { supplier: tag(seller, "Ten"), taxCode: tag(seller, "MST"), contact: tag(seller, "SDThoai") || tag(seller, "DCTDTu"), documentNo: tag(doc, "SHDon"), documentDate: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null, items };
}

/** Thiết bị trong danh mục khớp tên một dòng hoá đơn: tìm theo cả tên, không có thì theo 3 rồi 2 từ đầu; xếp theo số từ trùng. */
async function candidatesFor(name: string): Promise<PickedCatalog[]> {
  const ws = words(name);
  const tries = [name, ws.slice(0, 3).join(" "), ws.slice(0, 2).join(" ")].filter((q, i, a) => q && a.indexOf(q) === i);
  for (const q of tries) {
    try {
      const found = await kyInstance.get("equipment_catalogs", { searchParams: { q, active: "true", _start: "0", _end: "8" } }).json<PickedCatalog[]>();
      if (Array.isArray(found) && found.length) {
        const mine = new Set(ws);
        const score = (c: PickedCatalog) => {
          const cw = words(String(c.name ?? ""));
          return cw.length ? cw.filter((w) => mine.has(w)).length / cw.length : 0;
        };
        return [...found].sort((a, b) => score(b) - score(a));
      }
    } catch {
      // thử cách tìm kế tiếp
    }
  }
  return [];
}

/**
 * Nút "Đọc hoá đơn điện tử" (bản mẫu 14/11/2026): chọn tệp XML → hộp ghép từng dòng hàng với thiết bị trong danh mục
 * (tự gợi ý, sửa được, bỏ qua được — phí vận chuyển, hàng không phải thiết bị) → tạo một hoá đơn đã điền nhà cung cấp,
 * mã số thuế, số, ngày, kèm chính tệp XML làm tệp hoá đơn.
 */
export function InvoiceXmlButton({ onImport }: { onImport: (r: InvoiceImport) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const { open: notify } = useNotification();
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<{ parsed: Parsed; rows: Row[]; file: File } | null>(null);

  const read = async (file: File) => {
    setBusy(true);
    try {
      const parsed = parseInvoice(await file.text());
      const rows: Row[] = [];
      for (const item of parsed.items) {
        const candidates = await candidatesFor(item.name);
        const best = candidates[0];
        const good = best && words(String(best.name ?? "")).some((w) => words(item.name).includes(w));
        rows.push({ ...item, candidates, pick: good ? String(best.id) : SKIP });
      }
      setState({ parsed, rows, file });
    } catch (error) {
      notify?.({ type: "error", message: "Không đọc được hoá đơn", description: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  };

  const picked = state?.rows.filter((r) => r.pick !== SKIP) ?? [];
  const finish = () => {
    if (!state) return;
    onImport({
      supplier: state.parsed.supplier, taxCode: state.parsed.taxCode, contact: state.parsed.contact, documentNo: state.parsed.documentNo,
      documentDate: state.parsed.documentDate, file: state.file,
      rows: picked.map((r) => ({ catalog: r.candidates.find((c) => String(c.id) === r.pick)!, quantity: Math.max(r.quantity, 1), unitPrice: r.unitPrice })),
    });
    setState(null);
  };

  return (
    <>
      <input ref={input} type="file" accept=".xml,text/xml,application/xml" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void read(f); }} />
      <Button type="button" variant="outline" className="h-9" disabled={busy} onClick={() => input.current?.click()}
        title="Chọn tệp XML hoá đơn điện tử: tự điền nhà cung cấp, số, ngày và danh sách thiết bị">
        {busy ? <Loader2 className="animate-spin" /> : <FileCode2 />}
        Đọc hoá đơn điện tử
      </Button>
      <Dialog open={state != null} onOpenChange={(o) => { if (!o) setState(null); }}>
        <DialogContent size="wide">
          <DialogHeader>
            <DialogTitle>Ghép hàng trên hoá đơn với danh mục</DialogTitle>
            <DialogDescription>
              {state ? [state.parsed.supplier, state.parsed.taxCode ? `MST ${state.parsed.taxCode}` : null, state.parsed.documentNo ? `Số ${state.parsed.documentNo}` : null,
                state.parsed.documentDate ? formatPlainDate(state.parsed.documentDate) : null].filter(Boolean).join(" · ") : null}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 overflow-auto rounded-lg border">
            <Table className="min-w-[48rem]">
              <TableHeader className="bg-surface-subtle">
                <TableRow>
                  <TableHead>Dòng trên hoá đơn</TableHead>
                  <TableHead className="text-right">SL</TableHead>
                  <TableHead>ĐVT</TableHead>
                  <TableHead className="text-right">Đơn giá</TableHead>
                  <TableHead className="w-[38%]">Thiết bị trong danh mục</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state?.rows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="whitespace-normal">{r.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{money.format(r.quantity)}</TableCell>
                    <TableCell>{r.unit}</TableCell>
                    <TableCell className="text-right tabular-nums">{money.format(r.unitPrice)}</TableCell>
                    <TableCell>
                      <Select value={r.pick} onValueChange={(v) => setState((s) => s && ({ ...s, rows: s.rows.map((x, j) => (j === i ? { ...x, pick: v } : x)) }))}>
                        <SelectTrigger className="h-9 w-full" aria-label={`Ghép ${r.name}`}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={SKIP}>Bỏ qua dòng này</SelectItem>
                          {r.candidates.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.code} · {c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {!r.candidates.length ? <p className="text-warning-text mt-1 text-xs">Không thấy trong danh mục — thêm tay sau bằng "Chọn thiết bị trong danh mục"</p> : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setState(null)}>Đóng</Button>
            <Button type="button" disabled={!picked.length} onClick={finish}>Tạo hoá đơn với {picked.length} thiết bị</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
