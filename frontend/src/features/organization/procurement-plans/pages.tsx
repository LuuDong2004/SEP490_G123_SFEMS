import { RowActions, ROW_ACTIONS_COLUMN } from "@/shared/components/data-table/row-actions";
import { useInvalidate, useShow } from "@refinedev/core";
import { useTable } from "@refinedev/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import { useMemo } from "react";

import { DeleteButton } from "@/shared/components/buttons/delete";
import { EditButton } from "@/shared/components/buttons/edit";
import { ShowButton } from "@/shared/components/buttons/show";
import { DataTable, RESIZABLE_COLUMN_DEFAULTS } from "@/shared/components/data-table/data-table";
import { DataTableQuickFilter } from "@/shared/components/data-table/data-table-quick-filter";
import { OptionFilter, SchoolFilter, SortSelect } from "@/shared/components/data-table/ref-filter";
import { LoadingOverlay } from "@/shared/components/layout/loading-overlay";
import { CreateView, CreateViewHeader } from "@/shared/components/views/create-view";
import { ListToolbar, ListView, ListViewHeader } from "@/shared/components/views/list-view";
import { RefreshItem, ShowView, ShowViewHeader } from "@/shared/components/views/show-view";
import { DEFAULT_PAGE_SIZE } from "@/shared/lib/format";
import { PLAN_STATUS_LABELS, type ProcurementPlan } from "@/domains/procurement/types";
import { ExportButton, PlanEditor, PlanReviewButton, PlanStatusBadge, RESOURCE } from "./plan-editor";
import { StandardTraceBlock } from "../school-year/standard-trace";

const PLAN_SORTS = [
  { label: "Năm học mới nhất", field: "budgetYear", order: "desc" as const },
  { label: "Lập gần đây nhất", field: "createdAt", order: "desc" as const },
  { label: "Tên kế hoạch A–Z", field: "title", order: "asc" as const },
  { label: "Theo trạng thái", field: "status", order: "asc" as const },
];

export const ProcurementPlanList = () => {
  const columns = useMemo(() => {
    const h = createColumnHelper<ProcurementPlan>();
    return [
      h.accessor("code", { id: "code", header: "Mã", size: 140, cell: ({ getValue }) => <span className="font-mono text-xs">{getValue()}</span> }),
      h.accessor("title", { id: "title", header: "Kế hoạch", enableSorting: true }),
      h.display({ id: "body", header: "Sở", cell: ({ row }) => row.original.managingBody.name }),
      h.display({ id: "schoolYear", header: "Năm học", cell: ({ row }) => row.original.schoolYear?.name.replace(/^Năm học\s*/i, "") ?? row.original.budgetYear }),
      h.accessor("status", { id: "status", header: "Trạng thái", enableSorting: false, cell: ({ getValue }) => <PlanStatusBadge status={getValue()} /> }),
      h.display({
        id: "actions",
        header: () => <span className="sr-only">Thao tác</span>,
        cell: ({ row }) => (
          <RowActions>
            {row.original._can?.write ? <EditButton recordItemId={row.original.id} iconOnly size="icon-sm" /> : null}
            <ShowButton recordItemId={row.original.id} iconOnly size="icon-sm" />
            {row.original._can?.delete ? <DeleteButton recordItemId={row.original.id} record={row.original} iconOnly size="icon-sm" /> : null}
          </RowActions>
        ),
        ...ROW_ACTIONS_COLUMN,
      }),
    ];
  }, []);
  const table = useTable<ProcurementPlan>({
    columns,
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    defaultColumn: RESIZABLE_COLUMN_DEFAULTS,
    refineCoreProps: { syncWithLocation: true, pagination: { pageSize: DEFAULT_PAGE_SIZE } },
  });
  return (
    <ListView>
      <ListViewHeader />
      <DataTable
        table={table}
        toolbar={
          <ListToolbar
            table={table}
            search={<DataTableQuickFilter table={table} />}
            filters={
              <>
                {/* Trường: kế hoạch có đề xuất của trường đó (máy chủ lọc qua đề xuất trong kế hoạch). */}
                <SchoolFilter table={table} />
                <OptionFilter table={table} field="status" all="Mọi trạng thái" className="w-40"
                  options={Object.entries(PLAN_STATUS_LABELS).map(([value, label]) => ({ value, label }))} />
                <SortSelect table={table} options={PLAN_SORTS} />
              </>
            }
          />
        }
      />
    </ListView>
  );
};

export const ProcurementPlanCreate = () => (
  <CreateView>
    <CreateViewHeader />
    <PlanEditor />
  </CreateView>
);

/**
 * Xem và sửa là CÙNG một màn: kế hoạch nháp mà người xem thuộc Sở lập thì các ô mở để sửa ngay tại đây; còn
 * lại (đã trình, đã duyệt, Sở khác, trường) thì chỉ xem. Đường dẫn `edit` đưa về đúng màn này.
 */
export const ProcurementPlanShow = () => {
  const { result: plan, query } = useShow<ProcurementPlan>({});
  const invalidate = useInvalidate();
  const refresh = () => {
    if (!plan) return;
    invalidate({ resource: RESOURCE, invalidates: ["list", "detail"], id: plan.id });
    invalidate({ resource: "purchase_proposals", invalidates: ["list"] });
  };
  const actions = new Set(plan?._actions ?? []);
  return (
    <ShowView>
      <ShowViewHeader
        // Hàng nút chỉ giữ việc chính (Trả lại / Duyệt) và Xoá; Tải lại, In, Xuất Excel gập vào menu ⚙.
        more={
          <RowActions gear label="Thao tác khác">
            <RefreshItem resource={RESOURCE} id={plan?.id} />
            {plan ? <ExportButton plan={plan} /> : null}
          </RowActions>
        }
        actions={
          plan ? (
            <>
              {actions.has("return") ? <PlanReviewButton plan={plan} step="return" onDone={refresh} /> : null}
              {actions.has("approve") ? <PlanReviewButton plan={plan} step="approve" onDone={refresh} /> : null}
              {actions.has("delete") ? <DeleteButton recordItemId={plan.id} record={plan} /> : null}
            </>
          ) : null
        }
      />
      <LoadingOverlay loading={query.isLoading}>
        {/* `key` theo lần sửa: lưu xong, bản ghi mới về thì form dựng lại từ đúng dữ liệu đã lưu. */}
        {plan ? <PlanEditor key={`${plan.id}-${plan.updatedAt}-${plan.status}`} plan={plan} onChanged={refresh} /> : null}
        {/* Bước 7: dòng kế hoạch truy ngược về điểm trường, chuẩn thông tư, điều chỉnh, căn cứ (đề xuất lập từ chuẩn). */}
        {plan ? <div className="mt-4"><StandardTraceBlock planId={plan.id} /></div> : null}
      </LoadingOverlay>
    </ShowView>
  );
};

export const ProcurementPlanEdit = ProcurementPlanShow;
