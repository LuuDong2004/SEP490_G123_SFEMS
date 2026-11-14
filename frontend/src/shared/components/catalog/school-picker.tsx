import { useList } from "@refinedev/core";
import { keepPreviousData } from "@tanstack/react-query";
import { ChevronDown, Search, GraduationCap } from "lucide-react";
import { useEffect, useState } from "react";

import { DataTablePagination } from "@/shared/components/data-table/data-table-pagination";
import { IconFilter } from "@/shared/components/data-table/icon-filter";
import { cn } from "@/shared/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import type { School } from "@/domains/school/types";
import { LIFT_ROW } from "@/shared/lib/row-lift";
import { TableEmpty } from "@/shared/components/data-table/table-empty";

type Level = { id: number; name: string };
const ALL = "__all";

/**
 * Chọn MỘT trường bằng hộp thoại có ô tìm, lọc cấp học và bảng phân trang — thay cho danh sách xổ xuống chỉ có
 * tên: với hơn nghìn trường, danh sách xổ xuống chỉ hiện vài chục trường đầu và không phân biệt được hai trường
 * trùng tên. Mỗi dòng hiện mã, cấp học và cơ quan quản lý. Tìm ở máy chủ, trong phạm vi người xem thấy.
 */
export function SchoolPickerField({ value, onChange, placeholder = "Vui lòng chọn trường", invalid }: {
  value: { id: number; name: string } | null;
  onChange: (school: { id: number; name: string }) => void;
  placeholder?: string;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-invalid={invalid || undefined}
        className={cn("bg-field hover:border-primary/40 aria-invalid:border-destructive flex h-9 w-full min-w-0 items-center gap-2",
          "overflow-hidden rounded-md border px-3 text-left text-sm transition-colors")}>
        <span className={cn("min-w-0 flex-1 truncate", !value && "text-muted-foreground")}>{value?.name ?? placeholder}</span>
        <ChevronDown className="text-muted-foreground size-4 shrink-0" />
      </button>
      {open ? (
        <SchoolPickerDialog selectedId={value?.id ?? null} onClose={() => setOpen(false)}
          onPick={(s) => { onChange(s); setOpen(false); }} />
      ) : null}
    </>
  );
}

function SchoolPickerDialog({ selectedId, onPick, onClose }: {
  selectedId: number | null;
  onPick: (school: { id: number; name: string }) => void;
  onClose: () => void;
}) {
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState(ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  // Gõ xong mới tìm — không hỏi máy chủ theo từng phím.
  useEffect(() => {
    const timer = setTimeout(() => { setSearch(term.trim()); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [term]);
  useEffect(() => setPage(1), [level, pageSize]);

  const { result: levels } = useList<Level>({
    resource: "education_levels",
    pagination: { pageSize: 50 },
    sorters: [{ field: "sortOrder", order: "asc" }],
  });
  const { result, query } = useList<School>({
    resource: "schools",
    // Trường đã ngưng (ngoài danh sách Sở) không chọn được nữa.
    filters: [
      { field: "status", operator: "eq" as const, value: "active" },
      ...(search ? [{ field: "q", operator: "contains" as const, value: search }] : []),
      ...(level !== ALL ? [{ field: "educationLevel.id", operator: "eq" as const, value: level }] : []),
    ],
    pagination: { currentPage: page, pageSize },
    sorters: [{ field: "name", order: "asc" }],
    // Giữ kết quả cũ trên màn trong lúc chờ kết quả mới — bảng không trống rồi nhảy lại mỗi lần gõ / lọc.
    queryOptions: { placeholderData: keepPreviousData },
  });
  const rows = result?.data ?? [];
  const total = result?.total ?? 0;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      {/* Cao CỐ ĐỊNH: tìm / lọc ra ít dòng thì hộp không co lại, ô tìm và thanh trang đứng yên một chỗ. */}
      <DialogContent size="picker">
        <DialogHeader>
          <DialogTitle>Chọn trường</DialogTitle>
          <DialogDescription className="sr-only">Tìm theo tên hoặc mã trường, lọc theo cấp học, bấm một dòng để chọn.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-80 max-w-full">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
            <Input autoFocus value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Tìm theo tên hoặc mã trường…" className="rounded-full pl-8" />
          </div>
          <IconFilter icon={<GraduationCap />} label="cấp học" allLabel="Mọi cấp học" value={level === ALL ? null : level}
            onChange={(v) => setLevel(v ?? ALL)}
            groups={[{ items: (levels?.data ?? []).map((l) => ({ key: String(l.id), label: l.name })) }]} />
        </div>
        <div className="min-h-0 flex-1 overflow-auto rounded-md border [&>[data-slot=table-container]]:overflow-visible [&_tbody_tr:last-child]:border-b">
          {/* Cột rộng cố định — đổi kết quả không làm cột xô lệch. */}
          <Table className={cn("table-fixed", query.isFetching && "opacity-60 transition-opacity")}>
            <TableHeader sticky>
              <TableRow>
                <TableHead className="w-44">Mã trường</TableHead>
                <TableHead className="w-[34%]">Tên trường</TableHead>
                <TableHead className="w-40">Cấp học</TableHead>
                <TableHead>Cơ quan quản lý</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.id} data-state={s.id === selectedId ? "selected" : undefined} className={cn("group/row", LIFT_ROW, "cursor-pointer")}
                  onClick={() => onPick({ id: s.id, name: s.name })}>
                  <TableCell className="text-muted-foreground truncate font-mono text-xs" title={s.code}>{s.code}</TableCell>
                  <TableCell className="truncate font-medium" title={s.name}>{s.name}</TableCell>
                  <TableCell className="truncate">{s.educationLevel?.name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground truncate" title={s.departmentOfEducation?.name}>{s.departmentOfEducation?.name ?? "—"}</TableCell>
                </TableRow>
              ))}
              {!rows.length ? (
                <TableEmpty colSpan={4} loading={query.isLoading} title={"Không có trường nào khớp."} />
              ) : null}
            </TableBody>
          </Table>
        </div>
        <div className="shrink-0">
          <DataTablePagination currentPage={page} pageCount={Math.max(1, Math.ceil(total / pageSize))}
            setCurrentPage={setPage} pageSize={pageSize} setPageSize={setPageSize} total={total} pageSizeLabel="Số trường mỗi trang" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
