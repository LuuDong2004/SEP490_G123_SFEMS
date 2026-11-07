import { useMemo } from "react";
import { useCan } from "@refinedev/core";
import { useTable } from "@refinedev/react-table";
import { PackagePlus } from "lucide-react";
import { Link } from "react-router";
import { createColumnHelper } from "@tanstack/react-table";

import { DeleteButton } from "@/shared/components/buttons/delete";
import { EditButton } from "@/shared/components/buttons/edit";
import { ShowButton } from "@/shared/components/buttons/show";
import { DataTable, RESIZABLE_COLUMN_DEFAULTS } from "@/shared/components/data-table/data-table";
import { DataTableQuickFilter } from "@/shared/components/data-table/data-table-quick-filter";
import { OptionFilter } from "@/shared/components/data-table/ref-filter";
import { ROW_ACTIONS_COLUMN, RowActions } from "@/shared/components/data-table/row-actions";
import { ListToolbar, ListView, ListViewHeader } from "@/shared/components/views/list-view";
import { ASSET_STATUS_VARIANTS } from "@/shared/lib/status-variants";
import { DEFAULT_PAGE_SIZE } from "@/shared/lib/format";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import {
  ASSET_STATUS_LABELS,
  ASSET_STATUS_OPTIONS,
  CONDITION_LABELS,
  OFF_BOOK_STATUSES,
  type Equipment,
} from "@/domains/equipment/types";

/**
 * Danh sách hồ sơ thiết bị (TS-01). Tra cứu theo mã riêng ở TS-02.
 *
 * Thiết bị MỚI vào sổ bằng phiếu ghi tăng (lập → lãnh đạo trường duyệt → sinh tài sản, PN-01..03),
 * không tạo thẳng ở đây: nút chính là "Ghi tăng", mở form lập phiếu nhập. Thiết bị trường đã có từ
 * trước khi dùng hệ thống thì nhập từ tệp (TS-07).
 *
 * Không xoá thẳng thiết bị đang trong sổ — chỉ hồ sơ đã ra khỏi sổ (thanh lý, mất) mới xoá được; hồ sơ
 * đã ra khỏi sổ cũng không sửa nữa, chỉ còn để tra.
 */
export const EquipmentList = () => {
  const columns = useMemo(() => {
    const helper = createColumnHelper<Equipment>();
    return [
      helper.accessor("code", {
        id: "code",
        enableResizing: true,
        header: "Mã tài sản",
        enableSorting: true,
        cell: ({ getValue }) => <span className="font-mono text-sm">{getValue()}</span>,
      }),
      helper.accessor("name", {
        id: "name",
        enableResizing: true,
        header: "Tên thiết bị",
        enableSorting: true,
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      }),
      helper.display({
        id: "catalog",
        enableResizing: true,
        header: "Danh mục",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm">{row.original.catalog?.name ?? "—"}</span>
        ),
      }),
      helper.display({
        id: "room",
        enableResizing: true,
        header: "Vị trí",
        enableSorting: false,
        cell: ({ row }) =>
          row.original.room ? (
            <span className="text-sm">{row.original.room.name}</span>
          ) : (
            <span className="text-muted-foreground text-sm">Kho</span>
          ),
      }),
      helper.accessor("status", {
        id: "status",
        header: "Trạng thái",
        enableSorting: false,
        cell: ({ getValue }) => (
          <Badge variant={ASSET_STATUS_VARIANTS[getValue()] ?? "secondary"}>
            {ASSET_STATUS_LABELS[getValue()] ?? getValue()}
          </Badge>
        ),
      }),
      helper.accessor("condition", {
        id: "condition",
        header: "Tình trạng",
        enableSorting: false,
        cell: ({ getValue }) => {
          const value = getValue();
          return value ? (
            <span className="text-sm">{CONDITION_LABELS[value]}</span>
          ) : (
            <span className="text-muted-foreground text-sm">—</span>
          );
        },
      }),
      helper.display({
        id: "actions",
        header: () => <span className="sr-only">Thao tác</span>,
        enableSorting: false,
        ...ROW_ACTIONS_COLUMN,
        cell: ({ row }) => (
          <RowActions>
            {offBook(row.original) ? null : (
              <EditButton recordItemId={row.original.id} iconOnly size="icon-sm" />
            )}
            <ShowButton recordItemId={row.original.id} iconOnly size="icon-sm" />
            {offBook(row.original) ? (
              <DeleteButton recordItemId={row.original.id} record={row.original} iconOnly size="icon-sm" />
            ) : null}
          </RowActions>
        ),
      }),
    ];
  }, []);

  const table = useTable<Equipment>({
    columns,
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    defaultColumn: RESIZABLE_COLUMN_DEFAULTS,
    initialState: {
      columnPinning: { right: ["actions"] },
    },
    refineCoreProps: {
      syncWithLocation: true,
      pagination: { pageSize: DEFAULT_PAGE_SIZE },
    },
  });

  return (
    <ListView>
      <ListViewHeader canCreate={false} actions={<IntakeButton />} />
      <DataTable
        table={table}
        toolbar={
          <ListToolbar
            table={table}
            search={<DataTableQuickFilter table={table} placeholder="Tìm theo mã hoặc tên" />}
            filters={
              <OptionFilter table={table} field="status" all="Mọi trạng thái" options={ASSET_STATUS_OPTIONS} />
            }
          />
        }
      />
    </ListView>
  );
};

/** Hồ sơ đã ra khỏi sổ (thanh lý, mất): còn để tra, không sửa; là thứ duy nhất được xoá. */
const offBook = (record: Equipment) => OFF_BOOK_STATUSES.includes(record.status);

/** "Ghi tăng" — mở form lập phiếu nhập; chỉ hiện với người lập được phiếu nhập. */
function IntakeButton() {
  const { data } = useCan({ resource: "equipment_intakes", action: "create" });
  if (!data?.can) return null;
  return (
    <Button asChild>
      <Link to="/equipment-intakes/create">
        <PackagePlus />
        Ghi tăng
      </Link>
    </Button>
  );
}
