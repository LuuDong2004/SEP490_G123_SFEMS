import { useList, type CrudFilter } from "@refinedev/core";
import { ChevronDown, Search, X } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { LIFT_ROW } from "@/shared/lib/row-lift";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type CatalogRow = {
  id: number;
  code?: string | null;
  name: string;
  unit?: { name: string } | null;
  equipmentType?: { name: string } | null;
  subject?: { name: string } | null;
};

/** Một trang của hộp chọn — vừa đúng chiều cao bảng, không phải cuộn trong cuộn. */
const PAGE_SIZE = 8;

/**
 * Chọn một thiết bị trong Danh mục thiết bị bằng HỘP THOẠI: mã, tên, đơn vị tính, loại, môn. Danh mục hơn
 * 1.700 dòng nên tìm và phân trang ở MÁY CHỦ — ô xổ đổ sẵn "200 dòng đầu" là sót im lặng. `filters` thu hẹp
 * danh sách (vd. chỉ vật tư tiêu hao). Dùng chung cho mọi ô chọn thiết bị từ danh mục (`RefField` với
 * `resource="equipment_catalogs"`).
 */
export function EquipmentCatalogPicker({
  value,
  onChange,
  filters,
  label = "thiết bị",
  disabledHint,
  invalid,
  required,
}: {
  /** Mục đang chọn — `name` / `code` có thì ô vẽ được ngay, chưa cần tải danh sách. */
  value: { id: number; name?: string; code?: string | null } | null;
  onChange: (row: CatalogRow | null) => void;
  filters?: CrudFilter[];
  /** Tên ô, viết thường — vào câu nhắc và tiêu đề hộp thoại. */
  label?: string;
  /** Có giá trị = ô bị khoá, hiện câu nhắc này. */
  disabledHint?: string;
  invalid?: boolean;
  /** Ô bắt buộc thì không có nút "Bỏ chọn". */
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [applied, setApplied] = useState("");
  const [page, setPage] = useState(1);
  // Dòng vừa chọn: giữ lại để ô hiện đúng tên và mã mà không phải đọc lại danh mục.
  const [picked, setPicked] = useState<CatalogRow | null>(null);

  // Gõ là tìm (chờ người ta ngừng gõ một nhịp), không cần nút "Tìm" riêng.
  useEffect(() => {
    const t = setTimeout(() => {
      setApplied(term.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [term]);

  const { result, query } = useList<CatalogRow>({
    resource: "equipment_catalogs",
    filters: [
      ...(filters ?? []),
      { field: "active", operator: "eq", value: true },
      ...(applied ? [{ field: "q", operator: "eq" as const, value: applied }] : []),
    ],
    pagination: { currentPage: page, pageSize: PAGE_SIZE },
    sorters: [{ field: "code", order: "asc" }],
    queryOptions: { enabled: open, placeholderData: (prev: any) => prev },
  });
  const rows = result?.data ?? [];
  const total = result?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const selected = value ? (picked?.id === value.id ? picked : { id: value.id, name: value.name ?? `#${value.id}`, code: value.code }) : null;

  const pick = (row: CatalogRow | null) => {
    setPicked(row);
    onChange(row);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!!disabledHint}
        aria-invalid={invalid || undefined}
        className="bg-field hover:border-primary/40 aria-invalid:border-destructive flex h-9 w-full min-w-0 items-center gap-2 overflow-hidden rounded-md border px-3 text-left text-sm transition-colors disabled:opacity-60"
      >
        {selected ? (
          // Ô chỉ hiện tên — mã nằm trong hộp chọn; ô hẹp mà chen cả mã thì tên bị cắt cụt.
          <span className="min-w-0 flex-1 truncate" title={selected.code ? `${selected.name} · ${selected.code}` : selected.name}>{selected.name}</span>
        ) : (
          <span className="text-muted-foreground min-w-0 flex-1 truncate">{disabledHint ?? `Vui lòng chọn ${label}`}</span>
        )}
        <ChevronDown className="text-muted-foreground size-4 shrink-0 opacity-60" />
      </button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!o) {
            setTerm("");
            setPage(1);
          }
          setOpen(o);
        }}
      >
        <DialogContent size="picker">
          <DialogHeader>
            <DialogTitle>Chọn {label}</DialogTitle>
            <DialogDescription className="sr-only">Tìm theo mã hoặc tên rồi bấm một dòng để chọn.</DialogDescription>
          </DialogHeader>

          <div className="relative w-80 max-w-full">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
            <Input
              autoFocus
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              // Hộp này mở TRONG form của màn: Enter ở ô tìm không được submit form bên ngoài.
              onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
              placeholder="Tìm mã hoặc tên…"
              className="rounded-full pl-8"
              aria-label={`Tìm ${label}`}
            />
          </div>

          <div className="min-h-0 flex-1 overflow-auto rounded-md border [&>[data-slot=table-container]]:overflow-visible [&_tbody_tr:last-child]:border-b">
            <Table className="table-fixed">
              <colgroup>
                <col className="w-40" />
                <col />
                <col className="w-28" />
                <col className="w-44" />
                <col className="w-40" />
              </colgroup>
              <TableHeader sticky>
                <TableRow>
                  <TableHead className="px-4">Mã</TableHead>
                  <TableHead className="px-4">Tên</TableHead>
                  <TableHead className="px-4">Đơn vị tính</TableHead>
                  <TableHead className="px-4">Loại thiết bị</TableHead>
                  <TableHead className="px-4">Môn học</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.isLoading || rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground py-10 text-center">
                      {query.isLoading ? "Đang tải…" : applied ? "Không có mục nào khớp." : "Danh mục chưa có mục nào."}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => {
                    const active = r.id === value?.id;
                    return (
                      <TableRow key={r.id} className={cn("group/row", LIFT_ROW, "h-12 cursor-pointer", active && "bg-primary/10 hover:bg-primary/10")} onClick={() => pick(r)}>
                        <TableCell className="text-muted-foreground truncate px-4 font-mono text-xs">{r.code ?? "—"}</TableCell>
                        <TableCell className={cn("truncate px-4 font-medium", active && "text-primary")} title={r.name}>{r.name}</TableCell>
                        <TableCell className="truncate px-4">{r.unit?.name ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground truncate px-4" title={r.equipmentType?.name}>{r.equipmentType?.name ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground truncate px-4" title={r.subject?.name}>{r.subject?.name ?? "—"}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Số dòng bên trái; phân trang và nút bấm dồn về tay phải. */}
          <div className="flex flex-wrap items-center gap-3 border-t pt-4">
            <span className="text-muted-foreground me-auto text-sm tabular-nums">
              {total ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} trên ` : ""}
              <span className="text-foreground font-medium">{total}</span> mục
            </span>
            {pageCount > 1 ? (
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((n) => n - 1)}>
                  Trước
                </Button>
                <span className="tabular-nums">
                  Trang {page}/{pageCount}
                </span>
                <Button type="button" variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage((n) => n + 1)}>
                  Sau
                </Button>
              </div>
            ) : null}
            <div className="flex items-center gap-3">
              {value && !required ? (
                <Button type="button" variant="ghost" onClick={() => pick(null)}>
                  <X />
                  Bỏ chọn
                </Button>
              ) : null}
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Đóng
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
