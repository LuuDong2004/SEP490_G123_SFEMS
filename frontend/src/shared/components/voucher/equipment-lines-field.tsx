import { useInfiniteList, useList, useResourceParams } from "@refinedev/core";
import { AddLinesButton, AddLinesEmpty } from "@/shared/components/voucher/add-lines";
import { IconFilter } from "@/shared/components/data-table/icon-filter";
import { useQuery } from "@tanstack/react-query";
import { Search, Trash2, TriangleAlert, Activity, DoorOpen, Boxes } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Controller, useFieldArray, useWatch, type Control } from "react-hook-form";
import { Link } from "react-router";

import { kyInstance } from "@/shared/api/data";
import { formatPlainDate } from "@/shared/lib/format";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { FormControl, FormField } from "@/shared/ui/form";
import { Input } from "@/shared/ui/input";
import { ASSET_STATUS_VARIANTS } from "@/shared/lib/status-variants";
import { maxLengthOf, textRules } from "@/shared/lib/field-rules";
import { cn } from "@/shared/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { LineDetailsButton } from "@/shared/components/voucher/voucher-details";
import { StepTitle, VoucherLinesCard } from "@/shared/components/voucher/voucher-layout";
import { LotQuantityInput } from "@/shared/components/voucher/lot-quantity-input";
import { bulkLineIssue, fmtQty, readableAmount, round3 } from "@/shared/lib/lot-pack";
import { useVoucherForm } from "@/shared/hooks/use-voucher-form";
import { ASSET_STATUS_LABELS, VOUCHER_ROUTES } from "@/domains/equipment/types";
import type { EquipmentRef } from "@/domains/voucher/types";
import { LIFT_ROW } from "@/shared/lib/row-lift";
import { TableEmpty } from "@/shared/components/data-table/table-empty";
import { LoadMore } from "@/shared/components/data-table/load-more";
import { useInfiniteScroll } from "@/shared/hooks/use-infinite-scroll";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type PickerRow = EquipmentRef & { catalog?: { name: string }; profileComplete?: boolean; missingProfile?: string[] };

/** Phiếu đang chạy giữ một tài sản (`GET /api/voucher_holds`, máy chủ `VoucherHolds`). */
type Hold = { equipmentId: number; label: string; code: string | null; pending: boolean };
const holdText = (h: Hold) => `Đang ở ${h.label}${h.code ? ` ${h.code}` : ""} (${h.pending ? "chờ duyệt" : "đang thực hiện"})`;

/** Phiếu NHÁP khác cùng loại đã có tài sản này (`GET /api/voucher_holds/drafts`) — chỉ để nhắc, không chặn. */
type Draft = { equipmentId: number; voucherId: number; createdDate: string };
/** Loại phiếu cần nhắc lập trùng (vd. báo hỏng một tivi hai lần) và phiếu đang sửa — không tính chính nó. */
export type DraftCheck = { resource: string; voucherId?: number | null };
const draftText = (d: Draft) => `Đã có trên phiếu nháp khác (lập ${formatPlainDate(d.createdDate)})`;

/** Tài sản nào trong `ids` (nối bằng dấu phẩy) đã nằm trên phiếu nháp khác — mỗi tài sản lấy phiếu nháp lập sớm nhất. */
function useDraftDuplicates(check: DraftCheck | undefined, ids: string, enabled = true): Map<number, Draft> {
  const { data } = useQuery({
    queryKey: ["voucher_drafts", check?.resource, check?.voucherId ?? null, ids],
    queryFn: () =>
      kyInstance
        .get("voucher_holds/drafts", {
          searchParams: { resource: check!.resource, equipmentIds: ids, ...(check?.voucherId ? { exceptId: check.voucherId } : {}) },
        })
        .json<Draft[]>(),
    enabled: enabled && !!check && ids !== "",
  });
  const byEquipment = new Map<number, Draft>();
  for (const d of data ?? []) if (!byEquipment.has(d.equipmentId)) byEquipment.set(d.equipmentId, d);
  return byEquipment;
}

/** Chỉ tài sản hồ sơ chuẩn mới vào được phiếu — máy chủ cũng từ chối lúc trình. */
const usable = (r: PickerRow) => r.profileComplete !== false;

