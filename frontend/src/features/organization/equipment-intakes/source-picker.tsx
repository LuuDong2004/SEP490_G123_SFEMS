import { useNavigation, useNotification } from "@refinedev/core";
import { usePagedRows } from "@/shared/components/data-table/use-paged-rows";
import { useAllRows } from "@/shared/hooks/use-all-rows";
import { useNavigate } from "react-router";
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
import { TableEmpty } from "@/shared/components/data-table/table-empty";

const money = new Intl.NumberFormat("vi-VN");
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").toLowerCase();

/** Nguồn hình thành nào thì phiếu ghi tăng đi từ một phiếu nghiệp vụ khác (mã của `OriginRule`). */
export type SourceKind = "MUA_SAM" | "KIEM_KE_THUA";
// eslint-disable-next-line react-refresh/only-export-components
export const isSourceKind = (code: string | undefined | null): code is SourceKind => code === "MUA_SAM" || code === "KIEM_KE_THUA";

const TEXT: Record<SourceKind, { title: string; description: string; empty: string; emptyHint?: string; button: string; code: string; info: string; search: string }> = {
  MUA_SAM: {
    // Người lập chọn KẾ HOẠCH của Sở / UBND (trưởng nhóm 13/11/2026) — đề xuất của trường trong kế hoạch là thứ máy
    // chủ chép dòng từ đó, chỉ hiện như một cột phụ.
    title: "Chọn kế hoạch mua sắm",
    description: "Kế hoạch mua sắm của Sở đã duyệt, còn thiết bị của trường chưa nhập. Chọn kế hoạch rồi chọn thiết bị nhập đợt này.",
    // Màn trống một dòng ngắn (trưởng nhóm 13/11/2026).
    empty: "Chưa có kế hoạch mua sắm",
    button: "Chọn kế hoạch mua sắm",
    code: "Đề xuất của trường",
    info: "Kế hoạch mua sắm",
    search: "Tìm kế hoạch, cơ quan lập, số đề xuất…",
  },
  KIEM_KE_THUA: {
    // Cùng khuôn với kế hoạch mua sắm (trưởng nhóm 13/11/2026): chữ ngắn, đóng hộp là trả nguồn hình thành về.
    title: "Chọn biên bản kiểm kê",
    description: "Biên bản kiểm kê đã duyệt còn thiết bị thừa chưa ghi tăng.",
    empty: "Chưa có biên bản kiểm kê",
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
  /** Phần của `received` còn ở phiếu ghi tăng chưa hoàn tất — giữ chỗ (B13). */
  pending?: number;
  unitPrice: number | null;
};

/**
 * Bước hai khi lập phiếu ghi tăng từ kế hoạch: hàng về nhiều đợt, nên chọn THIẾT BỊ và SỐ LƯỢNG nhập đợt
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
  const allOn = open.length > 0 && open.every((l) => (picked[l.lineId] ?? 0) > 0);
  return (
    <>
      <div className="min-h-0 flex-1 overflow-auto rounded-md border [&>[data-slot=table-container]]:overflow-visible [&_tbody_tr:last-child]:border-b">
        <Table className="table-fixed">
          <colgroup>
            <col className="w-10" />
            <col className="w-36" />
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
              <TableHead className="px-3">Mã DM thiết bị</TableHead>
              <TableHead className="px-3">Thiết bị</TableHead>
              <TableHead className="px-3 text-end">Kế hoạch</TableHead>
              <TableHead className="px-3 text-end">Đã nhập</TableHead>
              <TableHead className="px-3 text-end">Nhập đợt này</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {error || !lines ? (
              <TableEmpty colSpan={6} loading={!error} title={error} />
            ) : lines.map((l) => {
              const done = l.remaining === 0;
              const qty = picked[l.lineId] ?? 0;
              return (
                <TableRow key={l.lineId} className={done ? "text-muted-foreground" : undefined}>
                  <TableCell className="px-3">
                    <Checkbox aria-label={l.name} checked={qty > 0} disabled={done}
                      onCheckedChange={(v) => setPicked((p) => ({ ...p, [l.lineId]: v ? l.remaining : 0 }))} />
                  </TableCell>
                  <TableCell className="text-muted-foreground truncate px-3 font-mono text-xs">{l.catalogCode}</TableCell>
                  <TableCell className="truncate px-3 font-medium" title={l.name}>{l.name}</TableCell>
                  <TableCell className="px-3 text-end tabular-nums">{l.planned} {l.unitName ?? ""}</TableCell>
                  <TableCell className="px-3 text-end tabular-nums">
                    {l.received}
                    {l.pending ? <div className="text-warning-text text-xs">{l.pending} ở phiếu đang lập</div> : null}
                  </TableCell>
                  <TableCell className="px-3 text-end">
                    {done ? (l.pending ? "Đang lập phiếu" : "Đã nhập đủ") : (
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
          {/* Chỉ số thiết bị — không tiền (trưởng nhóm 14/11/2026: phiếu ghi tăng quan tâm thiết bị nhận về). */}
          <span className="text-foreground font-medium tabular-nums">{chosen.length}</span> thiết bị
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
 * Hộp chọn PHIẾU NGUỒN khi lập phiếu ghi tăng tay. Nguồn hình thành "Kế hoạch mua sắm" đi từ một đề xuất
 * mua sắm, "Kiểm kê thừa" đi từ một biên bản kiểm kê — chọn nguồn mà không nối phiếu thì phiếu ghi tăng
 * không biết hàng này theo đề xuất nào, và đề xuất không bao giờ thấy mình đã nhập hàng.
 *
 * <p>Không tự dựng liên kết ở trình duyệt: mua sắm gọi đúng hành động có sẵn của đề xuất
 * (`POST /purchase_proposals/{id}/intake` kèm các dòng nhập đợt này — hàng về nhiều đợt thì một đề xuất nhiều phiếu
 * ghi tăng, máy chủ giữ số còn lại), kiểm kê thừa mở
 * phiếu nháp máy chủ đã lập lúc duyệt biên bản. Chọn xong là sang màn SỬA của phiếu nháp đó.
 */
