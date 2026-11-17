import { usePerspective } from "@/shared/hooks/use-perspective";
import { isRecordMissing, RecordNotFound } from "@/shared/components/views/record-not-found";
import { Segmented } from "@/shared/components/segmented";
import { RowActions, ROW_ACTIONS_COLUMN } from "@/shared/components/data-table/row-actions";
import { DEFAULT_PAGE_SIZE, formatEditedAt } from "@/shared/lib/format";
import { useCan, useOne, useShow, type CrudFilter, useTranslate } from "@refinedev/core";
import { Pencil } from "lucide-react";
import { useForm } from "@refinedev/react-hook-form";
import { useTable } from "@refinedev/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import React, { useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";

import {
  DataTable,
  RESIZABLE_COLUMN_DEFAULTS,
} from "@/shared/components/data-table/data-table";
import { DataTableQuickFilter } from "@/shared/components/data-table/data-table-quick-filter";
import {
  ListToolbar,
  ListView,
  ListViewHeader,
  ToolbarExtrasProvider,
} from "@/shared/components/views/list-view";
import {
  CreateView,
  CreateViewHeader,
} from "@/shared/components/views/create-view";
import { EditView, EditViewHeader } from "@/shared/components/views/edit-view";
import { ShowView, ShowViewHeader } from "@/shared/components/views/show-view";
import { LoadingOverlay } from "@/shared/components/layout/loading-overlay";
import { CreateButton } from "@/shared/components/buttons/create";
import { EditButton } from "@/shared/components/buttons/edit";
import { ShowButton } from "@/shared/components/buttons/show";
import { DeleteButton } from "@/shared/components/buttons/delete";
import {
  FormActions,
  FormPanel,
} from "@/shared/components/form/form-panel";
import { Badge } from "@/shared/ui/badge";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Skeleton } from "@/shared/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { Button } from "@/shared/ui/button";
import { Form } from "@/shared/ui/form";
import { formatDateTime } from "@/shared/lib/format";
import { usePersistentState } from "@/shared/hooks/use-persistent-state";
import { useFillHeight } from "@/shared/hooks/use-fill-height";
import { cn } from "@/shared/lib/utils";
import { CatalogFields, DEFAULT_VALUES, type CatalogFormValues } from "@/shared/components/catalog/fields";
import { SuggestCode, useSuggestedCode } from "@/shared/components/catalog/use-suggested-code";
import { VoucherTwoColumn } from "@/shared/components/voucher/voucher-layout";
import { AssetCode } from "@/shared/components/asset-code";
import { FormDialog, type FormDialogState } from "@/shared/components/catalog/form-dialog";
import {
  ACTIVE_LABELS,
  type CatalogConfig,
  type CatalogShowField,
  type CatalogItem,
} from "@/shared/components/catalog/types";

/**
 * Bốn màn của một danh mục dùng chung, viết một lần.
 *
 * <p>Mỗi màn nhận `config` để lấy nhãn và ví dụ; còn LÀM VIỆC với resource
 * nào thì Refine tự suy ra từ URL, như mọi màn khác trong nền — nên các hook
 * ở đây không cần được bảo resource là gì.
 */

export function CatalogList({ config }: { config: CatalogConfig }) {
  const ListPage = config.extra?.ListPage;
  if (ListPage) return <ListPage config={config} />;
  return <CatalogTable config={config} />;
}

