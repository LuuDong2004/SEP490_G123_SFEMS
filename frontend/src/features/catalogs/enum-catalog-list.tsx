import { useCustom } from "@refinedev/core";
import { Lock } from "lucide-react";

import { ListView, ListViewHeader } from "@/shared/components/views/list-view";
import { FillBox } from "@/shared/components/layout/fill-box";
import { LoadingOverlay } from "@/shared/components/layout/loading-overlay";
import { Card } from "@/shared/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { API_URL } from "@/shared/api/constants";
import type { EnumCatalogConfig } from "@/features/catalogs/enum-registry";
import { LIFT_ROW } from "@/shared/lib/row-lift";
import { cn } from "@/shared/lib/utils";

type EnumItem = { sortOrder: number; code: string; label: string };

/**
 * Màn xem một danh mục cố định. Không thêm/sửa/xoá: giá trị nằm trong code vì
 * nghiệp vụ rẽ nhánh theo từng giá trị — đổi một giá trị là đổi logic.
 */
export function EnumCatalogList({ config }: { config: EnumCatalogConfig }) {
  const { result, query } = useCustom<EnumItem[]>({
    url: `${API_URL}/enum_catalogs/${config.resource}`,
    method: "get",
  });
  const rows = Array.isArray(result?.data) ? result.data : [];

  return (
    <ListView>
      <ListViewHeader canCreate={false} />
      <LoadingOverlay loading={query.isLoading}>
        <FillBox>
        <Card className="min-h-0 flex-1 gap-0 overflow-hidden py-0">
          <div className="text-muted-foreground flex shrink-0 items-center gap-2 border-b border-border px-4 py-3 text-xs">
            <Lock className="size-3.5" />
            Danh mục cố định, chỉ xem.
          </div>
          <div className="min-h-0 flex-1 overflow-auto [&>[data-slot=table-container]]:overflow-visible [&_tbody_tr:last-child]:border-b">
          <Table>
            <TableHeader sticky>
              <TableRow>
                <TableHead className="w-16 text-center">STT</TableHead>
                <TableHead className="w-64">Mã</TableHead>
                <TableHead>Tên</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.code} className={cn("group/row", LIFT_ROW)}>
                  <TableCell className="text-muted-foreground text-center tabular-nums">
                    {row.sortOrder}
                  </TableCell>
                  <TableCell className="font-medium">{row.code}</TableCell>
                  <TableCell>{row.label}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </Card>
        </FillBox>
      </LoadingOverlay>
    </ListView>
  );
}