export function IntakeSourcePicker({ kind, schoolId, open, onOpenChange, onCancel }: {
  kind: SourceKind;
  schoolId: number | null | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Đóng hộp mà KHÔNG chọn phiếu nguồn (nút Đóng, dấu ×, Esc) — chọn xong thì không gọi. */
  onCancel?: () => void;
}) {
  const cancel = () => {
    onCancel?.();
    onOpenChange(false);
  };
  const { edit, editUrl } = useNavigation();
  const navigate = useNavigate();
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

  // Còn nhập được hay không (hành động "intake", phiếu nháp từ kiểm kê) chỉ biết sau khi đọc từng phiếu: đọc đủ mọi trang rồi
  // lọc, một cỡ trang cố định thì phiếu nằm ngoài mất mà không báo.
  const proposals = useAllRows<PurchaseProposal>("purchase_proposals",
    [...bySchool, { field: "status", operator: "eq", value: "COMPLETED" }], open && kind === "MUA_SAM");
  const drafts = useAllRows<EquipmentIntake>("equipment_intakes",
    [...bySchool, { field: "status", operator: "eq", value: "DRAFT" }], open && kind === "KIEM_KE_THUA");
  // Kế hoạch là thứ người lập CHỌN (cơ quan nào ban hành, năm nào); đề xuất của trường trong kế hoạch là thứ
  // phiếu ghi tăng chép dòng từ đó. Trường chỉ đọc được kế hoạch đã duyệt có đề xuất của mình (115).
  const plans = useAllRows<{ id: number; title: string; budgetYear: number | null; managingBody?: { name: string } | null }>("procurement_plans",
    [], open && kind === "MUA_SAM");
  const source = kind === "MUA_SAM" ? proposals : drafts;
  const loading = source.isLoading;
  const text = TEXT[kind];

  const rows = useMemo<Row[]>(() => {
    const draftList = drafts.data ?? [];
    if (kind === "KIEM_KE_THUA") {
      return draftList.filter((d) => d.source?.resource === "inventory_sessions").map((d) => ({
        key: `d${d.id}`, code: d.source?.code ?? "Chưa cấp số", date: d.intakeDate, info: d.note ?? "", lines: d.lineCount, amount: null, draftId: d.id,
      }));
    }
    // Chỉ đề xuất còn thiết bị chưa nhập (còn hành động "intake"); đã nhập đủ — kể cả bằng phiếu còn nháp — thì
    // không hiện.
    const planOf = new Map((plans.data ?? []).map((pl) => [pl.id, pl]));
    return (proposals.data ?? [])
      // Chỉ đề xuất ĐÃ VÀO kế hoạch (có kế hoạch) — "Kế hoạch mua sắm" không nhận hàng ngoài kế hoạch.
      .filter((p) => p._actions?.includes("intake") && p.plan != null)
      .map((p) => ({
        key: `p${p.id}`, code: p.code ?? "Chưa cấp số", date: p.proposalDate, info: p.plan?.title ?? "", lines: p.lineCount, amount: p.totalAmount ?? 0,
        body: p.plan ? planOf.get(p.plan.id)?.managingBody?.name : undefined, year: (p.plan ? planOf.get(p.plan.id)?.budgetYear : null) ?? p.budgetYear,
        draftId: null, proposal: p,
      }));
  }, [kind, drafts.data, proposals.data, plans.data]);

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

  const paged = usePagedRows(shown, { resetKey: `${kind}|${q}|${sort}`, sizeKey: "intakeSource" });

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
      // Phiếu lập sẵn chưa tính là đã lưu: màn sửa hỏi "Lưu nháp?" khi rời đi, không lưu thì bỏ (`?fresh=1`).
      onOpenChange(false);
      navigate(`${editUrl("equipment_intakes", res.intakeId)}?fresh=1`, { replace: true });
    } catch (error) {
      notify?.({ type: "error", message: await errorMessage(error) });
    } finally {
      setBusy(null);
    }
  }

  const withAmount = kind === "MUA_SAM";
  const columns = withAmount ? 6 : 5;
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : cancel())}>
      {/* Cùng khuôn với hộp chọn cán bộ: hàng tìm + xếp, bảng trong khung cao cố định, thanh chân. */}
      <DialogContent size="picker">
        <DialogHeader>
          <DialogTitle>{chosen ? "Chọn thiết bị nhập đợt này" : text.title}</DialogTitle>
          {/* Hộp chọn kế hoạch không có dòng phụ (trưởng nhóm 13/11/2026) — tiêu đề và bảng đã đủ; giữ cho trình đọc màn hình. */}
          {/* Bước hai: tiêu đề ngắn, dòng phụ chỉ là tên kế hoạch (trưởng nhóm 14/11/2026: đơn giản lại). */}
          <DialogDescription className={cn(chosen && "truncate", !chosen && kind === "MUA_SAM" && "sr-only")} title={chosen ? chosen.info || chosen.code : undefined}>
            {chosen ? (
              <>
                {/* Nhãn cơ quan lập kế hoạch (Sở / UBND) trước tên kế hoạch — trưởng nhóm 14/11/2026. */}
                {chosen.body ? <span className="bg-info-subtle text-info-text me-2 rounded-md px-1.5 py-0.5 text-xs font-medium">{chosen.body}</span> : null}
                {chosen.info || chosen.code}
              </>
            ) : text.description}
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
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border">
        <div ref={paged.boxRef} className="min-h-0 flex-1 overflow-auto [&>[data-slot=table-container]]:overflow-visible [&_tbody_tr:last-child]:border-b">
          <Table className="table-fixed">
            {withAmount ? (
              <colgroup>
                <col />
                <col className="w-44" />
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
                    <TableHead className="px-4 text-end">Thiết bị thừa</TableHead>
                  </>
                )}
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading || shown.length === 0 ? (
                <TableEmpty colSpan={columns} loading={loading} filtered={!!q} title={q ? "Không có phiếu nào khớp." : text.empty}
                  description={q ? undefined : text.emptyHint} />
              ) : (
                paged.visible.map((r) => (
                  <TableRow key={r.key} className={cn("group/row", LIFT_ROW, "h-12 cursor-pointer")} onClick={() => busy == null && void pick(r)}>
                    {withAmount ? (
                      <>
                        <TableCell className="truncate px-4 font-medium" title={r.info || undefined}>{r.info || <span className="text-muted-foreground">Chưa đặt tên</span>}</TableCell>
                        <TableCell className="text-muted-foreground truncate px-4" title={r.body}>{r.body ?? "Không rõ"}</TableCell>
                        <TableCell className="px-4 tabular-nums">{r.year ?? <span className="text-muted-foreground">Chưa khai</span>}</TableCell>
                        <TableCell className="truncate px-4 font-mono text-xs">{r.code}</TableCell>
                        <TableCell className="px-4 text-end tabular-nums">{money.format(r.amount ?? 0)}</TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className="truncate px-4 font-mono text-xs">{r.code}</TableCell>
                        <TableCell className="px-4">{formatPlainDate(r.date)}</TableCell>
                        <TableCell className="truncate px-4" title={r.info || undefined}>{r.info || <span className="text-muted-foreground">Không có ghi chú</span>}</TableCell>
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
        {paged.pager}
        </div>

        {/* Số dòng bên trái; nút dồn về tay phải. */}
        <div className="flex flex-wrap items-center gap-3 border-t pt-4">
          <span className="text-muted-foreground me-auto text-sm">
            <span className="text-foreground font-medium tabular-nums">{shown.length}</span> {withAmount ? "kế hoạch" : "biên bản"}
          </span>
          {/* "Kế hoạch mua sắm" bắt buộc theo kế hoạch (trưởng nhóm 13/11/2026): không có lối "nhập không theo phiếu" —
              đóng hộp thì phiếu chưa trình được tới khi chọn đề xuất hoặc đổi nguồn. */}
          <Button type="button" variant="outline" onClick={cancel}>
            Đóng
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
