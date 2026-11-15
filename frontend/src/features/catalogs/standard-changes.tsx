import { useCustom } from "@refinedev/core";
import { ListChecks } from "lucide-react";
import { useMemo, useState } from "react";

import { API_URL } from "@/shared/api/constants";
import { DetailTable, type DetailColumn, type DetailFilter } from "@/shared/components/data-table/detail-table";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";

/** Một dòng phụ lục khác bộ trước — `GET /equipment_standards/{id}/changes`. */
export type StandardChange = {
  kind: "ADDED" | "CHANGED" | "REMOVED";
  subjectName: string | null;
  name: string;
  topic: string | null;
  fields: string | null;
  before: string | null;
  after: string | null;
};

const KIND_LABEL: Record<StandardChange["kind"], string> = { ADDED: "Mới", CHANGED: "Đổi", REMOVED: "Bỏ" };
const COLUMNS: DetailColumn[] = [
  { key: "kind", label: "Loại" },
  { key: "subjectName", label: "Môn" },
  { key: "name", label: "Thiết bị" },
  { key: "topic", label: "Chủ đề" },
  { key: "fields", label: "Phần đổi" },
  { key: "before", label: "Số lượng trước" },
  { key: "after", label: "Số lượng sau" },
];

/** Dòng khác bộ trước của một bộ: bộ nháp so ngay, bộ đã áp dụng đọc danh sách ghi lúc áp dụng. */
export function useStandardChanges(standardId: number | null | undefined, enabled = true) {
  const { result, query } = useCustom<StandardChange[]>({
    url: `${API_URL}/equipment_standards/${standardId}/changes`,
    method: "get",
    queryOptions: { enabled: enabled && standardId != null },
  });
  const data = result?.data;
  const rows = useMemo(() => (Array.isArray(data) ? (data as StandardChange[]) : []), [data]);
  const counts = useMemo(() => ({
    added: rows.filter((r) => r.kind === "ADDED").length,
    changed: rows.filter((r) => r.kind === "CHANGED").length,
    removed: rows.filter((r) => r.kind === "REMOVED").length,
  }), [rows]);
  return { rows, counts, loading: query.isLoading };
}

/** "Mới 3 · Đổi 12 · Bỏ 1" — bỏ phần bằng 0. */
export function countsText(c: { added: number; changed: number; removed: number }) {
  return [c.added ? `Mới ${c.added}` : null, c.changed ? `Đổi ${c.changed}` : null, c.removed ? `Bỏ ${c.removed}` : null]
    .filter(Boolean).join(" · ");
}

/**
 * Nút "Thay đổi so với bộ trước" trong Hồ sơ bộ — mở bảng từng dòng thêm / đổi / bỏ (lọc theo loại, tìm, sắp). Bộ
 * không có bộ trước thì không vẽ gì.
 */
export function StandardChangesButton({ standardId, hasPrevious }: { standardId: number; hasPrevious: boolean }) {
  const [open, setOpen] = useState(false);
  const { rows, counts, loading } = useStandardChanges(standardId, hasPrevious);
  const filters = useMemo<DetailFilter<StandardChange>[]>(
    () => [{ key: "kind", label: "loại", values: (r) => [r.kind],
      options: (["ADDED", "CHANGED", "REMOVED"] as const).map((k) => ({ key: k, label: KIND_LABEL[k] })) }],
    [],
  );
  if (!hasPrevious || loading) return null;
  return (
    <>
      <Button type="button" variant="outline" size="sm" disabled={rows.length === 0} onClick={() => setOpen(true)}>
        <ListChecks />
        {rows.length ? `Thay đổi so với bộ trước: ${countsText(counts)}` : "Chưa khác bộ trước"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="wide">
          <DialogHeader>
            <DialogTitle>Thay đổi so với bộ trước</DialogTitle>
          </DialogHeader>
          <DetailTable columns={COLUMNS} rows={rows} filters={filters} searchPlaceholder="Tìm thiết bị…"
            text={(r, c) => (c.key === "kind" ? KIND_LABEL[r.kind] : String(r[c.key as keyof StandardChange] ?? ""))} />
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">Đóng</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
