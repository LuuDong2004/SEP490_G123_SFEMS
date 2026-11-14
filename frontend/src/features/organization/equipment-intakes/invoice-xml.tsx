import { useNotification } from "@refinedev/core";
import { useState, type ReactNode } from "react";

import type { PickedCatalog } from "@/domains/equipment-catalog/types";
import { kyInstance } from "@/shared/api/data";
import { formatPlainDate } from "@/shared/lib/format";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

const money = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 });
const SKIP = "__skip__";

type Item = { name: string; unit: string; quantity: number; unitPrice: number };
type Parsed = { supplier: string; taxCode: string; contact: string; documentNo: string; documentDate: string | null; items: Item[] };
/** `base`: số lượng theo đơn vị của danh mục, khi đơn vị trên hoá đơn khác (2 lọ → 200 g) — người dùng gõ. */
type Row = Item & { candidates: PickedCatalog[]; pick: string; base: string };

/** Kết quả đọc hoá đơn: chứng từ + các dòng đã ghép với danh mục. Tệp XML đã nằm trong ô Tệp hoá đơn — không gửi lại. */
export type InvoiceImport = {
  supplier: string;
  taxCode: string;
  contact: string;
  documentNo: string;
  documentDate: string | null;
  rows: { catalog: PickedCatalog; quantity: number; unitPrice: number }[];
};

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/gi, "d").toLowerCase();
const words = (s: string) => fold(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 2);
const num = (s: string) => Number(s.replace(/\s/g, "").replace(",", ".")) || 0;
/** Số lượng trên hoá đơn giữ phần lẻ (2,5 kg hoá chất), tối đa 3 chữ số sau dấu phẩy như ô số lượng của lô. */
const qty3 = (n: number) => Math.round(n * 1000) / 1000;

/** Tệp có phải XML (hoá đơn điện tử) — theo đuôi hoặc kiểu tệp. */
export const isXmlFile = (f: File) => /\.xml$/i.test(f.name) || /xml/i.test(f.type);

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
    quantity: qty3(num(tag(h, "SLuong"))),
    unitPrice: Math.round(num(tag(h, "DGia"))),
  })).filter((i) => i.name);
  if (!seller || !items.length) throw new Error("Không thấy người bán hoặc dòng hàng trong tệp — có đúng là hoá đơn điện tử?");
  const date = tag(doc, "NLap").slice(0, 10);
  return { supplier: tag(seller, "Ten"), taxCode: tag(seller, "MST"), contact: tag(seller, "SDThoai") || tag(seller, "DCTDTu"), documentNo: tag(doc, "SHDon"), documentDate: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null, items };
}

/**
 * Thiết bị trong danh mục khớp tên một dòng hoá đơn. Trước hết so THEO TỪ ở máy chủ (`school-items/name-check` — cùng luật
 * kiểm trùng tên: bỏ dấu, dấu câu, không kể thứ tự; "Al (Bột) lọ 100g" ra "Al (Bột)"); không ra thì tìm theo cả tên, rồi 3
 * và 2 từ đầu, xếp theo số từ trùng.
 */
