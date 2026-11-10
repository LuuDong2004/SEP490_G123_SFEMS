import { useList, useNavigation, useNotification } from "@refinedev/core";
import { ArrowLeft, FileSearch, Loader2, Search, ArrowUpDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { kyInstance } from "@/shared/api/data";
import { IconFilter } from "@/shared/components/data-table/icon-filter";
import { errorMessage } from "@/shared/lib/api-error";
import { formatPlainDate } from "@/shared/lib/format";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import type { EquipmentIntake } from "@/domains/equipment-intake/types";
import type { PurchaseProposal } from "@/domains/procurement/types";
import { LIFT_ROW } from "@/shared/lib/row-lift";
import { cn } from "@/shared/lib/utils";

const money = new Intl.NumberFormat("vi-VN");
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").toLowerCase();

/** Nguồn hình thành nào thì phiếu ghi tăng đi từ một phiếu nghiệp vụ khác (mã của `OriginRule`). */
export type SourceKind = "MUA_SAM" | "KIEM_KE_THUA";
// eslint-disable-next-line react-refresh/only-export-components
export const isSourceKind = (code: string | undefined | null): code is SourceKind => code === "MUA_SAM" || code === "KIEM_KE_THUA";

const TEXT: Record<SourceKind, { title: string; description: string; empty: string; button: string; code: string; info: string; search: string }> = {
  MUA_SAM: {
    title: "Chọn kế hoạch mua sắm",
    description: "Các kế hoạch đã duyệt mà trường còn thiết bị chưa nhập. Chọn kế hoạch rồi chọn thiết bị nhập đợt này.",
    empty: "Không có kế hoạch mua sắm đã duyệt nào còn thiết bị chưa nhập.",
    button: "Chọn kế hoạch mua sắm",
    code: "Đề xuất của trường",
    info: "Kế hoạch mua sắm",
    search: "Tìm kế hoạch, cơ quan, số đề xuất…",
  },
  KIEM_KE_THUA: {
    title: "Chọn biên bản kiểm kê",
    description: "Biên bản kiểm kê được duyệt mà có tài sản thừa thì hệ thống đã lập sẵn một phiếu ghi tăng nháp. Chọn biên bản để mở phiếu đó.",
    empty: "Không có phiếu ghi tăng nháp nào lập từ biên bản kiểm kê. Phiếu chỉ được lập khi biên bản có tài sản thừa và đã được duyệt.",
    button: "Chọn biên bản kiểm kê",
    code: "Số biên bản",
    info: "Ghi chú",
    search: "Tìm số biên bản, ghi chú…",
  },
};

/** Một dòng của hộp chọn — đề xuất mua sắm và biên bản kiểm kê về cùng một hình để chung bảng, chung tìm và xếp. */
type Row = {
  key: string;
  code: string;
  date: string | null;
  info: string;
  lines: number;
  /** Giá trị của phiếu nguồn; biên bản kiểm kê không có. */
  amount: number | null;
  /** Cơ quan lập kế hoạch và năm ngân sách — chỉ với mua sắm. */
  body?: string;
  year?: number | null;
  /** Phiếu ghi tăng nháp đã lập từ phiếu nguồn này — chọn là mở tiếp nó, không lập phiếu thứ hai. */
  draftId: number | null;
  proposal?: PurchaseProposal;
};

/** Một dòng của đề xuất khi nhập hàng (`GET /purchase_proposals/{id}/intake-lines`). */
type IntakeLine = {
  lineId: number;
  catalogId: number;
  catalogCode: string | null;
  name: string;
  unitName: string | null;
  planned: number;
  received: number;
  remaining: number;
  unitPrice: number | null;
};

/**
 * Bước hai khi lập phiếu ghi tăng từ kế hoạch (QLTB-556): hàng về nhiều đợt, nên chọn THIẾT BỊ và SỐ LƯỢNG nhập đợt
 * này. Mặc định chọn mọi dòng còn thiếu với đủ số còn lại; phần không nhập đợt này vẫn lập phiếu ghi tăng sau được.
 */
function ProposalLinesStep({ row, busy, onBack, onConfirm }: {
  row: Row;
  busy: boolean;
  onBack: () => void;
  onConfirm: (picks: { lineId: number; quantity: number }[]) => void;
}) {
  const [lines, setLines] = useState<IntakeLine[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Record<number, number>>({});
  useEffect(() => {
    let alive = true;
    kyInstance.get(`purchase_proposals/${row.proposal!.id}/intake-lines`).json<IntakeLine[]>()
      .then((data) => {
        if (!alive) return;
        setLines(data);
        setPicked(Object.fromEntries(data.filter((l) => l.remaining > 0).map((l) => [l.lineId, l.remaining])));
      })
      .catch(async (e) => alive && setError(await errorMessage(e)));
    return () => { alive = false; };
  }, [row]);
  const open = (lines ?? []).filter((l) => l.remaining > 0);
  const chosen = Object.entries(picked).filter(([, q]) => q > 0).map(([id, q]) => ({ lineId: Number(id), quantity: q }));
  const total = chosen.reduce((sum, c) => {
    const l = lines?.find((x) => x.lineId === c.lineId);
    return sum + (l?.unitPrice ?? 0) * c.quantity;
  }, 0);
  const allOn = open.length > 0 && open.every((l) => (picked[l.lineId] ?? 0) > 0);
  return (
    <>
      <div className="min-h-0 flex-1 overflow-auto rounded-md border [&>[data-slot=table-container]]:overflow-visible [&_tbody_tr:last-child]:border-b">
        <Table className="table-fixed">
          <colgroup>
            <col className="w-10" />
            <col />
            <col className="w-24" />
            <col className="w-24" />
            <col className="w-32" />
          </colgroup>
          <TableHeader sticky>
            <TableRow>
              <TableHead className="px-3">
                <Checkbox aria-label="Chọn tất cả" checked={allOn} disabled={!open.length}
                  onCheckedChange={(v) => setPicked(v ? Object.fromEntries(open.map((l) => [l.lineId, l.remaining])) : {})} />
              </TableHead>
              <TableHead className="px-3">Thiết bị</TableHead>
              <TableHead className="px-3 text-end">Kế hoạch</TableHead>
              <TableHead className="px-3 text-end">Đã nhập</TableHead>
              <TableHead className="px-3 text-end">Nhập đợt này</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {error || !lines ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground px-4 py-6 text-center whitespace-normal">{error ?? "Đang tải…"}</TableCell>
              </TableRow>
            ) : lines.map((l) => {
              const done = l.remaining === 0;
              const qty = picked[l.lineId] ?? 0;
              return (
                <TableRow key={l.lineId} className={done ? "text-muted-foreground" : undefined}>
                  <TableCell className="px-3">
                    <Checkbox aria-label={l.name} checked={qty > 0} disabled={done}
                      onCheckedChange={(v) => setPicked((p) => ({ ...p, [l.lineId]: v ? l.remaining : 0 }))} />
                  </TableCell>
                  <TableCell className="px-3">
                    <div className="truncate font-medium" title={l.name}>{l.name}</div>
                    <div className="text-muted-foreground truncate font-mono text-xs">{l.catalogCode}</div>
                  </TableCell>
                  <TableCell className="px-3 text-end tabular-nums">{l.planned} {l.unitName ?? ""}</TableCell>
                  <TableCell className="px-3 text-end tabular-nums">{l.received}</TableCell>
                  <TableCell className="px-3 text-end">
                    {done ? "Đã nhập đủ" : (
                      <Input type="number" min={0} max={l.remaining} value={qty || ""} placeholder="0"
                        className="ms-auto h-8 w-24 text-end tabular-nums"
                        onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                        onChange={(e) => {
                          const n = Math.max(0, Math.min(l.remaining, Math.floor(Number(e.target.value) || 0)));
                          setPicked((p) => ({ ...p, [l.lineId]: n }));
                        }} />
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t pt-4">
        <Button type="button" variant="ghost" onClick={onBack} disabled={busy}><ArrowLeft />Chọn kế hoạch khác</Button>
        <span className="text-muted-foreground me-auto text-sm">
          <span className="text-foreground font-medium tabular-nums">{chosen.length}</span> thiết bị · {money.format(total)} đ
        </span>
        <Button type="button" disabled={busy || chosen.length === 0} onClick={() => onConfirm(chosen)}>
          {busy ? <Loader2 className="animate-spin" /> : null}
          Lập phiếu ghi tăng
        </Button>
      </div>
    </>
  );
}

const SORTS = [
  { value: "newest", label: "Mới nhất trước" },
  { value: "oldest", label: "Cũ nhất trước" },
  { value: "amount", label: "Giá trị cao trước" },
  { value: "code", label: "Theo số phiếu" },
  { value: "name", label: "Theo tên kế hoạch" },
] as const;
type Sort = (typeof SORTS)[number]["value"];

/**
 * Hộp chọn PHIẾU NGUỒN khi lập phiếu ghi tăng tay (QLTB-411). Nguồn hình thành "Mua sắm" đi từ một đề xuất
 * mua sắm, "Kiểm kê thừa" đi từ một biên bản kiểm kê — chọn nguồn mà không nối phiếu thì phiếu ghi tăng
 * không biết hàng này theo đề xuất nào, và đề xuất không bao giờ thấy mình đã nhập hàng.
 *
 * <p>Không tự dựng liên kết ở trình duyệt: mua sắm gọi đúng hành động có sẵn của đề xuất
 * (`POST /purchase_proposals/{id}/intake` kèm các dòng nhập đợt này — hàng về nhiều đợt thì một đề xuất nhiều phiếu
 * ghi tăng, máy chủ giữ số còn lại), kiểm kê thừa mở
 * phiếu nháp máy chủ đã lập lúc duyệt biên bản. Chọn xong là sang màn SỬA của phiếu nháp đó.
 */
export function IntakeSourcePicker({ kind, schoolId, open, onOpenChange }: {
  kind: SourceKind;
  schoolId: number | null | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { edit } = useNavigation();
  const { open: notify } = useNotification();
  const [busy, setBusy] = useState<string | null>(null);
  // Kế hoạch (đề xuất của trường) đã chọn — sang bước chọn thiết bị nhập đợt này.
  const [chosen, setChosen] = useState<Row | null>(null);
  useEffect(() => {
    if (!open) setChosen(null);
  }, [open]);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("newest");
  // Tài khoản của một trường không có ô Trường trên form (máy chủ tự điền) — khi đó phạm vi dòng đã lọc sẵn.
  const bySchool = schoolId ? [{ field: "school.id", operator: "eq" as const, value: schoolId }] : [];

  const proposals = useList<PurchaseProposal>({
    resource: "purchase_proposals",
    filters: [...bySchool, { field: "status", operator: "eq", value: "COMPLETED" }],
    pagination: { pageSize: 200 },
    queryOptions: { enabled: open && kind === "MUA_SAM" },
  });
  const drafts = useList<EquipmentIntake>({
    resource: "equipment_intakes",
    filters: [...bySchool, { field: "status", operator: "eq", value: "DRAFT" }],
    pagination: { pageSize: 200 },
    queryOptions: { enabled: open && kind === "KIEM_KE_THUA" },
  });
  // Kế hoạch là thứ người lập CHỌN (cơ quan nào ban hành, năm nào); đề xuất của trường trong kế hoạch là thứ
  // phiếu ghi tăng chép dòng từ đó. Trường chỉ đọc được kế hoạch đã duyệt có đề xuất của mình (115).
  const plans = useList<{ id: number; title: string; budgetYear: number | null; managingBody?: { name: string } | null }>({
    resource: "procurement_plans",
    pagination: { pageSize: 200 },
    queryOptions: { enabled: open && kind === "MUA_SAM", retry: false },
    errorNotification: false,
  });
  const loading = kind === "MUA_SAM" ? proposals.query?.isLoading : drafts.query?.isLoading;
  const text = TEXT[kind];

  const rows = useMemo<Row[]>(() => {
    const draftList = drafts.result?.data ?? [];
    if (kind === "KIEM_KE_THUA") {
      return draftList.filter((d) => d.source?.resource === "inventory_sessions").map((d) => ({
        key: `d${d.id}`, code: d.source?.code ?? "—", date: d.intakeDate, info: d.note ?? "", lines: d.lineCount, amount: null, draftId: d.id,
      }));
    }
    // Chỉ đề xuất còn thiết bị chưa nhập (còn hành động "intake"); đã nhập đủ — kể cả bằng phiếu còn nháp — thì
    // không hiện.
    const planOf = new Map((plans.result?.data ?? []).map((pl) => [pl.id, pl]));
    return (proposals.result?.data ?? [])
      .filter((p) => (p._actions as string[] | undefined)?.includes("intake"))
      .map((p) => ({
        key: `p${p.id}`, code: p.code ?? "—", date: p.proposalDate, info: p.plan?.title ?? "", lines: p.lineCount, amount: p.totalAmount ?? 0,
        body: p.plan ? planOf.get(p.plan.id)?.managingBody?.name : undefined, year: (p.plan ? planOf.get(p.plan.id)?.budgetYear : null) ?? p.budgetYear,
        draftId: null, proposal: p,
      }));
  }, [kind, drafts.result, proposals.result, plans.result]);

  const shown = useMemo(() => {
    const n = fold(q.trim());
    const list = n ? rows.filter((r) => fold(`${r.code} ${r.info} ${r.body ?? ""}`).includes(n)) : [...rows];
    const byDate = (a: Row, b: Row) => (a.date ?? "").localeCompare(b.date ?? "") || a.code.localeCompare(b.code);
    switch (sort) {
      case "oldest": return list.sort(byDate);
      case "amount": return list.sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));
      case "code": return list.sort((a, b) => a.code.localeCompare(b.code));
      case "name": return list.sort((a, b) => a.info.localeCompare(b.info, "vi") || byDate(b, a));
      default: return list.sort((a, b) => byDate(b, a));
    }
  }, [rows, q, sort]);

  // `replace`: form lập phiếu đang mở bị thay bằng phiếu nháp vừa có — không hỏi "thoát chưa lưu".
  const openDraft = (id: number) => {
    onOpenChange(false);
    edit("equipment_intakes", id, "replace");
  };

  async function pick(row: Row) {
    if (row.draftId != null) return openDraft(row.draftId);
    if (row.proposal) setChosen(row);
  }

  async function createFrom(row: Row, picks: { lineId: number; quantity: number }[]) {
    if (!row.proposal) return;
    setBusy(row.key);
    try {
      const res = await kyInstance.post(`purchase_proposals/${row.proposal.id}/intake`, { json: { lines: picks } }).json<{ intakeId: number }>();
      notify?.({ type: "success", message: `Đã lập phiếu ghi tăng nháp theo kế hoạch ${row.info || row.code}` });
      openDraft(res.intakeId);
    } catch (error) {
      notify?.({ type: "error", message: await errorMessage(error) });
    } finally {
      setBusy(null);
    }
  }

  const withAmount = kind === "MUA_SAM";
  const columns = withAmount ? 6 : 5;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Cùng khuôn với hộp chọn cán bộ: hàng tìm + xếp, bảng trong khung cao cố định, thanh chân. */}
      <DialogContent size="picker">
        <DialogHeader>
          <DialogTitle>{chosen ? `Chọn thiết bị nhập đợt này — ${chosen.info || chosen.code}` : text.title}</DialogTitle>
          <DialogDescription>
            {chosen
              ? "Bỏ chọn hoặc giảm số lượng với thiết bị chưa về. Phần còn lại lập phiếu ghi tăng ở đợt sau."
              : text.description}
          </DialogDescription>
        </DialogHeader>

        {chosen ? (
          <ProposalLinesStep row={chosen} busy={busy != null} onBack={() => setChosen(null)}
            onConfirm={(picks) => void createFrom(chosen, picks)} />
        ) : (<>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-80 max-w-full">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              // Hộp này mở TRONG form của màn: Enter ở ô tìm không được submit form bên ngoài.
              onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
              placeholder={text.search}
              className="rounded-full pl-8"
              aria-label="Tìm phiếu nguồn"
            />
          </div>
          <IconFilter icon={<ArrowUpDown />} label="thứ tự" value={sort} baseline={SORTS[0].value}
            onChange={(v) => v && setSort(v as Sort)}
            groups={[{ items: SORTS.filter((x) => withAmount || (x.value !== "amount" && x.value !== "name")).map((x) => ({ key: x.value, label: x.label })) }]} />
        </div>

        {/* `table-fixed` + độ rộng từng cột: bảng không tràn ngang hộp, chữ dài cắt ba chấm. */}
        <div className="min-h-0 flex-1 overflow-auto rounded-md border [&>[data-slot=table-container]]:overflow-visible [&_tbody_tr:last-child]:border-b">
          <Table className="table-fixed">
            {withAmount ? (
              <colgroup>
                <col />
                <col className="w-56" />
                <col className="w-20" />
                <col className="w-40" />
                <col className="w-32" />
                <col className="w-24" />
              </colgroup>
            ) : (
              <colgroup>
                <col className="w-40" />
                <col className="w-28" />
                <col />
                <col className="w-20" />
                <col className="w-24" />
              </colgroup>
            )}
            <TableHeader sticky>
              <TableRow>
                {withAmount ? (
                  <>
                    <TableHead className="px-4">{text.info}</TableHead>
                    <TableHead className="px-4">Cơ quan lập</TableHead>
                    <TableHead className="px-4">Năm</TableHead>
                    <TableHead className="px-4">{text.code}</TableHead>
                    <TableHead className="px-4 text-end">Giá trị (đ)</TableHead>
                  </>
                ) : (
                  <>
                    <TableHead className="px-4">{text.code}</TableHead>
                    <TableHead className="px-4">Ngày</TableHead>
                    <TableHead className="px-4">{text.info}</TableHead>
                    <TableHead className="px-4 text-end">Số dòng</TableHead>
                  </>
                )}
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading || shown.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns} className="text-muted-foreground px-4 py-6 text-center whitespace-normal">
                    {loading ? "Đang tải…" : q ? "Không có phiếu nào khớp." : text.empty}
                  </TableCell>
                </TableRow>
              ) : (
                shown.map((r) => (
                  <TableRow key={r.key} className={cn("group/row", LIFT_ROW, "h-12 cursor-pointer")} onClick={() => busy == null && void pick(r)}>
                    {withAmount ? (
                      <>
                        <TableCell className="truncate px-4 font-medium" title={r.info || undefined}>{r.info || "—"}</TableCell>
                        <TableCell className="text-muted-foreground truncate px-4" title={r.body}>{r.body ?? "—"}</TableCell>
                        <TableCell className="px-4 tabular-nums">{r.year ?? "—"}</TableCell>
                        <TableCell className="truncate px-4 font-mono text-xs">{r.code}</TableCell>
                        <TableCell className="px-4 text-end tabular-nums">{money.format(r.amount ?? 0)}</TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className="truncate px-4 font-mono text-xs">{r.code}</TableCell>
                        <TableCell className="px-4">{formatPlainDate(r.date)}</TableCell>
                        <TableCell className="truncate px-4" title={r.info || undefined}>{r.info || "—"}</TableCell>
                        <TableCell className="px-4 text-end tabular-nums">{r.lines}</TableCell>
                      </>
                    )}
                    <TableCell className="px-3 text-end">
                      {/* Một nút, một chữ cho mọi dòng: phiếu nháp đã có hay chưa là việc của cột "Phiếu ghi tăng". */}
                      <Button type="button" size="sm" variant="outline" disabled={busy != null}>
                        {busy === r.key ? <Loader2 className="animate-spin" /> : null}
                        Chọn
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Số dòng bên trái; nút dồn về tay phải. */}
        <div className="flex flex-wrap items-center gap-3 border-t pt-4">
          <span className="text-muted-foreground me-auto text-sm">
            <span className="text-foreground font-medium tabular-nums">{shown.length}</span> {withAmount ? "kế hoạch" : "phiếu"}
          </span>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Không theo phiếu nào
          </Button>
        </div>
        </>)}
      </DialogContent>
    </Dialog>
  );
}

/** Nút mở lại hộp chọn phiếu nguồn, đứng dưới ô Nguồn hình thành. */
export function IntakeSourceButton({ kind, onClick }: { kind: SourceKind; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-primary flex min-w-0 items-center gap-1.5 text-xs font-medium hover:underline">
      <FileSearch className="size-3.5 shrink-0" />
      <span className="truncate">{TEXT[kind].button}</span>
    </button>
  );
}