function CatalogTable({ config }: { config: CatalogConfig }) {
  const extra = config.extra;
  const [dialog, setDialog] = React.useState<FormDialogState>({ open: false });
  const [viewing, setViewing] = React.useState<number | null>(null);
  // Danh mục mỏng (chỉ mã, tên, trạng thái): không có màn xem — mọi thứ đã nằm trên dòng của bảng. Bấm dòng mở thẳng
  // form sửa; không có quyền sửa thì mới mở hộp xem (cỡ nhỏ).
  const thin = isThinCatalog(config);
  const mayEditAny = useCan({ resource: config.resource, action: "edit" }).data?.can ?? false;
  const openRow = (id: number) => (thin && mayEditAny ? setDialog({ open: true, id }) : setViewing(id));
  // Số hàng đứng trước trang đang xem, cho cột STT. Ref vì cột được dựng một lần
  // trước khi có `table`; ô đọc giá trị lúc vẽ nên luôn đúng trang.
  const rowOffset = React.useRef(0);
  const { perspective } = usePerspective();
  const columns = React.useMemo(() => {
    const helper = createColumnHelper<CatalogItem>();
    return [
      // Cột thứ tự đứng đầu vì đó là thứ tự danh sách đang được sắp: không
      // thấy nó thì dãy mã trông như sắp ngẫu nhiên. Danh mục có mã là số
      // (môn học) bỏ nó qua `hideIndex`: hai cột số cạnh nhau dễ đọc nhầm.
      ...(config.hideIndex ? [] : [helper.accessor("sortOrder", {
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
        // Số thứ tự của hàng trong danh sách (nối tiếp qua các trang), không phải
        // trường `sortOrder`: nhiều danh mục — thiết bị trước hết — không đặt thứ
        // tự, và một cột toàn "—" chẳng nói gì. Danh sách vẫn SẮP theo `sortOrder`.
        // Trang hiện tại lấy từ Refine (`refineCore`), không từ trạng thái phân trang
        // của TanStack — Refine phân trang ở server và không đồng bộ số trang vào đó.
        cell: ({ row }) => (
          <span className="text-muted-foreground block text-center text-sm tabular-nums">
            {rowOffset.current + row.index + 1}
          </span>
        ),
      })]),
      helper.accessor("code", {
        id: "code",
        meta: { fill: !extra?.codeSize, fixed: !!extra?.codeFixed },
        ...(extra?.codeSize ? { size: extra.codeSize, minSize: extra.codeSize } : {}),
        header: config.codeLabel ?? "Mã",
        enableSorting: true,
        cell: ({ getValue }) => extra?.assetCode ? <AssetCode code={getValue()} /> : (
          <span className="text-sm font-medium tabular-nums">{getValue()}</span>
        ),
      }),
      helper.accessor("name", {
        id: "name",
        enableResizing: true,
        meta: { fill: true },
        header: extra?.nameColumn?.header ?? config.nameLabel ?? "Tên",
        enableSorting: true,
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.name}</span>
            {extra?.nameColumn?.subline ? (
              extra.nameColumn.subline(row.original)
            ) : row.original.note ? (
              <span className="text-muted-foreground line-clamp-1 text-xs">
                {row.original.note}
              </span>
            ) : null}
          </div>
        ),
      }),
      // Cột riêng của danh mục (nếu có), ngay sau cột Tên. Cột "Trường" chỉ có nghĩa với người xem nhiều
      // trường: ở góc nhìn của một trường mọi dòng đều ghi cùng một tên — bỏ, như danh sách phiếu.
      ...((extra?.columns ?? []) as ReturnType<typeof helper.display>[])
        .filter((c) => !(perspective === "school" && c.id === "school")),
      ...(extra?.hideActiveColumn || extra?.hideActive ? [] : [helper.accessor("active", {
        id: "active",
        // Chỉ chứa một nhãn ngắn: rộng cố định, phần dư của bảng để cho các cột chữ (mã, tên, cột riêng).
        size: 160,
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
      })]),
      helper.display({
        id: "actions",
        header: () => <span className="sr-only">Thao tác</span>,
        cell: ({ row }) => (
          <RowActions>
            <EditButton
              recordItemId={row.original.id}
              iconOnly
              size="icon-sm"
              onClick={config.pageForm && !config.formDialog ? undefined : () => setDialog({ open: true, id: row.original.id })}
            />
            {thin ? null : (
              <ShowButton
                recordItemId={row.original.id}
                iconOnly
                size="icon-sm"
                onClick={config.pageForm ? undefined : () => setViewing(row.original.id)}
              />
            )}
            {/* Cùng luật với màn chi tiết: bản ghi feature nói là không xoá được thì menu dòng cũng không có Xoá. */}
            {config.extra?.canDelete && !config.extra.canDelete(row.original) ? null : (
              <DeleteButton recordItemId={row.original.id} record={row.original} iconOnly size="icon-sm" />
            )}
          </RowActions>
        ),
        enableSorting: false,
        ...ROW_ACTIONS_COLUMN,
      }),
    ];
  }, [extra, config.codeLabel, config.nameLabel, config.pageForm, config.hideIndex, perspective, thin]);

  // Bộ lọc của cột trái (nếu danh mục có). Lần báo đầu tiên là trạng thái được
  // khôi phục sau F5 — không đưa về trang 1, kẻo mất trang vừa khôi phục.
  const [asideFilters, setAsideFilters] = React.useState<CrudFilter[]>([]);
  const asideReported = React.useRef(false);

  // Chế độ xem (tổng hợp / từng bản ghi) — nhớ lâu dài, là sở thích của người dùng.
  const views = extra?.ListViews ?? [];
  const [viewKey, setViewKey] = usePersistentState(`list.view.${config.resource}`, views[0]?.key ?? "items", "local");
  const view = views.find((v) => v.key === viewKey);
  // Bấm một dòng tổng hợp: mở bảng từng bản ghi với bộ lọc thêm, hiện thành một chip gỡ được.
  // Màn khác cũng mở được thẳng bảng từng bản ghi đã lọc sẵn: `?drill=<trường>:<giá trị>&drillLabel=<chữ>`
  // (vd. phiếu ghi tăng → "Xem tài sản" của đúng phiếu đó). Đọc MỘT lần lúc mở màn — `syncWithLocation`
  // của bảng viết lại địa chỉ ngay sau đó.
  const [drill, setDrill] = React.useState<{ filters: CrudFilter[]; label: string } | null>(() => {
    const query = new URLSearchParams(window.location.search);
    const [field, value] = (query.get("drill") ?? "").split(":");
    if (!field || !value) return null;
    return { filters: [{ field, operator: "eq", value }], label: query.get("drillLabel") ?? value };
  });
  const drilledFromUrl = React.useRef(drill !== null);
  React.useEffect(() => {
    // Màn mở mặc định ở dạng tổng hợp; đã có bộ lọc từ địa chỉ thì phải sang bảng từng bản ghi mới thấy.
    if (drilledFromUrl.current && views.length) setViewKey("items");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ lúc mở màn
  }, []);
  // Có cột trái: hai cột cao bằng nhau, lấp phần còn lại của cửa sổ; bảng cuộn bên trong.
  const fillBox = useFillHeight();
  const fill = !!extra?.ListAside;

  const table = useTable({
    columns,
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    defaultColumn: RESIZABLE_COLUMN_DEFAULTS,
    initialState: { columnPinning: { right: ["actions"] } },
    refineCoreProps: {
      syncWithLocation: true,
      pagination: { pageSize: DEFAULT_PAGE_SIZE },
      // Không khai thì không gửi `_sort`, máy chủ xếp theo thứ tự hiển thị rồi tên.
      ...(config.defaultSort ? { sorters: { initial: [config.defaultSort] } } : {}),
      filters: { permanent: [...asideFilters, ...(drill?.filters ?? [])] },
      // Đang ở chế độ tổng hợp — hoặc feature thay bảng này bằng bảng riêng — thì không tải nó.
      queryOptions: { enabled: !view && !extra?.ItemsView },
    },
  });
  const onAsideFilters = (filters: CrudFilter[]) => {
    setAsideFilters(filters);
    if (asideReported.current) table.refineCore.setCurrentPage(1);
    asideReported.current = true;
  };
  rowOffset.current = (table.refineCore.currentPage - 1) * table.refineCore.pageSize;

  const viewSwitch = views.length ? (
    <Segmented label="Chế độ xem" value={view?.key ?? "items"}
      options={[...views.map((v) => ({ value: v.key, label: v.label, hint: v.hint })),
        { value: "items", label: extra?.itemsLabel ?? "Danh sách", hint: extra?.itemsHint ?? "Bảng từng bản ghi" }]}
      onChange={(key) => {
        setViewKey(key);
        // Bấm một chế độ xem (kể cả "Theo tài sản") là xem lại toàn bộ — bỏ lọc mở từ dòng tổng hợp.
        setDrill(null);
      }} />
  ) : null;

  const itemsTable = extra?.ItemsView ? (
    <extra.ItemsView
      filters={[...asideFilters, ...(drill?.filters ?? [])]}
      fill={fill}
      externallyFiltered={asideFilters.length > 0 || !!drill}
    />
  ) : (
    <DataTable
      table={table}
      externallyFiltered={asideFilters.length > 0 || !!drill}
      fill={fill || undefined}
      onRowDoubleClick={config.pageForm ? undefined : (r) => openRow(r.id)}
      toolbar={
        // Không có lọc nâng cao: ô tìm (mã, tên — không phân biệt dấu) và cột trái đã đủ cho danh mục.
        <ListToolbar table={table} search={<DataTableQuickFilter table={table} />} />
      }
    />
  );
  // Nút của màn (Tra cứu, In tem, Thêm mới...). Có chế độ xem thì chúng đứng CÙNG HÀNG với
  // nút chọn chế độ, mép phải — không chiếm riêng một hàng phía trên.
  const headerActions = (
    <>
      {extra?.ListActions ? <extra.ListActions /> : null}
      {extra?.hideCreate ? null : config.pageForm && !config.formDialog ? <CreateButton /> : <CreateButton onClick={() => setDialog({ open: true })} />}
    </>
  );
  // Nút chọn chế độ xem và nút của màn nằm NGAY TRONG hàng công cụ của bảng
  // (cùng hàng với ô tìm) — một hàng riêng phía trên chỉ đẩy bảng xuống.
  const dataTable = views.length ? (
    <ToolbarExtrasProvider
      lead={viewSwitch}
      trail={headerActions}
      menu={extra?.ListMenu ? <extra.ListMenu /> : undefined}
    >
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <h1 className="sr-only">{config.label}</h1>
      {view
        ? <div className="flex min-h-0 flex-1 flex-col">{view.render({
            filters: asideFilters,
            drill: (filters, label) => {
              setDrill({ filters, label });
              setViewKey("items");
              table.refineCore.setCurrentPage(1);
            },
          })}</div>
        : itemsTable}
    </div>
    </ToolbarExtrasProvider>
  ) : (
    itemsTable
  );

  return (
    <ListView>
      {views.length ? null : <ListViewHeader canCreate={false} actions={headerActions} />}
      {config.pageForm && config.formDialog ? (
        <CatalogFormDialog config={config} state={dialog} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))} />
      ) : null}
      {extra?.RecordDialog ? (
        <extra.RecordDialog
          state={dialog.open ? { mode: dialog.id ? "edit" : "create", id: dialog.id } : viewing != null ? { mode: "view", id: viewing } : null}
          onClose={() => {
            setDialog({ open: false });
            setViewing(null);
          }}
        />
      ) : config.pageForm ? null : (
        <>
          <CatalogFormDialog config={config} state={dialog} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))} />
          <CatalogShowDialog
            config={config}
            id={viewing}
            onOpenChange={(open) => !open && setViewing(null)}
            onEdit={(id) => {
              setViewing(null);
              setDialog({ open: true, id });
            }}
          />
        </>
      )}
      {extra?.ListAside ? (
        <div
          ref={fillBox.ref}
          style={{ height: fillBox.height }}
          // Cột trái có thể tự ẩn (vd. Thiết bị: phạm vi chưa có thiết bị nào thì không có gì để lọc) — khi đó bảng
          // chiếm cả bề ngang thay vì đứng trong cột thứ hai bên một khoảng trống.
          className="grid gap-4 lg:grid-cols-[15rem_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:[&:not(:has(>aside))]:grid-cols-[minmax(0,1fr)]"
        >
          <extra.ListAside onFiltersChange={onAsideFilters} />
          <div className="flex min-h-0 min-w-0 flex-col">{dataTable}</div>
        </div>
      ) : (
        dataTable
      )}
    </ListView>
  );
}