async function candidatesFor(name: string): Promise<PickedCatalog[]> {
  try {
    const res = await kyInstance.get("equipment_catalogs/school-items/name-check", { searchParams: { name } })
      .json<{ same: PickedCatalog | null; similar: PickedCatalog[] }>();
    const found = [res.same, ...(res.similar ?? [])].filter((c): c is PickedCatalog => !!c);
    if (found.length) return found;
  } catch {
    // máy chủ chưa có lối so theo từ — tìm như cũ
  }
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
 * Hàng theo lô mà đơn vị trên hoá đơn khác đơn vị của danh mục ("Lọ" với "g"): lọ, chai chỉ là đồ đựng, phiếu ghi theo
 * đơn vị của danh mục — hỏi "2 Lọ = bao nhiêu g", không đoán. Thiết bị từng cái thì đơn vị nào cũng là đếm cái.
 */
function needsBase(r: Row): PickedCatalog | null {
  const c = r.candidates.find((x) => String(x.id) === r.pick);
  if (!c || c.trackingType !== "bulk") return null;
  const unit = String(c.unit?.name ?? "");
  return unit && fold(unit).trim() !== fold(r.unit).trim() ? c : null;
}

/**
 * Đọc tệp XML hoá đơn điện tử vừa chọn ở ô "Tệp hoá đơn" (bản mẫu 15/11/2026 — bỏ nút "Đọc hoá đơn điện tử" riêng: đằng
 * nào cũng phải đính tệp hoá đơn, chọn một lần làm luôn hai việc). Mở hộp ghép từng dòng hàng với thiết bị trong danh mục
 * (tự gợi ý, sửa được, bỏ qua được — phí vận chuyển, hàng không phải thiết bị); hàng theo lô khác đơn vị thì hỏi số lượng
 * theo đơn vị của danh mục. Xong thì `onImport` điền hoá đơn đã chọn tệp.
 *
 * Trả `read(file, docKey)` để gọi khi có tệp và `dialog` để vẽ một lần trong khối thiết bị.
 */
export function useInvoiceReader(onImport: (r: InvoiceImport, docKey: string) => void): { read: (file: File, docKey: string) => void; dialog: ReactNode } {
  const { open: notify } = useNotification();
  const [state, setState] = useState<{ parsed: Parsed; rows: Row[]; docKey: string } | null>(null);

  const read = async (file: File, docKey: string) => {
    try {
      const parsed = parseInvoice(await file.text());
      const rows: Row[] = [];
      for (const item of parsed.items) {
        const candidates = await candidatesFor(item.name);
        const best = candidates[0];
        const good = best && words(String(best.name ?? "")).some((w) => words(item.name).includes(w));
        rows.push({ ...item, candidates, pick: good ? String(best.id) : SKIP, base: "" });
      }
      setState({ parsed, rows, docKey });
    } catch (error) {
      notify?.({ type: "error", message: "Không đọc được hoá đơn điện tử", description: error instanceof Error ? error.message : String(error) });
    }
  };

  const update = (i: number, patch: Partial<Row>) => setState((s) => s && ({ ...s, rows: s.rows.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  const picked = state?.rows.filter((r) => r.pick !== SKIP) ?? [];
  const missingBase = picked.some((r) => needsBase(r) && !(num(r.base) > 0));
  const finish = () => {
    if (!state || missingBase) return;
    onImport({
      supplier: state.parsed.supplier, taxCode: state.parsed.taxCode, contact: state.parsed.contact, documentNo: state.parsed.documentNo,
      documentDate: state.parsed.documentDate,
      rows: picked.map((r) => {
        const catalog = r.candidates.find((c) => String(c.id) === r.pick)!;
        if (needsBase(r)) {
          // Đổi sang đơn vị của danh mục: thành tiền giữ nguyên, đơn giá chia lại theo số lượng mới (làm tròn đồng).
          const base = qty3(num(r.base));
          return { catalog, quantity: base, unitPrice: Math.round((r.quantity * r.unitPrice) / base) };
        }
        const bulk = catalog.trackingType === "bulk";
        return { catalog, quantity: bulk ? r.quantity : Math.max(Math.round(r.quantity), 1), unitPrice: r.unitPrice };
      }),
    }, state.docKey);
    setState(null);
  };

  const dialog = (
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
              {state?.rows.map((r, i) => {
                const conv = needsBase(r);
                return (
                  <TableRow key={i}>
                    <TableCell className="align-top whitespace-normal">{r.name}</TableCell>
                    <TableCell className="text-right align-top tabular-nums">{money.format(r.quantity)}</TableCell>
                    <TableCell className="align-top">{r.unit}</TableCell>
                    <TableCell className="text-right align-top tabular-nums">{money.format(r.unitPrice)}</TableCell>
                    <TableCell className="space-y-2 align-top">
                      <Select value={r.pick} onValueChange={(v) => update(i, { pick: v, base: "" })}>
                        <SelectTrigger className="h-9 w-full" aria-label={`Ghép ${r.name}`}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={SKIP}>Bỏ qua dòng này</SelectItem>
                          {r.candidates.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.code} · {c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {conv ? (
                        <label className="text-warning-text flex items-center gap-2 text-xs">
                          <span className="whitespace-nowrap">{money.format(r.quantity)} {r.unit} =</span>
                          <Input type="number" min="0.001" step="any" value={r.base} onChange={(e) => update(i, { base: e.target.value })}
                            aria-label={`Số lượng theo ${conv.unit?.name}`} aria-invalid={!(num(r.base) > 0) || undefined} className="h-8 w-24" />
                          <span>{conv.unit?.name}</span>
                        </label>
                      ) : null}
                      {!r.candidates.length ? <p className="text-warning-text text-xs">Không thấy trong danh mục — thêm sau bằng nút "Thêm thiết bị"</p> : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setState(null)}>Huỷ</Button>
          <Button type="button" disabled={!picked.length || missingBase} onClick={finish}>Điền vào hoá đơn · {picked.length} thiết bị</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { read: (file, docKey) => void read(file, docKey), dialog };
}
