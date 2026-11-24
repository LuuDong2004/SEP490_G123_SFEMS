import { useCan, useCustom, useShow } from "@refinedev/core";
import { useTable } from "@refinedev/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import { Boxes, DoorOpen, GraduationCap, IdCard, Landmark, School as SchoolIcon } from "lucide-react";
import React from "react";
import { Link, useNavigate } from "react-router";

import { FillBox } from "@/shared/components/layout/fill-box";
import { LoadingOverlay } from "@/shared/components/layout/loading-overlay";
import { ShowView, ShowViewHeader } from "@/shared/components/views/show-view";
import { isRecordMissing, RecordNotFound } from "@/shared/components/views/record-not-found";
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
import { compactMoney, count } from "@/shared/lib/chart-palette";
import { API_URL } from "@/shared/api/constants";
import { customResult } from "@/shared/hooks/use-custom-result";
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
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-muted-foreground text-xs">{label}</span>
      <div className="text-foreground text-sm font-medium break-words">{children}</div>
    </div>
  );
}

/** Số liệu gộp của các trường trực thuộc, cùng nguồn với màn Tổng quan trường học (`/school_overview`). */
type Totals = {
  staff: number;
  campuses: number;
  buildings: number;
  rooms: number;
  equipment: number;
  equipmentValue: number | string;
  classes: number;
  students: number;
};