/**
 * Giá trị điền sẵn từ query string dạng `?school.id=3&room.id=7` — màn Tổng
 * quan mở form thêm mới cho ĐÚNG trường/phòng đang xem, người dùng khỏi chọn lại.
 */
function presetsFrom(params: URLSearchParams): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  params.forEach((value, key) => {
    const m = /^(\w+)\.id$/.exec(key);
    const id = Number(value);
    if (m && Number.isInteger(id) && id > 0) out[m[1]] = { id };
  });
  return out;
}

/**
 * Danh mục thêm / sửa bằng HỘP THOẠI (mặc định, và `formDialog`): đường dẫn `/x/create`, `/x/edit/:id` — mở từ liên
 * kết, thanh tìm kiếm, nút "Thêm" ở nơi khác — hiện danh sách kèm hộp thoại đang mở, cùng một form với nút Thêm trên
 * danh sách. Không còn một trang form riêng kiểu cũ. Đóng / lưu xong: quay về chỗ vừa đi (vd. Tổng quan trường), không
 * có lịch sử thì về danh sách.
 */
function CatalogRouteDialog({ config, editing }: { config: CatalogConfig; editing?: boolean }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { id } = useParams();
  const [open, setOpen] = React.useState(true);
  const leave = () => {
    setOpen(false);
    if (window.history.length > 1) navigate(-1);
    else navigate(config.path);
  };
  const RecordDialog = config.extra?.RecordDialog;
  if (RecordDialog) {
    return (
      <>
        <CatalogList config={config} />
        <RecordDialog state={open ? { mode: editing && id ? "edit" : "create", id: editing && id ? Number(id) : undefined } : null}
          onClose={leave} />
      </>
    );
  }
  return (
    <>
      <CatalogList config={config} />
      <CatalogFormDialog
        config={config}
        state={{ open, id: editing && id ? Number(id) : undefined }}
        presets={editing ? undefined : presetsFrom(params)}
        onOpenChange={(o) => {
          if (!o) leave();
        }}
        onSaved={leave}
      />
    </>
  );
}