/**
 * Các dòng phiếu trỏ tới TỪNG tài sản — cấp phát, điều chuyển, mượn, báo hỏng,
 * thanh lý đều dùng.
 *
 * <p>Thêm tài sản bằng một hộp chọn nhiều, không phải một ô chọn mỗi dòng: phiếu
 * cấp phát 30 máy tính cho phòng máy là việc tick 30 ô trong một bảng lọc sẵn,
 * không phải mở 30 danh sách thả xuống. Hộp chọn chỉ liệt kê tài sản của đúng
 * trường và đúng trạng thái mà loại phiếu động tới được — server vẫn kiểm lại,
 * đây chỉ là để không mời người dùng chọn thứ sẽ bị từ chối.
 *
 * @param statuses  trạng thái được chọn (vd. cấp phát: chỉ "trong kho")
 * @param extra     ô riêng mỗi dòng (vd. tình trạng lúc giao của phiếu điều chuyển)
 * @param extraHeader tiêu đề cột của ô riêng đó
 * @param lineDefaults trường chứng từ điền sẵn cho dòng vừa thêm (vd. tình trạng khi mượn = tình trạng tài sản)
 * @param hideStatus không vẽ cột Trạng thái — khi cột riêng của loại phiếu cần chỗ và nói điều gần như thế
 * @param hideLineDetails không vẽ nút "Chi tiết" — khi `extra` đã đưa hết trường của dòng ra thành cột
 */