/** Một ô trong dải số liệu: biểu tượng màu, nhãn, số lớn, dòng phụ. Bằng 0 thì ghi "Chưa khai". */
function Stat({ icon: Icon, label, value, hint, tone }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: number;
  hint?: React.ReactNode;
  tone: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 px-4 py-3">
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", tone)}>
        <Icon className="size-[1.125rem]" />
      </span>
      <div className="min-w-0">
        <p className="text-muted-foreground truncate text-xs">{label}</p>
        {value ? (
          <p className="text-primary text-lg leading-tight font-bold tabular-nums">{count.format(value)}</p>
        ) : (
          <p className="text-muted-foreground text-sm italic">{value == null ? "…" : "Chưa khai"}</p>
        )}
        {hint && value ? <p className="text-muted-foreground truncate text-xs">{hint}</p> : null}
      </div>
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
  // Bấm một dòng mở chi tiết TRƯỜNG đó. Không khai thì bảng mở theo resource của trang (cơ quan quản lý) với id của
  // trường, ra lỗi "không tìm thấy cơ quan quản lý".
  const navigate = useNavigate();

  // Số liệu gộp của mọi trường trực thuộc (trong phạm vi người xem): xin trang 1 dòng, chỉ đọc `totals` và `total`.
  const { result: overviewResult } = useCustom<{ totals: Totals; total: number }>({
    url: `${API_URL}/school_overview`,
    method: "get",
    config: { query: { body: record?.id, _start: 0, _end: 1 } },
    queryOptions: { enabled: mayReadSchools && Boolean(record?.id) },
  });
  const overview = customResult(overviewResult?.data, "totals");
  const totals = overview?.totals;
  const value = Number(totals?.equipmentValue ?? 0);

  const columns = React.useMemo(() => {
    const col = createColumnHelper<School>();
    return [
      col.accessor("code", {
        id: "code",
        header: "Mã trường",
        size: 130,
        meta: { fixed: true },
        enableSorting: true,
        cell: (c) => <span className="font-mono text-xs">{c.getValue()}</span>,
      }),
      col.accessor("name", {
        id: "name",
        header: "Tên trường",
        size: 260,
        meta: { fill: true },
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
        size: 110,
        meta: { fixed: true },
        cell: (c) => {
          const level = c.row.original.educationLevel;
          return level ? (
            <Badge variant="info">{level.shortName ?? level.name}</Badge>
          ) : null;
        },
      }),
      col.display({
        id: "ward",
        header: "Phường/Xã",
        size: 180,
        cell: (c) => c.row.original.ward?.name ?? c.row.original.wardText ?? null,
      }),
      col.accessor("address", { id: "address", header: "Địa chỉ", size: 340, meta: { fill: true } }),
      col.accessor("status", {
        id: "status",
        header: "Trạng thái",
        size: 170,
        meta: { fixed: true },
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

  // Mở thẳng một id không có (gõ tay, liên kết cũ, ngoài phạm vi): báo "Không tìm thấy", không vẽ trang trống.
  if (isRecordMissing(query)) {
    return (
      <ShowView>
        <ShowViewHeader canEdit={false} canDelete={false} />
        <RecordNotFound what="cơ quan quản lý" />
      </ShowView>
    );
  }

  return (
    <ShowView>
      <ShowViewHeader />
      <LoadingOverlay loading={isLoading}>
        {/* Thẻ hồ sơ cao theo nội dung, bảng trường lấp hết phần còn lại của màn (không để trắng ở đáy). */}
        <FillBox className="gap-4">
          <Card className="shrink-0 gap-0 py-0">
            <div className="flex flex-wrap items-start gap-3 px-4 py-4">
              {/* Cùng màu cấp quản lý với cây Tổng quan: Sở đỏ, UBND xanh. */}
              <span className="bg-muted flex size-11 shrink-0 items-center justify-center rounded-lg">
                <Landmark className={cn("size-6", bodyTone(record?.type ?? ""))} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-semibold">{record?.name ?? "—"}</h2>
                <p className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 text-sm">
                  <span className="font-mono">{record?.code ?? "—"}</span>
                  <span aria-hidden>·</span>
                  <span>{record?.type ? MANAGING_BODY_TYPE_LABELS[record.type] ?? record.type : "Cơ quan quản lý"}</span>
                </p>
              </div>
              {record ? (
                <Badge variant={STATUS_VARIANTS[record.status] ?? "secondary"}>
                  {STATUS_LABELS[record.status] ?? record.status}
                </Badge>
              ) : null}
            </div>

            <div className="border-border grid gap-x-6 gap-y-3 border-t px-4 py-3 sm:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr]">
              <Fact label="Địa chỉ">{record?.address || "Chưa khai"}</Fact>
              <Fact label="Tỉnh, thành phố">{record?.province || "Chưa khai"}</Fact>
              <Fact label="Ngày tạo">{record?.createdAt ? formatDateTime(record.createdAt) : "—"}</Fact>
              <Fact label="Cập nhật lần cuối">{record?.updatedAt ? formatDateTime(record.updatedAt) : "Chưa sửa"}</Fact>
            </div>

            {mayReadSchools ? (
              <div className="border-border bg-surface-subtle grid border-t sm:grid-cols-3 xl:grid-cols-5 xl:divide-x">
                <Stat icon={SchoolIcon} label="Trường trực thuộc" value={overview?.total} tone="bg-primary/10 text-primary" />
                <Stat icon={GraduationCap} label="Lớp năm học hiện hành" value={totals?.classes}
                  hint={totals?.students ? `${count.format(totals.students)} học sinh` : null} tone="bg-info-subtle text-info-text" />
                <Stat icon={IdCard} label="Cán bộ, giáo viên" value={totals?.staff} tone="bg-success-subtle text-success-text" />
                <Stat icon={DoorOpen} label="Phòng" value={totals?.rooms}
                  hint={totals ? `${count.format(totals.campuses)} cơ sở · ${count.format(totals.buildings)} khối nhà` : null}
                  tone="bg-warning-subtle text-warning-text" />
                <Stat icon={Boxes} label="Thiết bị trên hệ thống" value={totals?.equipment}
                  hint={value ? `Nguyên giá ${compactMoney.format(value)} đồng` : null} tone="bg-gold-subtle text-gold-text" />
              </div>
            ) : null}
          </Card>

          {mayReadSchools ? (
            <DataTable
              table={table}
              fill
              onRowDoubleClick={(school) => navigate(`/schools/show/${school.id}`)}
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
        </FillBox>
      </LoadingOverlay>
    </ShowView>
  );
};
