import { DEFAULT_PAGE_SIZE } from "@/shared/lib/format";
import { RowActions, ROW_ACTIONS_COLUMN } from "@/shared/components/data-table/row-actions";
import { useTable } from "@refinedev/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import React from "react";

import {
  DataTable,
  RESIZABLE_COLUMN_DEFAULTS,
} from "@/shared/components/data-table/data-table";
import { DataTableQuickFilter } from "@/shared/components/data-table/data-table-quick-filter";
import {
  ListToolbar,
  ListView,
  ListViewHeader,
} from "@/shared/components/views/list-view";
import { CreateButton } from "@/shared/components/buttons/create";
import { EditButton } from "@/shared/components/buttons/edit";
import { FormDialog, type FormDialogState } from "@/shared/components/catalog/form-dialog";
import { SuggestCode } from "@/shared/components/catalog/use-suggested-code";
import { DEFAULT_VALUES, EDUCATION_LEVEL_CONFIG, EducationLevelFields } from "@/features/catalogs/education-levels/fields";
import { CatalogShowDialog } from "@/shared/components/catalog/pages";
import { ShowButton } from "@/shared/components/buttons/show";
import { DeleteButton } from "@/shared/components/buttons/delete";
import { Badge } from "@/shared/ui/badge";
import type { EducationLevel } from "@/domains/education-level/types";
import { ACTIVE_LABELS } from "@/domains/education-level/types";

export const EducationLevelList = () => {
  const [dialog, setDialog] = React.useState<FormDialogState>({ open: false });
  const [viewing, setViewing] = React.useState<number | null>(null);
  const columns = React.useMemo(() => {
    const columnHelper = createColumnHelper<EducationLevel>();

    return [
      // Cột thứ tự đứng đầu vì đó là thứ tự danh sách đang được sắp: không
      // thấy nó thì dãy TH, THCS, THPT trông như sắp ngẫu nhiên.
      columnHelper.accessor("sortOrder", {
        id: "sortOrder",
        header: "STT",
        // Không sắp xếp: danh sách mặc định đã theo thứ tự này, và mũi tên sắp
        // xếp làm tiêu đề bị cắt còn "S..".
        enableSorting: false,
        // Chỉ chứa số 1-3 chữ số: cố định hẹp, không cho kéo giãn.
        size: 64,
        minSize: 64,
        maxSize: 64,
        enableResizing: false,
        cell: ({ getValue }) => (
          <span className="text-muted-foreground block text-center text-sm tabular-nums">
            {getValue() ?? "—"}
          </span>
        ),
      }),
      columnHelper.accessor("code", {
        id: "code",
        meta: { fill: true },
        header: "Mã",
        enableSorting: true,
        cell: ({ getValue }) => (
          <span className="text-sm font-medium tabular-nums">{getValue()}</span>
        ),
      }),
      columnHelper.accessor("name", {
        id: "name",
        enableResizing: true,
        meta: { fill: true },
        header: "Tên",
        enableSorting: true,
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.name}</span>
            {row.original.note ? (
              <span className="text-muted-foreground line-clamp-1 text-xs">
                {row.original.note}
              </span>
            ) : null}
          </div>
        ),
      }),
      columnHelper.accessor("shortName", {
        id: "shortName",
        header: "Tên viết tắt",
        enableSorting: true,
        cell: ({ getValue }) => (
          <span className="text-sm">{getValue() ?? "—"}</span>
        ),
      }),
      columnHelper.accessor("active", {
        id: "active",
        meta: { fill: true },
        header: "Trạng thái",
        enableSorting: true,
        cell: ({ getValue }) => {
          const active = getValue();
          return (
            <Badge variant={active ? "success" : "neutral"}>
              {ACTIVE_LABELS[active ? "true" : "false"]}
            </Badge>
          );
        },
      }),
      columnHelper.display({
        id: "actions",
        header: () => <span className="sr-only">Thao tác</span>,
        cell: ({ row }) => (
          <RowActions>
            <EditButton
              recordItemId={row.original.id}
              iconOnly
              size="icon-sm"
              onClick={() => setDialog({ open: true, id: row.original.id })}
            />
            <ShowButton
              recordItemId={row.original.id}
              iconOnly
              size="icon-sm"
              onClick={() => setViewing(row.original.id)}
            />
            <DeleteButton recordItemId={row.original.id} record={row.original} iconOnly size="icon-sm" />
          </RowActions>
        ),
        enableSorting: false,
        ...ROW_ACTIONS_COLUMN,
      }),
    ];
  }, []);

  const table = useTable({
    columns,
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    defaultColumn: RESIZABLE_COLUMN_DEFAULTS,
    // Cột thao tác là ô người ta cuộn ngang ĐỂ tới, nên nó là ô duy nhất
    // không được phép là thứ cuộn mất.
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
      <ListViewHeader
        canCreate={false}
        actions={<CreateButton onClick={() => setDialog({ open: true })} />}
      />
      <FormDialog
        resource="education_levels"
        title="cấp học"
        state={dialog}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        defaultValues={DEFAULT_VALUES}
      >
        {(control, record) => (
          <>
            {record ? null : <SuggestCode target="education_levels" />}
            <EducationLevelFields control={control} compact />
          </>
        )}
      </FormDialog>
      <CatalogShowDialog
        config={EDUCATION_LEVEL_CONFIG}
        id={viewing}
        onOpenChange={(open) => !open && setViewing(null)}
        onEdit={(id) => {
          setViewing(null);
          setDialog({ open: true, id });
        }}
      />
      <DataTable
        onRowDoubleClick={(r) => setViewing(r.id)}
        table={table}
        toolbar={
          <ListToolbar table={table} search={<DataTableQuickFilter table={table} />} />
        }
      />
    </ListView>
  );
};
