import { useCan, useShow } from "@refinedev/core";
import { useTable } from "@refinedev/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import { Landmark } from "lucide-react";
import React from "react";
import { Link } from "react-router";

import { LoadingOverlay } from "@/shared/components/layout/loading-overlay";
import { ShowView, ShowViewHeader } from "@/shared/components/views/show-view";
import {
  DataTable,
  RESIZABLE_COLUMN_DEFAULTS,
} from "@/shared/components/data-table/data-table";
import { DataTableQuickFilter } from "@/shared/components/data-table/data-table-quick-filter";
import { ListToolbar } from "@/shared/components/views/list-view";
import { bodyTone } from "@/features/organization/explorer/body-grid";
import { Badge } from "@/shared/ui/badge";
import { Card } from "@/shared/ui/card";
import { cn } from "@/shared/lib/utils";
import { formatDateTime } from "@/shared/lib/format";
import type { School } from "@/domains/school/types";
import type { DepartmentOfEducation } from "@/domains/department-of-education/types";
import {
  MANAGING_BODY_TYPE_LABELS,
  STATUS_LABELS,
} from "@/domains/department-of-education/types";
import { ORG_STATUS_VARIANTS as STATUS_VARIANTS } from "@/shared/lib/status-variants";

/**
 * Một ô thông tin trong dải đầu trang.
 *
 * <p>Nằm ngang chứ không xếp dọc: bảy thông tin xếp thành hai cột thì chiếm
 * gần nửa màn hình trước khi tới thứ người ta vào đây để xem — danh sách
 * trường. Một dải mỏng chạy ngang đưa chúng xuống còn hai dòng.
 */
function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <div className="text-foreground truncate text-sm font-medium">{children}</div>
    </div>
  );
}

/**
 * Chi tiết một cơ quan quản lý: đầu trang là hồ sơ, thân trang là các trường
 * nó quản lý.
 *
 * <p>Khung trường trực thuộc trước đây là một danh sách `ul` cắt cứng ở 20
 * dòng: Sở quản lý 108 trường nên nó chỉ cho xem được một phần năm, không lọc
 * được, không sắp xếp được, và mỗi dòng chỉ chiếm một phần ba chiều ngang nên
 * hai phần ba còn lại bỏ trắng. Giờ nó là một BẢNG thật với đủ bộ lọc, sắp
 * xếp, chọn cột, xuất file và phân trang — vì "những trường nào thuộc đơn vị
 * này" mới là câu hỏi mà trang này tồn tại để trả lời.
 */
