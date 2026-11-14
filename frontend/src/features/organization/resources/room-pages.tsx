import type { HttpError } from "@refinedev/core";
/* eslint-disable @typescript-eslint/no-explicit-any -- các ô nhập khai `Control<any>` (xem `asControl`) */
import { useShow } from "@refinedev/core";
import { useTable } from "@refinedev/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import { useEffect, useMemo } from "react";
import type { Control } from "react-hook-form";
import { useForm } from "@refinedev/react-hook-form";

import { DeleteButton } from "@/shared/components/buttons/delete";
import { EditButton } from "@/shared/components/buttons/edit";
import { ShowButton } from "@/shared/components/buttons/show";
import { DataTable, RESIZABLE_COLUMN_DEFAULTS } from "@/shared/components/data-table/data-table";
import { DataTableQuickFilter } from "@/shared/components/data-table/data-table-quick-filter";
import { OptionFilter, RefFilter, SchoolFilter, SortSelect } from "@/shared/components/data-table/ref-filter";
import { RowActions, ROW_ACTIONS_COLUMN } from "@/shared/components/data-table/row-actions";
import { ReadField } from "@/shared/components/form/read-field";
import { LoadingOverlay } from "@/shared/components/layout/loading-overlay";
import { isRecordMissing, RecordNotFound } from "@/shared/components/views/record-not-found";
import { RouteDialog } from "@/shared/components/views/route-dialog";
import { ListToolbar, ListView, ListViewHeader } from "@/shared/components/views/list-view";
import { DEFAULT_PAGE_SIZE, formatDateTime } from "@/shared/lib/format";
import { FACILITY_CONDITION_VARIANTS, ROOM_USAGE_VARIANTS } from "@/shared/lib/status-variants";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { DialogClose } from "@/shared/ui/dialog";
import { Form } from "@/shared/ui/form";
import { CONDITION_LABELS, USAGE_STATUS_LABELS } from "@/domains/facility/types";
import {
  CONDITION_OPTIONS,
  USAGE_STATUS_OPTIONS,
  type Room,
} from "@/domains/facility/room";
import {
  RoomFields,
  ROOM_DEFAULTS,
  roomToForm,
  toRoomCreatePayload,
  toRoomPatchPayload,
  type RoomFormValues,
} from "@/features/organization/resources/room-fields";
import { schoolColumn } from "@/shared/components/form/school-field";

const RESOURCE = "rooms";

const ROOM_SORTS = [
  { label: "Theo trường, rồi tên phòng", field: "name", order: "asc" as const },
  { label: "Mới thêm gần đây", field: "createdAt", order: "desc" as const },
  { label: "Mã phòng A–Z", field: "code", order: "asc" as const },
];

const conditionCell = {
  id: "condition",
  header: "Hiện trạng",
  enableSorting: false,
  size: 130,
  cell: ({ row }: { row: { original: Room } }) => {
    const value = row.original.condition;
    if (!value) return <span className="text-muted-foreground">Chưa đánh giá</span>;
    return <Badge variant={FACILITY_CONDITION_VARIANTS[value] ?? "neutral"}>{CONDITION_LABELS[value] ?? value}</Badge>;
  },
};

const usageCell = {
  id: "usageStatus",
  header: "Sử dụng",
  enableSorting: false,
  size: 150,
  cell: ({ row }: { row: { original: Room } }) => {
    const value = row.original.usageStatus;
    if (!value) return <span className="text-muted-foreground">—</span>;
    return <Badge variant={ROOM_USAGE_VARIANTS[value] ?? "neutral"}>{USAGE_STATUS_LABELS[value] ?? value}</Badge>;
  },
};

/**
 * Danh sách phòng (TC-02). Cột Trường đứng ngay sau tên phòng: với người xem nhiều trường (quản trị, Sở) thì
 * "phòng của trường nào" là thứ phải thấy đầu tiên, không phải thứ phải cuộn ngang mới tới.
 */
const area = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });

export const RoomList = () => {
  const columns = useMemo(() => {
    const h = createColumnHelper<Room>();
    return [
      h.accessor("code", {
        id: "code",
        header: "Mã",
        enableSorting: true,
        size: 110,
        cell: ({ getValue }) => <span className="font-mono text-xs">{getValue()}</span>,
      }),
      h.accessor("name", {
        id: "name",
        header: "Phòng",
        enableSorting: true,
        cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
      }),
      schoolColumn as never,
      h.display({
        id: "building",
        header: "Khối nhà",
        enableSorting: false,
        size: 120,
        cell: ({ row }) => row.original.building ?? <span className="text-muted-foreground">—</span>,
      }),
      h.display({
        id: "floor",
        header: "Tầng",
        enableSorting: false,
        size: 80,
        cell: ({ row }) => row.original.floor ?? <span className="text-muted-foreground">—</span>,
      }),
      h.display({
        id: "roomType",
        header: "Loại phòng",
        enableSorting: false,
        size: 150,
        cell: ({ row }) =>
          row.original.roomType ? (
            <Badge variant="neutral">{row.original.roomType.name}</Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      }),
      h.display({
        id: "subject",
        header: "Môn",
        enableSorting: false,
        size: 140,
        cell: ({ row }) => row.original.subject?.name ?? <span className="text-muted-foreground">—</span>,
      }),
      h.display({
        id: "area",
        header: () => <span className="block text-right">Diện tích (m²)</span>,
        enableSorting: false,
        size: 110,
        cell: ({ row }) => (
          <span className="block text-right tabular-nums">
            {row.original.area == null ? <span className="text-muted-foreground">—</span> : area.format(row.original.area)}
          </span>
        ),
      }),
      h.display({
        id: "capacity",
        header: () => <span className="block text-right">Sức chứa</span>,
        enableSorting: false,
        size: 90,
        cell: ({ row }) => (
          <span className="block text-right tabular-nums">
            {row.original.capacity ?? <span className="text-muted-foreground">—</span>}
          </span>
        ),
      }),
      usageCell as never,
      conditionCell as never,
      h.display({
        id: "actions",
        header: () => <span className="sr-only">Thao tác</span>,
        cell: ({ row }) => (
          <RowActions>
            {row.original._can?.write !== false ? <EditButton recordItemId={row.original.id} iconOnly size="icon-sm" /> : null}
            <ShowButton recordItemId={row.original.id} iconOnly size="icon-sm" />
            {row.original._can?.delete !== false ? (
              <DeleteButton recordItemId={row.original.id} record={row.original} noun="phòng" iconOnly size="icon-sm" />
            ) : null}
          </RowActions>
        ),
        ...ROW_ACTIONS_COLUMN,
      }),
    ];
  }, []);

  const table = useTable<Room>({
    columns,
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    defaultColumn: RESIZABLE_COLUMN_DEFAULTS,
    initialState: { columnPinning: { right: ["actions"] } },
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
            search={<DataTableQuickFilter table={table} placeholder="Tìm theo mã hoặc tên phòng" />}
            filters={
              <>
                <SchoolFilter table={table} />
                <RefFilter table={table} field="roomType.id" resource="room_types" all="Mọi loại phòng" className="w-44" />
                <RefFilter table={table} field="subject.id" resource="subjects" all="Mọi môn" searchPlaceholder="Tìm môn…" className="w-44" />
                <OptionFilter table={table} field="usageStatus" all="Mọi tình trạng" options={USAGE_STATUS_OPTIONS} className="w-44" />
                <OptionFilter table={table} field="condition" all="Mọi hiện trạng" options={CONDITION_OPTIONS} className="w-40" />
                <SortSelect table={table} options={ROOM_SORTS} />
              </>
            }
          />
        }
      />
    </ListView>
  );
};

const CREATE_FORM = "room-create";
const EDIT_FORM = "room-edit";

/**
 * Loại của `control` mà các ô nhận. `Control<RoomFormValues>` không gán thẳng được cho `Control<any>` vì hàm
 * `validate` của hai bên đối nghịch tham số — form thật vẫn là form của `RoomFormValues`, chỉ là các ô khai
 * kiểu rộng hơn (chúng không biết form này có những ô nào).
 */
const asControl = (control: unknown) => control as Control<any>;

/**
 * Thân yêu cầu gửi lên máy chủ KHÔNG phải hình dạng của form: nó bỏ `active` (máy chủ suy từ tình trạng sử
 * dụng), đổi chuỗi rỗng thành `null`, và ở ngữ nghĩa patch thì bỏ hẳn khoá rỗng. `useForm` được khai theo
 * kiểu của FORM, nên chỗ nối hai hình dạng này phải nói rõ ra.
 */
const asBody = <T,>(body: T) => body as unknown as RoomFormValues;

/** Thêm phòng — hộp thoại trên chính danh sách phòng, route `/rooms/create`. */
export const RoomCreate = () => {
  const {
    refineCore: { onFinish },
    ...form
  } = useForm<Room, HttpError, RoomFormValues>({
    refineCoreProps: { resource: RESOURCE, redirect: "list" },
    defaultValues: ROOM_DEFAULTS,
  });

  return (
    <RouteDialog
      title="Thêm phòng"
      description="Mã phòng để trống thì hệ thống tự cấp theo quy tắc mã của trường."
      className="sm:max-w-[min(70rem,calc(100vw-4rem))]"
      footer={
        <>
          <DialogClose asChild>
            <Button type="button" variant="outline">Huỷ</Button>
          </DialogClose>
          <Button type="submit" form={CREATE_FORM} disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Đang lưu…" : "Thêm mới"}
          </Button>
        </>
      }
    >
      <Form {...form}>
        <form id={CREATE_FORM} onSubmit={form.handleSubmit((v) => onFinish(asBody(toRoomCreatePayload(v))))}>
          <RoomFields control={asControl(form.control)} />
        </form>
      </Form>
    </RouteDialog>
  );
};

/** Sửa phòng — hộp thoại trên danh sách, route `/rooms/edit/:id`. */
export const RoomEdit = () => {
  const {
    refineCore: { onFinish, query },
    ...form
  } = useForm<Room, HttpError, RoomFormValues>({
    refineCoreProps: { resource: RESOURCE, redirect: "list" },
    defaultValues: ROOM_DEFAULTS,
  });

  const record = query?.data?.data;
  const { reset } = form;
  // Nạp bằng `reset` để ô nào mount muộn cũng nhận giá trị; `keepDirtyValues` giữ phần đang gõ khi dữ liệu
  // được làm mới nền.
  useEffect(() => {
    if (!record) return;
    reset(roomToForm(record), { keepDirtyValues: true });
  }, [record, reset]);

  const missing = isRecordMissing(query);

  return (
    <RouteDialog
      title="Sửa phòng"
      description={record?.name ?? "Thông tin phòng"}
      className="sm:max-w-[min(70rem,calc(100vw-4rem))]"
      footer={
        <>
          <DialogClose asChild>
            <Button type="button" variant="outline">Huỷ</Button>
          </DialogClose>
          {missing ? null : (
            <Button type="submit" form={EDIT_FORM} disabled={form.formState.isSubmitting || !record}>
              {form.formState.isSubmitting ? "Đang lưu…" : "Lưu"}
            </Button>
          )}
        </>
      }
    >
      {missing ? (
        <RecordNotFound what="phòng" />
      ) : (
        <LoadingOverlay loading={query?.isLoading ?? false}>
          <Form {...form}>
            <form id={EDIT_FORM} onSubmit={form.handleSubmit((v) => onFinish(asBody(toRoomPatchPayload(v))))}>
              {/* `record` để ba ô chọn ghép được giá trị hiện tại vào danh sách tuỳ chọn — thiếu nó, ô chọn hiện
                  RỖNG đè lên giá trị thật và bấm Lưu là mất. Trường cũng khoá lại: không đổi trường sau khi tạo. */}
              <RoomFields control={asControl(form.control)} record={record} />
            </form>
          </Form>
        </LoadingOverlay>
      )}
    </RouteDialog>
  );
};

/** Xem phòng — hộp thoại trên danh sách, route `/rooms/show/:id`. Cùng thứ tự ô với form sửa. */
export const RoomShow = () => {
  const { query } = useShow<Room>({ resource: RESOURCE });
  const record = query.data?.data;

  if (isRecordMissing(query)) {
    return (
      <RouteDialog title="Chi tiết phòng" description="Phòng">
        <RecordNotFound what="phòng" />
      </RouteDialog>
    );
  }

  return (
    <RouteDialog
      title="Chi tiết phòng"
      description={record?.name ?? "Thông tin phòng"}
      className="sm:max-w-2xl"
      footer={record?._can?.write !== false ? <EditButton recordItemId={record?.id}>Sửa</EditButton> : null}
    >
      <LoadingOverlay loading={query?.isLoading ?? false}>
        {record ? (
          <div className="grid gap-5 sm:grid-cols-2">
            <ReadField label="Trường">{record.school?.name}</ReadField>
            <ReadField label="Mã phòng">
              <span className="font-mono">{record.code}</span>
            </ReadField>
            <ReadField label="Tên phòng">{record.name}</ReadField>
            <ReadField label="Loại phòng">{record.roomType?.name}</ReadField>
            <ReadField label="Môn (phòng bộ môn)">{record.subject?.name}</ReadField>
            <ReadField label="Hiện trạng">
              {record.condition ? (
                <Badge variant={FACILITY_CONDITION_VARIANTS[record.condition] ?? "neutral"}>
                  {CONDITION_LABELS[record.condition] ?? record.condition}
                </Badge>
              ) : undefined}
            </ReadField>
            <ReadField label="Tình trạng sử dụng">
              {record.usageStatus ? (
                <Badge variant={ROOM_USAGE_VARIANTS[record.usageStatus] ?? "neutral"}>
                  {USAGE_STATUS_LABELS[record.usageStatus] ?? record.usageStatus}
                </Badge>
              ) : undefined}
            </ReadField>
            <ReadField label="Khối nhà">{record.building}</ReadField>
            <ReadField label="Tầng">{record.floor}</ReadField>
            <ReadField label="Vị trí">{record.location}</ReadField>
            <ReadField label="Diện tích (m²)">{record.area ?? undefined}</ReadField>
            <ReadField label="Sức chứa (người)">{record.capacity ?? undefined}</ReadField>
            <ReadField label="Đơn vị quản lý">{record.managingUnit}</ReadField>
            <ReadField label="Ghi chú">{record.note || undefined}</ReadField>
            <ReadField label="Cập nhật lần cuối" className="sm:col-span-2">
              {formatDateTime(record.updatedAt ?? record.createdAt)}
            </ReadField>
          </div>
        ) : null}
      </LoadingOverlay>
    </RouteDialog>
  );
};