export function EquipmentLinesField({
  control,
  schoolId,
  statuses,
  extra,
  extraHeader,
  lineDefaults,
  hideLineDetails,
  hideStatus,
  showQuantity = false,
  quantityIssue = bulkLineIssue,
  quantityHeader = "Số lượng bàn giao",
  emptyHint = "Chọn từ danh sách thiết bị của trường",
  disposalEligible,
  expiry,
  draftCheck,
}: {
  control: Control<any>;
  schoolId: number | null | undefined;
  statuses: string[];
  /** Nhắc khi tài sản đã nằm trên một phiếu nháp khác cùng loại — lập trùng vì quên phiếu nháp trước. */
  draftCheck?: DraftCheck;
  extra?: (index: number) => ReactNode;
  extraHeader?: ReactNode;
  lineDefaults?: (row: PickerRow) => Record<string, unknown>;
  hideLineDetails?: boolean;
  hideStatus?: boolean;
  showQuantity?: boolean;
  /** Một cột số lượng; tồn và số còn lại nằm ngay dưới ô nhập của lô. */
  /** Cùng luật kiểm với danh sách “Cần hoàn thiện” của phiếu. */
  quantityIssue?: (line: { equipment?: EquipmentRef | null; quantity?: string | number | null }) => string | null;
  quantityHeader?: string;
  emptyHint?: string;
  disposalEligible?: "unrepairable";
  /** Lọc theo hạn sử dụng: `expired` = chỉ lô đã quá hạn (tiêu huỷ do hết hạn), `valid` = bỏ lô quá hạn. */
  expiry?: "expired" | "valid";
}) {
  const { fields, append, remove, update } = useFieldArray({ control, name: "lines" });
  const currentLines = useWatch({ control, name: "lines" }) ?? [];
  // Phiếu lập từ chỗ khác (`?equipment.id=1,2,3` — chuột phải ở bảng Theo tài sản, "Đổi" vị trí ở hồ sơ) chỉ mang id:
  // đọc hồ sơ các tài sản đó một lần rồi điền đủ dòng như khi chọn bằng hộp chọn (mã, tên, chỗ, số lượng lô, chứng từ).
  const bareIds = currentLines.filter((l: any) => l?.equipment?.id && !l.equipment.code).map((l: any) => l.equipment.id as number);
  const bareKey: string = bareIds.join(",");
  useEffect(() => {
    if (!bareKey) return;
    const ids = bareKey.split(",");
    let alive = true;
    void kyInstance.get("equipment", { searchParams: Object.fromEntries(ids.map((id, i) => [`ids[${i}]`, id])) })
      .json<PickerRow[]>()
      .then((rows) => {
        if (!alive) return;
        const byId = new Map(rows.map((r) => [r.id, r]));
        currentLines.forEach((l: any, index: number) => {
          const row = l?.equipment?.code ? null : byId.get(l?.equipment?.id);
          if (!row) return;
          update(index, { ...l, equipment: row,
            ...(showQuantity ? { quantity: row.trackingType === "BULK" ? "" : String(row.quantity ?? 1) } : {}),
            ...(lineDefaults ? { details: { ...lineDefaults(row), ...(l.details ?? {}) } } : {}) });
        });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bareKey]);
  const [open, setOpen] = useState(false);
  const { resource } = useResourceParams();
  const config = useVoucherForm(resource?.name);
  const hasLineDetails = !hideLineDetails && !!config && (config.line.some((f) => !f.stage) || Object.keys(config.lineTables ?? {}).length > 0);
  const chosen = new Set(fields.map((f: any) => f.equipment?.id));
  const lineItems: any[] = currentLines.map((l: any) => l.equipment).filter(Boolean);
  const drafts = useDraftDuplicates(draftCheck, lineItems.map((e) => e.id).join(","));
  const duplicates = lineItems.filter((e) => drafts.has(e.id));
  const draftRoute = draftCheck ? VOUCHER_ROUTES[draftCheck.resource] : undefined;

  return (
    <VoucherLinesCard>
      <div className="flex items-center justify-between gap-3 px-4 py-3.5">
        <StepTitle title="Thiết bị trên phiếu" aside={fields.length ? `${fields.length} thiết bị` : undefined} />
        {/* Một kiểu nút cho mọi lúc (nút viền, cỡ thường); lúc trống thì lối chính là ô lớn ở giữa thẻ. */}
        {fields.length ? <AddLinesButton label="Thêm thiết bị" disabled={!schoolId} onClick={() => setOpen(true)} /> : null}
      </div>

      {duplicates.length ? (
        <div className="border-t px-4 py-3">
          <Alert className="bg-warning-subtle border-warning-text/30">
            <TriangleAlert className="text-warning-text" />
            <AlertTitle className="text-warning-text">Đã có phiếu nháp cho thiết bị này</AlertTitle>
            <AlertDescription>
              <ul className="space-y-0.5">
                {duplicates.map((e) => {
                  const d = drafts.get(e.id)!;
                  return (
                    <li key={e.id}>
                      {e.name} ({e.code}) — phiếu nháp lập {formatPlainDate(d.createdDate)}
                      {draftRoute ? (
                        <>
                          {" · "}
                          <Link className="text-primary font-medium hover:underline" to={`${draftRoute}/show/${d.voucherId}`}>
                            Mở phiếu đó
                          </Link>
                        </>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </AlertDescription>
          </Alert>
        </div>
      ) : null}

      {fields.length === 0 ? (
        <AddLinesEmpty label="Thêm thiết bị" hint={emptyHint} onClick={() => setOpen(true)} disabled={!schoolId}
          disabledLabel="Chọn trường trước" />
      ) : (
        <div className="overflow-x-auto border-t">
          <Table>
            <TableHeader sticky>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Mã thiết bị</TableHead>
                <TableHead>Tên</TableHead>
                <TableHead>Vị trí</TableHead>
                {hideStatus ? null : <TableHead>Trạng thái</TableHead>}
                {extra ? <TableHead>{extraHeader}</TableHead> : null}
                {/* Phiếu điều chuyển dùng một cột gộp. Các phiếu khác chỉ hiện cột tồn/còn lại khi có lô vật tư. */}
                {showQuantity ? <TableHead >{quantityHeader}</TableHead> : null}
                <TableHead>Ghi chú</TableHead>
                {hasLineDetails ? <TableHead className="w-24" /> : null}
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((f: any, index) => (
                <TableRow key={f.id}>
                  <TableCell className="text-muted-foreground tabular-nums">{index + 1}</TableCell>
                  <TableCell className="font-mono text-xs">{f.equipment?.code}</TableCell>
                  <TableCell>{f.equipment?.name}</TableCell>
                  <TableCell>{f.equipment?.room?.name ?? <span className="text-muted-foreground">Kho</span>}</TableCell>
                  {hideStatus ? null : (
                    <TableCell>
                      <Badge variant="neutral">{ASSET_STATUS_LABELS[f.equipment?.status] ?? f.equipment?.status}</Badge>
                    </TableCell>
                  )}
                  {extra ? <TableCell className="min-w-40">{extra(index)}</TableCell> : null}
                  {showQuantity ? (() => {
                    const item = currentLines[index]?.equipment ?? f.equipment;
                    const available = Number(item?.quantity ?? 0);
                    const unit = item?.unitName ?? item?.unit?.name ?? "";
                    const bulk = item?.trackingType === "BULK";
                    return (
                      <>
                        <TableCell className="min-w-64 align-top" data-quantity-line={index}>
                          {bulk ? (
                            <Controller control={control} name={`lines.${index}.quantity`}
                              rules={{ required: "Nhập số lượng", validate: (v) => {
                                return quantityIssue({ ...(currentLines[index] ?? f), quantity: v }) ?? true;
                              } }}
                              render={({ field, fieldState }) => {
                                // Gọn: MỘT dòng chữ dưới ô, tính từ chính giá trị đang gõ (field.value) nên đổi ngay khi gõ.
                                // Chưa gõ: "Có …"; gõ đúng: "Còn …"; gõ sai (đã gõ hoặc đã rời ô): lỗi đỏ. Ô trống thì
                                // "Cần hoàn thiện" đã nhắc — không đỏ ngay khi vừa thêm dòng.
                                const typed = field.value !== "" && field.value != null;
                                const problem = quantityIssue({ ...(currentLines[index] ?? f), quantity: field.value }) ?? null;
                                const showProblem = !!problem && (typed || fieldState.isTouched);
                                const rest = round3(available - Number(field.value));
                                return (
                                  <div>
                                    <LotQuantityInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} hideHint
                                      unit={unit} item={item} max={available} invalid={showProblem}
                                      ariaLabel={`${quantityHeader} ${item?.name ?? ""}`} />
                                    <p className={cn("mt-1 text-xs tabular-nums", showProblem ? "text-destructive" : "text-muted-foreground")}>
                                      {showProblem ? problem
                                        : typed && !problem ? (rest === 0 ? "Chuyển hết lô" : `Còn ${readableAmount(rest, unit, item)}`)
                                          : `Có ${readableAmount(available, unit, item)}`}
                                    </p>
                                  </div>
                                );
                              }} />
                          ) : <span className="whitespace-nowrap font-medium tabular-nums">{fmtQty(available)} {unit}</span>}
                        </TableCell>
                      </>
                    );
                  })() : null}
                  <TableCell className="min-w-40">
                    <NoteInput control={control} index={index} />
                  </TableCell>
                  {hasLineDetails ? (
                    <TableCell>
                      <Controller
                        control={control}
                        name={`lines.${index}.details`}
                        render={({ field }) => (
                          <LineDetailsButton config={config} value={field.value} onChange={field.onChange} schoolId={schoolId}
                            title={`${f.equipment?.code ?? ""} — ${f.equipment?.name ?? ""}`} />
                        )}
                      />
                    </TableCell>
                  ) : null}
                  <TableCell>
                    <Button type="button" variant="ghost" size="icon" title="Bỏ dòng" onClick={() => remove(index)}>
                      <Trash2 className="text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <EquipmentPickerDialog
        open={open}
        onOpenChange={setOpen}
        schoolId={schoolId}
        statuses={statuses}
        disposalEligible={disposalEligible}
        expiry={expiry}
        draftCheck={draftCheck}
        exclude={chosen}
        onPick={(rows) => {
          for (const row of rows) append({ equipment: row, note: "",
            ...(showQuantity ? { quantity: row.trackingType === "BULK" ? "" : String(row.quantity ?? 1) } : {}),
            ...(lineDefaults ? { details: lineDefaults(row) } : {}) });
          setOpen(false);
        }}
      />
    </VoucherLinesCard>
  );
}

function NoteInput({ control, index }: { control: Control<any>; index: number }) {
  return (
    <FormField
      control={control}
      name={`lines.${index}.note`}
      // `VoucherLines.LineInput.note`: NOTE, tối đa 255.
      rules={textRules("NOTE", "Ghi chú", { max: 255 })}
      render={({ field, fieldState }) => (
        <div>
          <FormControl>
            <Input value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} placeholder="Ghi chú"
              maxLength={maxLengthOf("NOTE", 255)} aria-invalid={!!fieldState.error} />
          </FormControl>
          {fieldState.error ? <span className="text-destructive text-xs">{fieldState.error.message}</span> : null}
        </div>
      )}
    />
  );
}

/** Số dòng mỗi lần tải thêm khi cuộn tới đáy hộp chọn. */
const PICKER_PAGE_SIZE = 30;
const ALL = "__all__";


/**
 * Hộp chọn nhiều tài sản của MỘT trường — cùng khuôn với hộp chọn cán bộ: hàng lọc (ô tìm + các ô xổ Trạng
 * thái · Vị trí · Loại thiết bị), bảng trong khung cao cố định, một thanh chân có số dòng, phân trang và nút.
 *
 * Mọi thứ lọc và phân trang ở MÁY CHỦ, luôn kèm `school.id` — một trường có vài nghìn tài sản, đổ sẵn "100
 * dòng đầu" là sót im lặng. Các dòng đã tích được giữ qua các trang và qua mỗi lần lọc. Tài sản đã có trên
 * phiếu vẫn hiện (mờ, "đã có trên phiếu") thay vì bị giấu đi: giấu thì số dòng mỗi trang nhảy lung tung.
 * Ô Trạng thái chỉ liệt kê các trạng thái mà loại phiếu đang lập nhận (`statuses`).
 */
export function EquipmentPickerDialog({
  open,
  onOpenChange,
  schoolId,
  statuses,
  exclude,
  onPick,
  allowIncomplete,
  disposalEligible,
  expiry,
  addedLabel = "Đã có trên phiếu",
  skipHolds,
  roomId,
  draftCheck,
}: {
  /** Ghi chữ cam dưới tài sản đã nằm trên phiếu nháp khác cùng loại — vẫn chọn được, chỉ nhắc. */
  draftCheck?: DraftCheck;
  /**
   * Chỉ tài sản đang ở phòng này — ô "Vị trí" khoá sẵn phòng đó. Cho màn đã chọn phòng ở đầu (kế hoạch bảo trì
   * của Phòng máy tính chỉ chọn trong Phòng máy tính). Không truyền thì như cũ: mọi tài sản của trường.
   */
  roomId?: number | null;
  /** Chữ ghi ở dòng đã được chọn từ trước ("Đã có trên phiếu", "Đã có trên tờ tem"). */
  addedLabel?: string;
  /**
   * Không khoá tài sản đang bị phiếu khác giữ — cho việc không phải lập phiếu (in tem). Mặc định có khoá: một tài
   * sản chỉ nằm trên một phiếu đang chạy, máy chủ cũng từ chối lúc trình.
   */
  skipHolds?: boolean;
  /** Cho chọn cả tài sản hồ sơ chưa chuẩn — việc không phải lập phiếu (in tem) thì không cần hồ sơ chuẩn. */
  allowIncomplete?: boolean;
  disposalEligible?: "unrepairable";
  expiry?: "expired" | "valid";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schoolId: number | null | undefined;
  statuses: string[];
  exclude: Set<number>;
  onPick: (rows: PickerRow[]) => void;
}) {
  const [term, setTerm] = useState("");
  const [applied, setApplied] = useState("");
  const [status, setStatus] = useState(ALL);
  const [room, setRoom] = useState(ALL);
  const [type, setType] = useState(ALL);
  const [selected, setSelected] = useState<Map<number, PickerRow>>(new Map());

  // Gõ là tìm (chờ người ta ngừng gõ một nhịp), không cần nút "Tìm" riêng.
  useEffect(() => {
    const t = setTimeout(() => {
      setApplied(term.trim());
    }, 300);
    return () => clearTimeout(t);
  }, [term]);

  const enabled = open && !!schoolId;
  // Phòng do màn ngoài khoá sẵn thắng phòng người dùng chọn trong hộp.
  const lockedRoom = roomId != null ? String(roomId) : null;
  const roomFilter = lockedRoom ?? room;
  const { result: roomList } = useList<{ id: number; name: string }>({
    resource: "rooms",
    filters: [{ field: "school.id", operator: "eq", value: schoolId }],
    pagination: { currentPage: 1, pageSize: 500 },
    sorters: [{ field: "name", order: "asc" }],
    queryOptions: { enabled },
  });
  const { result: typeList } = useList<{ id: number; name: string }>({
    resource: "equipment_types",
    pagination: { currentPage: 1, pageSize: 200 },
    sorters: [{ field: "sortOrder", order: "asc" }],
    queryOptions: { enabled },
  });

  // Cuộn tới đâu tải thêm tới đó, không phân trang "Trước / Sau" (trưởng nhóm 13/11/2026).
  const { result, query } = useInfiniteList<PickerRow>({
    resource: "equipment",
    filters: [
      { field: "school.id", operator: "eq", value: schoolId },
      { field: "status", operator: "eq", value: status === ALL ? (statuses ?? []).join(",") : status },
      ...(disposalEligible ? [{ field: "disposalEligible", operator: "eq" as const, value: disposalEligible }] : []),
      ...(expiry ? [{ field: "expiry", operator: "eq" as const, value: expiry }] : []),
      ...(roomFilter !== ALL ? [{ field: "room.id", operator: "eq" as const, value: roomFilter }] : []),
      ...(type !== ALL ? [{ field: "catalogType", operator: "eq" as const, value: type }] : []),
      ...(applied ? [{ field: "q", operator: "eq" as const, value: applied }] : []),
    ],
    pagination: { pageSize: PICKER_PAGE_SIZE },
    sorters: [{ field: "code", order: "asc" }],
    queryOptions: { enabled, placeholderData: (prev: any) => prev },
  });
  const rows = (result.data?.pages ?? []).flatMap((p) => (p.data ?? []) as PickerRow[]);
  const total = result.data?.pages?.[0]?.total ?? 0;
  const loadMore = useInfiniteScroll({
    hasMore: result.hasNextPage ?? false,
    isFetching: query.isFetchingNextPage,
    onLoadMore: () => void query.fetchNextPage(),
  });
  const rowIds = rows.map((r) => r.id).join(",");
  const { data: holdList } = useQuery({
    queryKey: ["voucher_holds", rowIds],
    queryFn: ({ signal }) => kyInstance.get("voucher_holds", { signal,  searchParams: { equipmentIds: rowIds } }).json<Hold[]>(),
    enabled: open && !skipHolds && rowIds !== "",
  });
  const holds = new Map((holdList ?? []).map((h) => [h.equipmentId, h]));
  const drafts = useDraftDuplicates(draftCheck, rowIds, open);
  const filtered = !!applied || status !== ALL || roomFilter !== ALL || type !== ALL;
  const canPick = (r: PickerRow) => (allowIncomplete || usable(r)) && !exclude.has(r.id) && !holds.has(r.id);
  const pickable = rows.filter(canPick);
  const allOnPage = pickable.length > 0 && pickable.every((r) => selected.has(r.id));

  function toggle(row: PickerRow) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(row.id)) next.delete(row.id);
      else next.set(row.id, row);
      return next;
    });
  }

  /** Tích / bỏ tích cả TRANG đang xem — các trang khác giữ nguyên. */
  function togglePage(on: boolean) {
    setSelected((prev) => {
      const next = new Map(prev);
      for (const r of pickable) {
        if (on) next.set(r.id, r);
        else next.delete(r.id);
      }
      return next;
    });
  }

  const reset = () => {
    setSelected(new Map());
    setTerm("");
    setStatus(ALL);
    setRoom(ALL);
    setType(ALL);
  };

  /** Một ô xổ lọc. `locked` = màn ngoài đã chọn sẵn, chỉ xem. */
  const filter = (value: string, set: (v: string) => void, all: string, label: string, options: { value: string; label: string }[], icon: ReactNode, locked = false) => (
    <IconFilter icon={icon} label={label.toLowerCase()} allLabel={all} disabled={locked} value={value === ALL ? null : value}
      onChange={(v) => {
        set(v ?? ALL);
      }}
      groups={[{ items: options.map((o) => ({ key: o.value, label: o.label })) }]} />
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent size="picker">
        <DialogHeader>
          <DialogTitle>Chọn thiết bị</DialogTitle>
          <DialogDescription className="sr-only">Lọc rồi tích các dòng cần thêm; sang trang khác vẫn giữ dòng đã tích.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-80 max-w-full">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
            <Input
              autoFocus
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              // Hộp này mở TRONG form của màn: Enter ở ô tìm không được submit form bên ngoài.
              onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
              placeholder="Tìm mã hoặc tên thiết bị…"
              className="rounded-full pl-8"
              aria-label="Tìm thiết bị"
            />
          </div>
          {statuses.length > 1
            ? filter(status, setStatus, "Mọi trạng thái", "Trạng thái", statuses.map((s) => ({ value: s, label: ASSET_STATUS_LABELS[s] ?? s })), <Activity />)
            : null}
          {filter(roomFilter, setRoom, "Mọi vị trí", "Vị trí", (roomList?.data ?? []).map((r) => ({ value: String(r.id), label: r.name })), <DoorOpen />, lockedRoom != null)}
          {filter(type, setType, "Mọi loại thiết bị", "Loại thiết bị", (typeList?.data ?? []).map((t) => ({ value: String(t.id), label: t.name })), <Boxes />)}
        </div>

        <div className="min-h-0 flex-1 overflow-auto rounded-md border [&>[data-slot=table-container]]:overflow-visible [&_tbody_tr:last-child]:border-b">
          <Table className="table-fixed">
            <colgroup>
              <col className="w-12" />
              <col className="w-48" />
              <col />
              <col className="w-48" />
              <col className="w-36" />
            </colgroup>
            <TableHeader sticky>
              <TableRow>
                <TableHead>
                  <Checkbox checked={allOnPage} onCheckedChange={(v) => togglePage(v === true)} aria-label="Chọn mọi dòng đã tải" />
                </TableHead>
                <TableHead>Mã thiết bị</TableHead>
                <TableHead>Tên</TableHead>
                <TableHead>Vị trí</TableHead>
                <TableHead>Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.isLoading || rows.length === 0 ? (
                <TableEmpty colSpan={5} compact loading={query.isLoading} title={lockedRoom != null && !applied && status === ALL && type === ALL
                        ? "Phòng này chưa có thiết bị nào."
                        : filtered ? "Không có thiết bị nào khớp." : "Trường chưa có thiết bị phù hợp với loại phiếu này."} />
              ) : (
                rows.map((row) => {
                  const added = exclude.has(row.id);
                  const hold = holds.get(row.id);
                  const draft = drafts.get(row.id);
                  const ok = canPick(row);
                  return (
                    <TableRow
                      key={row.id}
                      className={cn("group/row", LIFT_ROW, "h-12", ok ? "cursor-pointer" : "text-muted-foreground", selected.has(row.id) && "bg-primary/10 hover:bg-primary/10")}
                      onClick={ok ? () => toggle(row) : undefined}
                      title={added ? addedLabel : hold ? holdText(hold) : ok ? undefined : `Hồ sơ thiếu: ${(row.missingProfile ?? []).join(", ")}`}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={added || selected.has(row.id)} disabled={!ok} onCheckedChange={() => toggle(row)} />
                      </TableCell>
                      <TableCell className="truncate font-mono text-xs">{row.code}</TableCell>
                      <TableCell>
                        <div className="truncate" title={row.name}>{row.name}</div>
                        {added ? (
                          <div className="text-xs">{addedLabel}</div>
                        ) : hold ? (
                          <div className="text-warning-text truncate text-xs">{holdText(hold)}</div>
                        ) : !ok ? (
                          <div className="text-warning-text truncate text-xs">Hồ sơ thiếu {(row.missingProfile ?? []).join(", ")}</div>
                        ) : draft ? (
                          <div className="text-warning-text truncate text-xs">{draftText(draft)}</div>
                        ) : null}
                      </TableCell>
                      <TableCell className="truncate">{row.room?.name ?? "Kho"}</TableCell>
                      <TableCell>
                        <Badge variant={ASSET_STATUS_VARIANTS[row.status] ?? "neutral"}>{ASSET_STATUS_LABELS[row.status] ?? row.status}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          <LoadMore attach={loadMore} hasMore={result.hasNextPage ?? false} loading={query.isFetchingNextPage} />
        </div>

        {/* Một thanh chân: số dòng đã tải / tổng bên trái; nút bấm dồn về tay phải. */}
        <div className="flex flex-wrap items-center gap-3 border-t pt-4">
          <span className="text-muted-foreground me-auto text-sm tabular-nums">
            {result.hasNextPage ? `${rows.length} / ` : ""}
            <span className="text-foreground font-medium">{total}</span> thiết bị
            {selected.size > 0 ? (
              <>
                {" · đã chọn "}
                <span className="text-primary font-medium">{selected.size}</span>
              </>
            ) : null}
          </span>
          <div className="flex items-center gap-3">
            {selected.size > 0 ? (
              <Button type="button" variant="ghost" onClick={() => setSelected(new Map())}>
                Bỏ chọn
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Đóng
            </Button>
            <Button
              type="button"
              disabled={selected.size === 0}
              onClick={() => {
                onPick([...selected.values()]);
                reset();
              }}
            >
              Thêm {selected.size > 0 ? selected.size : ""} thiết bị
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