/** Form thêm / sửa mở bằng hộp thoại, hay còn là trang riêng (`pageForm` không kèm `formDialog`, vd. hồ sơ thiết bị). */
const usesDialog = (config: CatalogConfig) => !config.pageForm || !!config.formDialog;

export function CatalogCreate({ config }: { config: CatalogConfig }) {
  return usesDialog(config) ? <CatalogRouteDialog config={config} /> : <CatalogCreatePage config={config} />;
}

function CatalogCreatePage({ config }: { config: CatalogConfig }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const extra = config.extra;
  const {
    refineCore: { onFinish },
    ...form
  } = useForm({
    // Dữ liệu trường (ẩn khỏi menu) vào từ màn Tổng quan: lưu xong quay lại
    // đúng chỗ đó thay vì rơi vào màn danh sách rời. Danh mục có màn hồ sơ riêng
    // (`extra.Detail`, vd. thiết bị): lưu xong ở lại hồ sơ vừa lưu, không ra danh sách.
    refineCoreProps: config.hidden
      ? { redirect: false, onMutationSuccess: () => navigate(-1) }
      : extra?.Detail
        ? { redirect: "show" }
        : {},
    defaultValues: {
      ...DEFAULT_VALUES,
      ...(extra?.defaults ?? {}),
      ...presetsFrom(params),
    } as CatalogFormValues,
  });
  const suggestedCode = useSuggestedCode(config.resource, form, !config.hideCode);

  return (
    <CreateView>
      <CreateViewHeader />
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((values: CatalogFormValues) => onFinish(values))}
          className="w-full"
        >
          {extra?.FormBody && extra.FormSide ? (
            <VoucherTwoColumn
              main={<extra.FormBody control={form.control} config={config} suggestedCode={suggestedCode} />}
              side={<extra.FormSide control={form.control} config={config} mode="create"
                submitting={form.formState.isSubmitting} onCancel={() => navigate(-1)} />}
            />
          ) : extra?.FormBody ? (
            <div className="grid gap-4">
              <extra.FormBody control={form.control} config={config} suggestedCode={suggestedCode} />
              {/* Thanh lưu dính đáy: form dài nhiều thẻ, nút Lưu luôn trong tầm tay. */}
              <div className="bg-card shadow-e2 sticky bottom-3 z-10 flex flex-row-reverse flex-wrap items-center gap-2 rounded-lg border px-4 py-3">
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? "Đang lưu…" : "Lưu"}
                </Button>
                <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                  Huỷ
                </Button>
              </div>
            </div>
          ) : (
          <FormPanel contentClassName="space-y-6">
            <CatalogFields
              control={form.control}
              config={config}
              creating
              suggestedCode={suggestedCode}
              extra={
                extra && {
                  ...extra.section,
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  content: <extra.Fields control={form.control as any} />,
                }
              }
            />
            <FormActions>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Đang lưu…" : "Lưu"}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                Huỷ
              </Button>
            </FormActions>
          </FormPanel>
          )}
        </form>
      </Form>
    </CreateView>
  );
}

export function CatalogEdit({ config }: { config: CatalogConfig }) {
  return usesDialog(config) ? <CatalogRouteDialog config={config} editing /> : <CatalogEditPage config={config} />;
}

/** Id của form sửa — nút Lưu trên đầu trang (ngoài `<form>`) nộp form qua thuộc tính `form`. */
const EDIT_FORM_ID = "catalog-edit-form";

