import { useCan } from "@refinedev/core";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, FileText, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { kyInstance } from "@/shared/api/data";
import { TableEmpty } from "@/shared/components/data-table/table-empty";
import { formatPlainDate } from "@/shared/lib/format";
import { LIFT_ROW } from "@/shared/lib/row-lift";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

import { LegalDocDialog, type LegalDocDialogState } from "./legal-doc-dialog";

/**
 * Chọn văn bản căn cứ (danh mục Văn bản căn cứ — `legal_documents`) bằng POPUP: tìm, bấm tiêu đề cột để sắp, thêm /
 * sửa văn bản ngay trong popup (trưởng nhóm 17/11/2026 — văn bản ít, không cần bộ lọc). Văn bản vừa thêm được chọn sẵn.
 */

type LegalDoc = {
  id: number;
  code: string;
  name: string;
  docType: string;
  issuer: string;
  issuedOn: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  effective: boolean;
};

type SortKey = "code" | "name" | "issuedOn" | "effectiveFrom";

const COLUMNS: { key: SortKey; label: string; className?: string }[] = [
  { key: "code", label: "Số hiệu", className: "w-44" },
  { key: "name", label: "Tên văn bản" },
  { key: "issuedOn", label: "Ban hành", className: "w-28" },
  { key: "effectiveFrom", label: "Có hiệu lực", className: "w-28" },
];

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function status(d: LegalDoc) {
  if (d.effectiveFrom > today()) return <Badge variant="info">Sắp hiệu lực</Badge>;
  return d.effective ? <Badge variant="success">Đang hiệu lực</Badge> : <Badge variant="neutral">Hết hiệu lực</Badge>;
}

export function useLegalDocs() {
  return useQuery({
    queryKey: ["legal_documents", "picker"],
    queryFn: () => kyInstance.get("legal_documents", { searchParams: { _start: "0", _end: "500" } }).json<LegalDoc[]>(),
  });
}

/** Ngày áp dụng (= ngày có hiệu lực) của văn bản đã chọn. */
export function useLegalEffectiveFrom(id: number | null | undefined) {
  const { data } = useLegalDocs();
  return (data ?? []).find((d) => d.id === id)?.effectiveFrom ?? null;
}

