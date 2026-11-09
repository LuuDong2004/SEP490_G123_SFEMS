import { useCan, useList } from "@refinedev/core";

import { LIFT_ROW } from "@/shared/lib/row-lift";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

type CatalogNorm = {
  id: number;
  standard: { name: string } | null;
  standardStatus: string;
  subject: { name: string } | null;
  sectionName: string | null;
  quantityText: string | null;
  minQuantity: number | null;
  normBasis: string | null;
  basisSize: number | null;
  gradeLevels: string | null;
  forTeacher: boolean;
  forStudent: boolean;
  optional: boolean;
};

const PER_BASIS: Record<string, string> = {
  PER_CLASS: "lớp",
  PER_STUDENT: "HS",
  PER_TEACHER: "GV",
  PER_ROOM: "PHBM",
  PER_SCHOOL: "trường",
};

/** Số lượng đọc được: nguyên văn của phụ lục nếu có, không thì dựng từ phần đã hiểu ("2 / lớp"). */
function quantityLabel(norm: CatalogNorm): string {
  if (norm.quantityText) return norm.quantityText;
  if (norm.minQuantity == null) return "—";
  const size = norm.basisSize && norm.basisSize > 1 ? `${norm.basisSize} ` : "";
  return `${norm.minQuantity} / ${size}${PER_BASIS[norm.normBasis ?? ""] ?? ""}`.trim();
}

/** Khối 10–12 của THPT: đủ cả ba là "Mọi lớp". */
function gradesLabel(gradeLevels: string | null): string {
  if (!gradeLevels) return "Mọi lớp";
  const grades = gradeLevels.split(",").map(Number).sort((a, b) => a - b);
  if (grades.length === 3 && grades[0] === 10 && grades[2] === 12) return "Mọi lớp";
  return `Lớp ${grades.join(", ")}`;
}

/** Chiều ngược của liên kết: các dòng phụ lục thông tư đòi thiết bị này — bao nhiêu, lớp nào. */
export function NormsOfCatalog({ catalogId }: { catalogId: number }) {
  const mayRead = useCan({ resource: "equipment_norms", action: "list" }).data?.can ?? false;
  const { result, query } = useList<CatalogNorm>({
    resource: "equipment_norms",
    filters: [{ field: "catalog.id", operator: "eq", value: catalogId }],
    sorters: [{ field: "sortOrder", order: "asc" }],
    pagination: { currentPage: 1, pageSize: 50 },
    queryOptions: { enabled: mayRead },
  });
  // Chỉ bộ đang áp dụng: bộ nháp, bộ hết hiệu lực chép cùng dòng, hiện cả là lặp.
  const rows = (result?.data ?? []).filter((norm) => norm.standardStatus === "ACTIVE");
  if (!mayRead || query.isLoading || rows.length === 0) return null;

  return (
    <div className="space-y-2 sm:col-span-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium">Định mức theo thông tư</span>
        <span className="text-muted-foreground text-xs">{rows.length} dòng phụ lục</span>
      </div>
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bộ tiêu chuẩn</TableHead>
              <TableHead>Môn / nhóm</TableHead>
              <TableHead className="w-40">Số lượng</TableHead>
              <TableHead className="w-28">Lớp</TableHead>
              <TableHead className="w-28">Đối tượng</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((norm) => (
              <TableRow key={norm.id} className={cn("group/row", LIFT_ROW)}>
                <TableCell className="whitespace-normal">{norm.standard?.name}</TableCell>
                <TableCell className="whitespace-normal">
                  {norm.subject?.name ?? "—"}
                  {norm.sectionName ? <div className="text-muted-foreground text-xs">{norm.sectionName}</div> : null}
                </TableCell>
                <TableCell className="tabular-nums">
                  {quantityLabel(norm)}
                  {norm.optional ? <Badge variant="neutral" className="ms-2">Tự chọn</Badge> : null}
                </TableCell>
                <TableCell className="text-muted-foreground">{gradesLabel(norm.gradeLevels)}</TableCell>
                <TableCell>{[norm.forTeacher ? "GV" : null, norm.forStudent ? "HS" : null].filter(Boolean).join(" · ") || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