function CatalogEditPage({ config }: { config: CatalogConfig }) {
  const navigate = useNavigate();
  const extra = config.extra;
  const {
    refineCore: { onFinish, query },
    ...form
  } = useForm({
    // Dữ liệu trường (ẩn khỏi menu) vào từ màn Tổng quan: lưu xong quay lại
    // đúng chỗ đó thay vì rơi vào màn danh sách rời. Danh mục có màn hồ sơ riêng
    // (`extra.Detail`, vd. thiết bị): lưu xong ở lại hồ sơ vừa lưu, không ra danh sách.
    refineCoreProps: config.hidden
      ? { redirect: false, onMutationSuccess: () => navigate(-1) }
      : extra?.Detail
        ? { redirect: "show" }
        : {},
    defaultValues: { ...DEFAULT_VALUES, ...(extra?.defaults ?? {}) } as CatalogFormValues,
  });
  const record = query?.data?.data;

  /**
   * Nạp form bằng `reset` chứ không dựa vào lần nạp một-lần của Refine: trường
   * riêng (ô chọn cấp học...) nằm trong component con và có thể chưa mount
   * đúng khoảnh khắc Refine nạp — bị bỏ sót thì không có gì quay lại lấy.
   * `keepDirtyValues` ngăn lần refetch nền ném đi những gì vừa gõ.
   */
  const { reset } = form;
  useEffect(() => {
    if (!record) return;
    reset(record as unknown as CatalogFormValues, { keepDirtyValues: true });
  }, [record, reset]);

  if (isRecordMissing(query)) {
    return (
      <EditView>
        <EditViewHeader />
        <RecordNotFound what="dữ liệu" />
      </EditView>
    );
  }

  // Danh mục có màn hồ sơ riêng (`extra.Detail`, vd. thiết bị): màn sửa là chính màn hồ sơ chuyển sang ô nhập, nên
  // Huỷ / Lưu đứng ở đầu trang — đúng chỗ nút "Sửa" của màn xem — thay cho thanh lưu dính đáy kéo hết bề ngang.
  const saveInHeader = !!(extra?.FormBody && !extra.FormSide && (extra.Detail || extra.saveInHeader));
  const saveButtons = (
    <>
      <Button type="button" variant="outline" onClick={() => navigate(-1)}>
        Huỷ
      </Button>
      <Button type="submit" form={EDIT_FORM_ID} disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Đang lưu…" : "Lưu thay đổi"}
      </Button>
    </>
  );

  return (
    <EditView>
      <EditViewHeader actionsSlot={saveInHeader ? saveButtons : undefined} />
      <Form {...form}>
        <form
          id={EDIT_FORM_ID}
          onSubmit={form.handleSubmit((values: CatalogFormValues) => onFinish(values))}
          className="w-full"
        >
          {extra?.FormBody && extra.FormSide ? (
            <VoucherTwoColumn
              main={<extra.FormBody control={form.control} config={config} record={record} />}
              side={<extra.FormSide control={form.control} config={config} record={record} mode="edit"
                submitting={form.formState.isSubmitting} onCancel={() => navigate(-1)} />}
            />
          ) : extra?.FormBody ? (
            <div className="grid gap-4">
              <extra.FormBody control={form.control} config={config} record={record} />
              {/* Thanh lưu dính đáy: form dài nhiều thẻ, nút Lưu luôn trong tầm tay. */}
              {saveInHeader ? null : (
                <div className="bg-card shadow-e2 sticky bottom-3 z-10 flex flex-row-reverse flex-wrap items-center gap-2 rounded-lg border px-4 py-3">
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? "Đang lưu…" : "Lưu thay đổi"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                    Huỷ
                  </Button>
                </div>
              )}
            </div>
          ) : (
          <FormPanel contentClassName="space-y-6">
            <CatalogFields
              control={form.control}
              config={config}
              extra={
                extra && {
                  ...extra.section,
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  content: <extra.Fields control={form.control as any} record={record} />,
                }
              }
            />
            <FormActions>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Đang lưu…" : "Lưu thay đổi"}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                Huỷ
              </Button>
            </FormActions>
          </FormPanel>
          )}
        </form>
      </Form>
      {/* Ngoài <form>: nút trong khối này không được nộp form sửa. */}
      {extra?.EditBelow && record ? <extra.EditBelow record={record} /> : null}
    </EditView>
  );
}

export function CatalogShow({ config }: { config: CatalogConfig }) {
  const { result: record, query } = useShow<CatalogItem>({});
  return (
    <ShowView>
      <ShowViewHeader
        more={config.extra?.ShowMore && record ? <config.extra.ShowMore record={record} /> : undefined}
        canDelete={record && config.extra?.canDelete ? config.extra.canDelete(record) : true}
        canEdit={record && config.extra?.canEdit ? config.extra.canEdit(record) : true}
      />
      <LoadingOverlay loading={query.isLoading}>
        <CatalogDetail config={config} record={record} />
      </LoadingOverlay>
    </ShowView>
  );
}

/**
 * Thân màn chi tiết của một mục danh mục ở TRANG chi tiết: cùng đầu hồ sơ và cùng thân với hộp thoại xem
 * (`CatalogDetailHeading`, `CatalogDetailSections`), trong một thẻ. Danh mục có hồ sơ riêng
 * (`extra.Detail`, vd. danh mục thiết bị) thì vẽ hồ sơ đó.
 */
export function CatalogDetail({
  config,
  record,
}: {
  config: CatalogConfig;
  record: CatalogItem | undefined;
}) {
  if (config.extra?.Detail) {
    return record ? <config.extra.Detail record={record} /> : null;
  }
  return (
    <div className="grid w-full gap-4">
      <FormPanel contentClassName="space-y-5">
        <CatalogDetailHeading config={config} record={record} />
        <div className="border-t pt-5">
          <CatalogDetailSections config={config} record={record} />
        </div>
      </FormPanel>
      {config.extra?.ShowBelow && record ? <config.extra.ShowBelow record={record} /> : null}
    </div>
  );
}

/** Ô chưa khai: trống, hoặc hàm `show` của danh mục đã tự đổi thành dấu gạch. */
const blank = (v: React.ReactNode) => v === null || v === undefined || v === "" || v === "—" || v === "-";

/** Đầu hồ sơ một mục danh mục: tên, rồi trạng thái — dùng ở tiêu đề hộp thoại xem và đầu thẻ trang chi tiết. */
function CatalogDetailHeading({ config, record }: { config: CatalogConfig; record: CatalogItem | undefined }) {
  // Danh mục không có ô Tên (lớp học): mã chính là tên, không lặp lại thành nhãn bên dưới.
  const title = config.hideName ? record?.code : record?.name;
  return (
    <div className="min-w-0 space-y-2 text-start">
      <div className="text-xl leading-snug font-semibold tracking-tight break-words">{title ?? "…"}</div>
      {/* Mã không lặp ở đây — đã có ở phần Thông tin cơ bản ngay bên dưới. */}
      {config.extra?.hideActive || !record ? null : (
        <Badge variant={record.active ? "success" : "neutral"}>{ACTIVE_LABELS[record.active ? "true" : "false"]}</Badge>
      )}
    </div>
  );
}

/**
 * Thân màn XEM một mục danh mục — chữ thường, không phải form bị khoá: các ô riêng của danh mục
 * (`extra.show`) thành lưới "nhãn nhỏ — giá trị", ô chưa khai KHÔNG hiện; rồi ghi chú (nếu có) và dòng
 * tạo lúc / sửa lần cuối. Tên, mã, trạng thái nằm ở `CatalogDetailHeading`.
 */