/** Popup chọn văn bản. */
function LegalDocPickerDialog({ open, value, onClose, onPick }: {
  open: boolean;
  value: number | null;
  onClose: () => void;
  onPick: (doc: LegalDoc) => void;
}) {
  const { data, isLoading, refetch } = useLegalDocs();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "effectiveFrom", desc: true });
  const [picked, setPicked] = useState<number | null>(value);
  const [form, setForm] = useState<LegalDocDialogState>(null);
  const config = useCan({ resource: "legal_documents", action: "edit" }).data?.can ?? false;

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = (data ?? []).filter((d) =>
      !term || `${d.code} ${d.name} ${d.issuer}`.toLowerCase().includes(term));
    return [...list].sort((a, b) => {
      const x = String(a[sort.key] ?? "");
      const y = String(b[sort.key] ?? "");
      return (sort.desc ? -1 : 1) * x.localeCompare(y, "vi", { numeric: true });
    });
  }, [data, q, sort]);
  const chosen = (data ?? []).find((d) => d.id === picked);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: false }));

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent size="wide">
          <DialogHeader>
            <DialogTitle>Chọn thông tư căn cứ</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <div className="relative w-full max-w-[22rem]">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm số hiệu, tên văn bản…" className="pl-9" />
            </div>
            {config ? (
              <Button type="button" className="ms-auto" onClick={() => setForm({ mode: "create" })}>
                <Plus />
                Thêm văn bản
              </Button>
            ) : null}
          </div>
          <div className="bg-card shadow-e1 max-h-[26rem] min-h-[18rem] overflow-auto rounded-lg border">
            <Table className="table-fixed">
              <TableHeader sticky>
                <TableRow className="hover:bg-transparent">
                  {COLUMNS.map((c) => (
                    <TableHead key={c.key} className={c.className}>
                      <button type="button" className="inline-flex items-center gap-1 uppercase" onClick={() => toggleSort(c.key)}>
                        {c.label}
                        {sort.key !== c.key ? <ArrowUpDown className="size-3 opacity-50" />
                          : sort.desc ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />}
                      </button>
                    </TableHead>
                  ))}
                  <TableHead className="w-32">Trạng thái</TableHead>
                  {config ? <TableHead className="w-16" /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading || rows.length === 0 ? (
                  <TableEmpty colSpan={config ? 6 : 5} loading={isLoading} filtered={!!q.trim()}
                    title={q.trim() ? "Không có văn bản nào khớp." : "Chưa có văn bản nào."} />
                ) : rows.map((d) => (
                  <TableRow key={d.id}
                    className={cn("group/row cursor-pointer", LIFT_ROW, picked === d.id && "bg-primary/10")}
                    onClick={() => setPicked(d.id)}
                    onDoubleClick={() => onPick(d)}>
                    <TableCell className="font-mono text-xs">{d.code}</TableCell>
                    <TableCell className="truncate" title={d.name}>{d.name}</TableCell>
                    <TableCell className="tabular-nums">{formatPlainDate(d.issuedOn)}</TableCell>
                    <TableCell className="tabular-nums">{formatPlainDate(d.effectiveFrom)}</TableCell>
                    <TableCell>{status(d)}</TableCell>
                    {config ? (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <button type="button" className="text-primary text-sm hover:underline" onClick={() => setForm({ mode: "edit", id: d.id })}>
                          Sửa
                        </button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter className="items-center">
            <span className="text-muted-foreground me-auto min-w-0 truncate text-sm">
              {chosen ? <>Đã chọn: <span className="text-foreground font-medium">{chosen.code}</span> · áp dụng từ {formatPlainDate(chosen.effectiveFrom)}</> : null}
            </span>
            <Button type="button" variant="outline" onClick={onClose}>Huỷ</Button>
            <Button type="button" disabled={!chosen} onClick={() => chosen && onPick(chosen)}>Chọn</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <LegalDocDialog state={form} onClose={() => setForm(null)}
        onSaved={(record) => {
          void refetch();
          setPicked(record.id);
        }} />
    </>
  );
}

/**
 * Ô "Văn bản căn cứ": chưa chọn là một nút mở popup; đã chọn hiện số hiệu · tên văn bản và ngày áp dụng (theo hiệu lực
 * của văn bản), bấm để đổi.
 */
export function LegalBasisPicker({ value, onChange, invalid, block }: {
  value: number | null;
  onChange: (id: number | null) => void;
  invalid?: boolean;
  /** Ô rộng hết cột, không kèm ngày áp dụng (form tự hiện ngày ở ô riêng). */
  block?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { data } = useLegalDocs();
  const doc = (data ?? []).find((d) => d.id === value);
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-2", block && "min-w-0")}>
      <button type="button" onClick={() => setOpen(true)}
        className={cn(
          "bg-card shadow-e1 flex h-9 max-w-full items-center gap-2 rounded-full border px-3.5 text-left text-sm transition-colors hover:border-primary",
          block ? "w-full" : "w-[26rem]",
          invalid && "border-destructive",
        )}>
        <FileText className="text-muted-foreground size-4 shrink-0" />
        {doc ? (
          <span className="min-w-0 flex-1 truncate">
            <span className="font-medium">{doc.code}</span>
            <span className="text-muted-foreground"> · {doc.name}</span>
          </span>
        ) : (
          <span className="text-muted-foreground min-w-0 flex-1 truncate">Chọn văn bản căn cứ</span>
        )}
        <span className="text-primary inline-flex shrink-0 items-center text-xs font-medium">
          {doc ? "Đổi" : "Chọn"}
          <ChevronRight className="size-3.5" />
        </span>
      </button>
      {doc && !block ? (
        <span className="text-muted-foreground text-sm whitespace-nowrap">
          Áp dụng từ <span className="text-foreground font-medium tabular-nums">{formatPlainDate(doc.effectiveFrom)}</span>
        </span>
      ) : null}
      <LegalDocPickerDialog open={open} value={value} onClose={() => setOpen(false)}
        onPick={(d) => { onChange(d.id); setOpen(false); }} />
    </div>
  );
}