export const DepartmentOfEducationShow = () => {
  const { result: record, query } = useShow<DepartmentOfEducation>({});
  const { isLoading } = query;

  /**
   * Đọc trường là một quyền RIÊNG so với đọc cơ quan quản lý, nên truy vấn
   * được gác lại thay vì để nó hỏng kèm một toast. Mục này nói ra sự vắng mặt
   * thay vì hiện một bảng rỗng đọc như "đơn vị này không có trường nào".
   */
  const mayReadSchools = useCan({ resource: "schools", action: "list" }).data?.can ?? false;

  const columns = React.useMemo(() => {
    const col = createColumnHelper<School>();
    return [
      col.accessor("code", {
        id: "code",
        header: "Mã trường",
        size: 160,
        enableSorting: true,
        cell: (c) => <span className="font-mono text-xs">{c.getValue()}</span>,
      }),
      col.accessor("name", {
        id: "name",
        header: "Tên trường",
        size: 380,
        enableSorting: true,
        cell: (c) => (
          <Link
            to={`/schools/show/${c.row.original.id}`}
            className="font-medium hover:underline"
          >
            {c.getValue()}
          </Link>
        ),
      }),
      col.display({
        id: "educationLevel",
        header: "Cấp học",
        size: 120,
        cell: (c) => {
          const level = c.row.original.educationLevel;
          return level ? (
            <Badge variant="neutral">{level.shortName ?? level.name}</Badge>
          ) : null;
        },
      }),
      col.display({
        id: "ward",
        header: "Phường/Xã",
        size: 200,
        cell: (c) => c.row.original.ward?.name ?? c.row.original.wardText ?? null,
      }),
      col.accessor("address", { id: "address", header: "Địa chỉ", size: 320 }),
      col.accessor("status", {
        id: "status",
        header: "Trạng thái",
        size: 140,
        cell: (c) => (
          <Badge variant={STATUS_VARIANTS[c.getValue()] ?? "secondary"}>
            {STATUS_LABELS[c.getValue()] ?? c.getValue()}
          </Badge>
        ),
      }),
    ];
  }, []);

  const table = useTable<School>({
    columns,
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    defaultColumn: RESIZABLE_COLUMN_DEFAULTS,
    refineCoreProps: {
      resource: "schools",
      // `filters.permanent`: bộ lọc này thuộc về CHÍNH TRANG chứ không phải
      // người dùng, nên ô tìm và ô lọc không thể gỡ nó ra để lộ trường của
      // đơn vị khác.
      filters: {
        permanent: record?.id
          ? [
              {
                field: "departmentOfEducation.id",
                operator: "eq" as const,
                value: record.id,
              },
            ]
          : [],
      },
      sorters: { initial: [{ field: "name", order: "asc" }] },
      // Không đồng bộ với địa chỉ: đây là bảng phụ của một trang chi tiết, và
      // ghi bộ lọc của nó lên URL sẽ đá nhau với chính id đang nằm trên đó.
      syncWithLocation: false,
      queryOptions: { enabled: mayReadSchools && Boolean(record?.id) },
    },
  });

  return (
    <ShowView>
      <ShowViewHeader />
      <LoadingOverlay loading={isLoading}>
        <div className="flex flex-col gap-4">
          <Card className="gap-0 py-0">
            <div className="flex flex-wrap items-start gap-3 px-4 py-4">
              {/* Cùng màu cấp quản lý với cây Tổng quan: Sở đỏ, UBND xanh.
                  Mở một đơn vị từ cây mà biểu tượng đổi màu thì người đọc phải
                  đối chiếu lại tên để chắc mình vào đúng chỗ. */}
              <span className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg">
                <Landmark className={cn("size-5", bodyTone(record?.type ?? ""))} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-xl font-semibold">{record?.name ?? "—"}</h2>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {record?.type
                    ? MANAGING_BODY_TYPE_LABELS[record.type] ?? record.type
                    : "Cơ quan quản lý"}
                  {record?.province ? ` · ${record.province}` : ""}
                </p>
              </div>
              {record ? (
                <Badge variant={STATUS_VARIANTS[record.status] ?? "secondary"}>
                  {STATUS_LABELS[record.status] ?? record.status}
                </Badge>
              ) : null}
            </div>

            <div className="border-border bg-surface-subtle grid gap-4 border-t px-4 py-3 sm:grid-cols-2 xl:grid-cols-4">
              <Fact label="Mã">
                <span className="font-mono text-xs font-medium">{record?.code ?? "—"}</span>
              </Fact>
              <Fact label="Địa chỉ">{record?.address ?? "—"}</Fact>
              <Fact label="Ngày tạo">
                {record?.createdAt ? formatDateTime(record.createdAt) : "—"}
              </Fact>
              <Fact label="Cập nhật lần cuối">
                {record?.updatedAt ? formatDateTime(record.updatedAt) : "—"}
              </Fact>
            </div>
          </Card>

          {mayReadSchools ? (
            <DataTable
              table={table}
              toolbar={
                <ListToolbar
                  table={table}
                  search={<DataTableQuickFilter table={table} />}
                />
              }
            />
          ) : (
            <Card className="px-4 py-6">
              <p className="text-muted-foreground text-sm">
                Bạn không có quyền xem danh sách trường học.
              </p>
            </Card>
          )}
        </div>
      </LoadingOverlay>
    </ShowView>
  );
};