function CatalogDetailSections({ config, record }: { config: CatalogConfig; record: CatalogItem | undefined }) {
  const all = config.extra?.show(record) ?? [];
  // Danh mục có form chia nhóm: trang chi tiết cũng chia đúng các nhóm đó, như hộp xem.
  if (all.some((f) => f.group)) return <GroupedInfo config={config} record={record} fields={all} />;
  const shown = all.filter((f) => !blank(f.value));
  return (
    <div className="@container space-y-5">
      {shown.length ? (
        <dl className="grid gap-x-6 gap-y-4 @md:grid-cols-2 @3xl:grid-cols-4">
          {shown.map((f) => (
            <div key={f.label} className={cn("min-w-0", f.span && f.span >= 3 ? "@md:col-span-2 @3xl:col-span-4" : f.span === 2 ? "@md:col-span-2" : undefined)}>
              <dt className="text-muted-foreground text-xs">{f.label}</dt>
              <dd className="mt-0.5 text-sm font-medium break-words">{f.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {record?.note ? (
        <div className={shown.length ? "border-t pt-4" : undefined}>
          <div className="text-muted-foreground text-xs">Ghi chú</div>
          <p className="mt-0.5 text-sm break-words whitespace-pre-line">{record.note}</p>
        </div>
      ) : null}
      <p className={cn("text-muted-foreground flex flex-wrap gap-x-6 text-xs", shown.length || record?.note ? "border-t pt-3" : undefined)}>
        <span>Tạo lúc <span className="text-foreground">{record?.createdAt ? formatDateTime(record.createdAt) : "—"}</span></span>
        <span>Sửa lần cuối <span className="text-foreground">{formatEditedAt(record)}</span></span>
      </p>
    </div>
  );
}

/** Một ô "nhãn nhỏ — giá trị" của hộp xem; ô chưa khai vẫn giữ chỗ (chữ mờ "Chưa khai"). */
function InfoCell({ f }: { f: CatalogShowField }) {
  return (
    <div className={cn("min-w-0", f.span && f.span >= 3 ? "sm:col-span-3" : f.span === 2 ? "sm:col-span-2" : undefined, f.newRow && "sm:col-start-1")}>
      <dt className="text-muted-foreground text-xs">{f.label}</dt>
      <dd className={cn("mt-0.5 text-sm break-words", blank(f.value) ? "text-muted-foreground/70 italic" : "font-medium")}>
        {blank(f.value) ? "Chưa khai" : f.value}
      </dd>
    </div>
  );
}

/**
 * Hộp xem chia nhóm Y NHƯ form sửa (danh mục khai `group` cho từng ô): cùng tiêu đề nhóm có biểu tượng, cùng lưới ba
 * cột, cùng thứ tự — Mã, Tên mở đầu nhóm đầu, Ghi chú cuối nhóm cuối. Bấm Sửa thì mỗi ô nằm nguyên chỗ.
 */
function GroupedInfo({ config, record, fields }: { config: CatalogConfig; record: CatalogItem | undefined; fields: CatalogShowField[] }) {
  const groups: { title: string; icon?: CatalogShowField["groupIcon"]; items: CatalogShowField[] }[] = [];
  for (const f of fields) {
    const title = f.group ?? groups[groups.length - 1]?.title ?? "Thông tin";
    const last = groups[groups.length - 1];
    if (last?.title === title) last.items.push(f);
    else groups.push({ title, icon: f.groupIcon, items: [f] });
  }
  const head: CatalogShowField[] = [
    ...(config.hideCode ? [] : [{ label: "Mã", value: record?.code ?? "—" }]),
    ...(config.hideName ? [] : [{ label: "Tên", value: record?.name ?? "—", span: 2 as const }]),
  ];
  if (groups.length) groups[0].items = [...head, ...groups[0].items];
  return (
    <div className="space-y-4">
      {groups.map((g, i) => (
        <section key={g.title} className="space-y-3 border-b pb-4">
          <h3 className="text-muted-foreground flex items-center gap-2 text-xs font-semibold tracking-wide uppercase">
            {g.icon ? <g.icon className="text-primary size-3.5 shrink-0" /> : null}
            {g.title}
          </h3>
          <dl className="grid items-start gap-x-4 gap-y-5 sm:grid-cols-3">
            {g.items.map((f) => <InfoCell key={f.label} f={f} />)}
            {i === groups.length - 1 ? (
              <InfoCell f={{ label: "Ghi chú", value: record?.note || null, span: 3 }} />
            ) : null}
          </dl>
        </section>
      ))}
      <p className="text-muted-foreground flex flex-wrap gap-x-6 text-xs">
        <span>Tạo lúc <span className="text-foreground">{record?.createdAt ? formatDateTime(record.createdAt) : "—"}</span></span>
        <span>Sửa lần cuối <span className="text-foreground">{formatEditedAt(record)}</span></span>
      </p>
    </div>
  );
}

/**
 * Tab "Thông tin" của hộp xem: cùng nhóm, cùng thứ tự, cùng lưới ba cột với form sửa trong hộp thoại — bấm Sửa
 * thì mỗi ô nằm nguyên chỗ. Ô chưa khai vẫn có chỗ (chữ mờ "Chưa khai"), không biến mất làm xô lệch lưới.
 */
function CatalogInfoTab({ config, record }: { config: CatalogConfig; record: CatalogItem | undefined }) {
  const fields = config.extra?.show(record) ?? [];
  if (fields.some((f) => f.group)) return <GroupedInfo config={config} record={record} fields={fields} />;
  return (
    <div className="@container space-y-5">
      <section className="space-y-3">
        <h3 className="text-overline text-muted-foreground">Thông tin cơ bản</h3>
        <dl className="grid gap-x-6 gap-y-4 @sm:grid-cols-2">
          {config.hideCode ? null : (
            <div className="min-w-0">
              <dt className="text-muted-foreground text-xs">Mã</dt>
              <dd className="mt-0.5 text-sm font-medium break-words">{record?.code ?? "—"}</dd>
            </div>
          )}
          {config.hideName ? null : (
            <div className="min-w-0">
              <dt className="text-muted-foreground text-xs">Tên</dt>
              <dd className="mt-0.5 text-sm font-medium break-words">{record?.name ?? "—"}</dd>
            </div>
          )}
        </dl>
      </section>
      <section className="space-y-3 border-t pt-4">
        <h3 className="text-overline text-muted-foreground">{config.extra?.section.title ?? "Thông tin"}</h3>
        <dl className="grid gap-x-6 gap-y-4 @sm:grid-cols-2 @lg:grid-cols-3">
          {fields.map((f) => (
            <div key={f.label} className={cn("min-w-0", f.span && f.span >= 2 ? "@sm:col-span-2" : undefined, f.newRow && "@sm:col-start-1")}>
              <dt className="text-muted-foreground text-xs">{f.label}</dt>
              <dd className={cn("mt-0.5 text-sm break-words", blank(f.value) ? "text-muted-foreground/70 italic" : "font-medium")}>
                {blank(f.value) ? "Chưa khai" : f.value}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="space-y-1.5 border-t pt-4">
        <h3 className="text-overline text-muted-foreground">Ghi chú</h3>
        <p className={cn("text-sm break-words whitespace-pre-line", !record?.note && "text-muted-foreground/70 italic")}>
          {record?.note || "Không có ghi chú"}
        </p>
      </section>
      <p className="text-muted-foreground flex flex-wrap gap-x-6 border-t pt-3 text-xs">
        <span>Tạo lúc <span className="text-foreground">{record?.createdAt ? formatDateTime(record.createdAt) : "—"}</span></span>
        <span>Sửa lần cuối <span className="text-foreground">{formatEditedAt(record)}</span></span>
      </p>
    </div>
  );
}

/**
 * Xem chi tiết trong HỘP THOẠI — cho danh mục ít trường. Có nút "Sửa" mở tiếp
 * hộp thoại sửa (do màn danh sách truyền vào).
 */
/** Danh mục chỉ có mã, tên, trạng thái (không ô riêng, không tab, không khối dưới) — vd. Phường/xã. */
function isThinCatalog(config: CatalogConfig): boolean {
  const extra = config.extra;
  if (!extra) return true;
  if (extra.ShowTabs?.length || extra.ShowBelow) return false;
  try {
    return (extra.show?.({}) ?? []).length === 0;
  } catch {
    return false;
  }
}

export function CatalogShowDialog({
  config,
  id,
  onOpenChange,
  onEdit,
}: {
  config: CatalogConfig;
  id: number | null;
  onOpenChange: (open: boolean) => void;
  onEdit?: (id: number) => void;
}) {
  const { result: record, query } = useOne<CatalogItem>({
    resource: config.resource,
    id: id ?? "",
    queryOptions: { enabled: id != null },
  });
  const mayEdit = useCan({ resource: config.resource, action: "edit" }).data?.can ?? false;
  const tabs = config.extra?.ShowTabs;
  const Summary = config.extra?.ShowSummary;
  // Tab đang mở của hộp xem có "Thông tin": mở bản ghi khác thì về lại Thông tin. Nút Sửa chỉ ở tab Thông tin — tab
  // Thiết bị / Lịch sử không có gì để "sửa" (trưởng nhóm, 12/11/2026).
  const [tab, setTab] = React.useState("info");
  React.useEffect(() => setTab("info"), [id]);
  const onInfo = Summary || !tabs?.length || tab === "info";
  return (
    <Dialog open={id != null} onOpenChange={onOpenChange}>
      {/* Cùng bề rộng và cùng khung (đầu, thân cuộn, chân) với hộp Sửa: bấm Sửa thì hộp không đổi cỡ. Danh mục mỏng
          (không có ô riêng) thì hộp nhỏ, cao vừa nội dung — không để một khoảng trống lớn. */}
      {/* Có tab: cỡ cố định (chuyển tab hộp không nhảy). Không tab: cao vừa nội dung (`formFit`, cùng bề rộng hộp Sửa) —
          danh mục ít ô không còn một khoảng trắng lớn dưới thân hộp. */}
      {/* Có thân Thông tin riêng (`ShowInfo`, phòng): rộng như hộp Sửa, CAO CỐ ĐỊNH — chuyển tab hộp không co lại. */}
      <DialogContent size={config.extra?.ShowBody ? config.extra.dialogSize ?? "formFit" : isThinCatalog(config) ? "sm" : config.extra?.ShowInfo ? "formWideFixed" : Summary ? "formWide" : tabs?.length ? undefined : "formFit"} className="gap-0 p-0">
        <DialogHeader className="border-b px-6 pt-6 pb-4 pr-12">
          {/* Tiêu đề là chính mục đang xem (tên, mã, trạng thái), không phải chữ "Chi tiết …" lặp lại tên màn. */}
          <DialogTitle asChild>
            <div>
              {config.extra?.ShowHeading ? (
                <config.extra.ShowHeading record={query.isLoading ? undefined : record} />
              ) : (
                <CatalogDetailHeading config={config} record={query.isLoading ? undefined : record} />
              )}
            </div>
          </DialogTitle>
          <DialogDescription className="sr-only">Chi tiết {config.label.toLowerCase()}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {query.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : config.extra?.ShowBody && record ? (
            <config.extra.ShowBody record={record} onTab={setTab} />
          ) : Summary && record ? (
            // Thẻ tóm tắt ở trên, tab (thiết bị, QR, tệp…) ở dưới — không còn tab "Thông tin".
            <div className="space-y-5">
              <Summary record={record} />
              {tabs?.length ? (
                <Tabs defaultValue={tabs[0].key} className="gap-4">
                  <TabsList>
                    {tabs.map((t) => <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>)}
                  </TabsList>
                  {tabs.map((t) => <TabsContent key={t.key} value={t.key}><t.Content record={record} /></TabsContent>)}
                </Tabs>
              ) : null}
            </div>
          ) : tabs?.length && record ? (
            // Hồ sơ nhiều khối: tab thay cho một cột dài.
            <Tabs value={tab} onValueChange={setTab} className="gap-4">
              <TabsList>
                <TabsTrigger value="info">Thông tin</TabsTrigger>
                {tabs.map((t) => <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>)}
              </TabsList>
              <TabsContent value="info">
                {config.extra?.ShowInfo ? <config.extra.ShowInfo record={record} /> : <CatalogInfoTab config={config} record={record} />}
              </TabsContent>
              {tabs.map((t) => <TabsContent key={t.key} value={t.key}><t.Content record={record} /></TabsContent>)}
            </Tabs>
          ) : (
            <div className="space-y-6">
              <CatalogDetailSections config={config} record={record} />
              {/* Khối dưới thẻ chi tiết (tệp đính kèm…) có cả trong hộp thoại: bản ghi chỉ xem qua hộp thoại
                  (phòng, khối nhà, cơ sở ở Tổng quan trường) không có trang chi tiết nào khác để đặt nó. */}
              {config.extra?.ShowBelow && record ? <config.extra.ShowBelow record={record} /> : null}
            </div>
          )}
        </div>
        <DialogFooter className="border-t px-6 py-3">
          {config.extra?.ShowFooterNote && record && !query.isLoading ? (
            <div className="me-auto flex min-w-0 items-center"><config.extra.ShowFooterNote record={record} /></div>
          ) : null}
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Đóng
            </Button>
          </DialogClose>
          {onEdit && mayEdit && id != null && onInfo ? (
            <Button type="button" onClick={() => onEdit(id)}>
              <Pencil />
              Sửa
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Hộp thoại thêm/sửa của một danh mục ÍT trường — cùng các ô với trang thêm/sửa,
 * bố cục gọn. Mở từ màn danh sách và từ màn Tổng quan.
 */
export function CatalogFormDialog({
  config,
  state,
  onOpenChange,
  presets,
  onSaved,
}: {
  config: CatalogConfig;
  state: FormDialogState;
  onOpenChange: (open: boolean) => void;
  /** Giá trị điền sẵn khi thêm, ví dụ `{ school: { id: 3 } }`. */
  presets?: Record<string, unknown>;
  /** Gọi sau khi lưu, kèm bản ghi vừa lưu (để màn gọi chọn luôn nó). */
  onSaved?: (record?: { id?: number }) => void;
}) {
  const extra = config.extra;
  // Tiêu đề lấy cùng nguồn với tiêu đề trang (`<resource>.titles.create|edit` trong vi.json) khi có —
  // "Thêm thiết bị vào danh mục" thay cho "Thêm danh mục thiết bị".
  const translate = useTranslate();
  const titleKey = `${config.resource}.titles.${state.id ? "edit" : "create"}`;
  const translated = translate(titleKey, "");
  // Danh mục có hộp xem riêng (`ShowInfo`, phòng): bấm Sửa từ hộp xem thì đầu hộp GIỮ NGUYÊN — tên phòng, cùng cỡ chữ
  // — chỉ thêm nhãn "Đang sửa" (trưởng nhóm, 12/11/2026: tiêu đề đổi kiểu khi bấm Sửa trông như mở màn khác).
  const sameHeading = !!extra?.ShowInfo;
  const { result: editing } = useOne<CatalogItem>({
    resource: config.resource,
    id: state.id ?? "",
    queryOptions: { enabled: (sameHeading || !!extra?.FormHeading) && !!state.id },
  });
  // Phòng (mockup A, 12/11/2026): "Sửa phòng" + dòng phụ "mã · tên" của bản ghi đang sửa; thêm mới chỉ "Thêm phòng".
  const heading = extra?.FormHeading ? (
    <extra.FormHeading record={state.id ? editing : undefined} creating={!state.id} />
  ) : sameHeading ? (
    <div className="min-w-0 text-start">
      <div className="truncate text-xl leading-snug font-semibold tracking-tight">
        {state.id ? "Sửa" : "Thêm"} {config.label.toLowerCase()}
      </div>
      {state.id ? (
        <div className="text-muted-foreground truncate text-sm font-normal">
          {[editing?.code, editing?.name].filter(Boolean).join(" · ") || "…"}
        </div>
      ) : null}
    </div>
  ) : undefined;
  return (
    <FormDialog
      resource={config.resource}
      heading={heading}
      footerNote={extra?.FormFooterNote ? (control) => extra.FormFooterNote ? <extra.FormFooterNote control={control} /> : null : undefined}
      fullTitle={translated && translated !== titleKey ? translated : undefined}
      // Cùng bề rộng hộp xem, vừa ba ô chuẩn của `form-flow` trên một hàng; cao VỪA NỘI DUNG (`formFit`) — danh mục ít ô
      // không có khoảng trắng dưới form, form dài thì cuộn bên trong. Form có bố cục riêng (`FormBody`) theo `dialogSize`.
      size={extra?.FormBody ? extra.dialogSize ?? "wide" : "formFit"}
      icon={extra?.dialogHeader ? config.icon : undefined}
      description={extra?.dialogHeader ? config.description : undefined}
      title={config.label.toLowerCase()}
      state={state}
      onOpenChange={onOpenChange}
      defaultValues={{ ...DEFAULT_VALUES, ...(extra?.defaults ?? {}), ...(presets ?? {}) }}
      onSaved={onSaved}
    >
      {(control, record) => (
        <>
          {state.id || config.hideCode ? null : <SuggestCode target={config.resource} />}
          {extra?.FormBody ? (
            <extra.FormBody control={control} config={config} record={record} inDialog />
          ) : (
          <CatalogFields
            control={control}
            config={config}
            creating={!state.id}
            compact
            extra={
              extra && {
                ...extra.section,
                content: <extra.Fields control={control} record={record} />,
              }
            }
          />
          )}
        </>
      )}
    </FormDialog>
  );
}
