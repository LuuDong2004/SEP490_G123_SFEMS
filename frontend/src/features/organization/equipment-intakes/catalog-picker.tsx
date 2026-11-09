import { useCan, useCreate, useInfiniteList, useList, useOne } from "@refinedev/core";
import { Plus, Search, GraduationCap, Boxes, BookOpen } from "lucide-react";
import { keepPreviousData } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { HelpHint } from "@/shared/components/form/help-hint";
import { IconFilter } from "@/shared/components/data-table/icon-filter";
import { useInfiniteScroll } from "@/shared/hooks/use-infinite-scroll";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { TRACKING_LABELS } from "@/domains/equipment-intake/types";
import { ASSET_CATEGORY_LABELS } from "@/domains/equipment/types";
import { CATALOG_ORIGIN_LABELS } from "@/domains/equipment-catalog/types";
import { SchoolItemDialog } from "@/shared/components/catalog/school-item-dialog";
import type { PickedCatalog } from "@/domains/equipment-catalog/types";
import { errorMessage } from "@/shared/lib/api-error";
import { maxLengthOf, textError } from "@/shared/lib/field-rules";
import { LIFT_ROW } from "@/shared/lib/row-lift";
import { cn } from "@/shared/lib/utils";

/* eslint-disable @typescript-eslint/no-explicit-any */

const ALL = "__all__";
/** Một trang của hộp chọn — vừa đúng chiều cao bảng, không phải cuộn trong cuộn. */
const PAGE_SIZE = 20;


/**
 * Chọn NHIỀU thiết bị một lượt. Mọi dòng thêm vào đều nhận về kho thiết bị của trường —
 * ghi tăng không chọn nơi nhận (QLTB-382); đưa về phòng là việc của phiếu cấp phát.
 *
 * <p>Hộp này chọn MẶT HÀNG trong danh mục, khác hộp chọn tài sản của các phiếu
 * cấp phát / điều chuyển: lúc ghi tăng thì tài sản chưa tồn tại, đó chính là
 * thứ phiếu sắp sinh ra.
 */
export function CatalogPickerDialog({
  open,
  onOpenChange,
  schoolId,
  exclude,
  onPick,
  mode = "multi",
  title = "Chọn thiết bị từ danh mục",
  description = "Chọn thiết bị trong danh mục để thêm vào phiếu ghi tăng.",
  header,
  body,
}: {
  title?: string;
  description?: string;
  /** Dải trên đầu hộp, dưới tiêu đề (vd. tab "Theo định mức" / "Toàn bộ danh mục" của đề xuất mua sắm). */
  header?: ReactNode;
  /** Có thì thay CẢ phần chọn từ danh mục (lọc, bảng, phân trang, nút) — một tab khác của cùng hộp. */
  body?: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schoolId: number | null;
  /** Mặt hàng đã có dòng trong phiếu — vẫn hiện nhưng không tick lại được. */
  exclude: Set<number>;
  onPick: (rows: PickedCatalog[], roomId: number | null) => void;
  /**
   * `single` cho ô Thiết bị của một dòng đã có: chọn một là đóng ngay.
   */
  mode?: "single" | "multi";
}) {
  const single = mode === "single";
  const [term, setTerm] = useState("");
  const [applied, setApplied] = useState("");
  // Gõ là lọc: áp từ khoá sau 300 ms ngừng gõ — khỏi bấm "Tìm", và không gửi một request mỗi phím.
  useEffect(() => {
    const t = setTimeout(() => setApplied(term.trim()), 300);
    return () => clearTimeout(t);
  }, [term]);
  const [typeId, setTypeId] = useState<string>(ALL);
  const [subjectId, setSubjectId] = useState<string>(ALL);
  // Cấp học: mặc định đúng cấp của trường — danh mục có 1.700 thiết bị của cả ba cấp, và một trường
  // THCS chọn nhầm thiết bị "TH-…" thì định mức của nó không bao giờ được tính. Trường đã có cấp học
  // thì KHÔNG đổi được (cấp của trường thắng mọi lựa chọn); chỉ trường chưa khai cấp mới được chọn.
  const { result: school } = useOne<any>({ resource: "schools", id: schoolId ?? "", queryOptions: { enabled: open && !!schoolId } });
  const schoolLevel = school?.educationLevel?.id ? String(school.educationLevel.id) : null;
  const [levelPick, setLevelPick] = useState<string | null>(null);
  const levelId = schoolLevel ?? levelPick ?? ALL;
  // Hàng ghi tăng luôn về KHO THIẾT BỊ của trường (QLTB-382: mỗi trường một kho; đưa về phòng là việc của
  // phiếu cấp phát) — không có ô "Nhận vào" để chọn. Không tìm thấy kho thì để trống: máy chủ coi là trong kho.
  const [roomId, setRoomId] = useState<string>("");
  const [selected, setSelected] = useState<Map<number, PickedCatalog>>(new Map());
  const [creating, setCreating] = useState(false);
  const [addingOwn, setAddingOwn] = useState(false);

  // Thêm mặt hàng mới ngay tại đây thay vì bắt rời phiếu đi mở màn danh mục:
  // người nhận hàng phát hiện thiếu mặt hàng đúng lúc đang gõ phiếu, và bỏ
  // phiếu đang dở để đi nơi khác là lúc dữ liệu bị nhập sai cho xong.
  //
  // Danh mục do SỞ sở hữu, trường chỉ đọc — nên nút này chỉ hiện với tài khoản
  // thật sự có `equipment_catalogs:write`. Không gác thì cán bộ trường bấm vào
  // rồi ăn 403, tệ hơn là không thấy nút.
  const mayCreate = useCan({ resource: "equipment_catalogs", action: "create" }).data?.can ?? false;

  const reset = () => {
    setSelected(new Map());
    setTerm("");
    setApplied("");
    setTypeId(ALL);
    setSubjectId(ALL);
    setLevelPick(null);
    setRoomId("");
  };

  const { result: levels } = useList<any>({
    resource: "education_levels",
    pagination: { pageSize: 20 },
    sorters: [{ field: "sortOrder", order: "asc" }],
    queryOptions: { enabled: open },
  });
  const { result: types } = useList<any>({
    resource: "equipment_types",
    pagination: { pageSize: 200 },
    sorters: [{ field: "sortOrder", order: "asc" }],
    queryOptions: { enabled: open },
  });
  const { result: subjects } = useList<any>({
    resource: "subjects",
    pagination: { pageSize: 200 },
    sorters: [{ field: "sortOrder", order: "asc" }],
    queryOptions: { enabled: open },
  });
  const { result: rooms } = useList<any>({
    resource: "rooms",
    pagination: { pageSize: 200 },
    // Phòng ngừng sử dụng không nhận hàng mới.
    filters: schoolId ? [{ field: "school.id", operator: "eq", value: schoolId }, { field: "active", operator: "eq", value: true }] : [],
    sorters: [{ field: "name", order: "asc" }],
    queryOptions: { enabled: open && !!schoolId },
  });
  // Kho của trường: phòng loại KHO — cùng quy tắc `isStoreroom` ở máy chủ; không có mã loại thì theo tên.
  useEffect(() => {
    if (!open || roomId) return;
    const list: any[] = rooms?.data ?? [];
    const store =
      list.find((r) => r.roomType?.code === "KHO") ?? list.find((r) => /(^|\s)kho(\s|$)/i.test(r.name ?? ""));
    if (store) {
      setRoomId(String(store.id));
    }
  }, [open, roomId, rooms]);

  const { result, query } = useInfiniteList<PickedCatalog>({
    resource: "equipment_catalogs",
    filters: [
      { field: "active", operator: "eq", value: true },
      ...(applied ? [{ field: "q", operator: "eq" as const, value: applied }] : []),
      ...(typeId !== ALL ? [{ field: "equipmentType.id", operator: "eq" as const, value: typeId }] : []),
      ...(subjectId !== ALL ? [{ field: "subject.id", operator: "eq" as const, value: subjectId }] : []),
      ...(levelId !== ALL ? [{ field: "educationLevel.id", operator: "eq" as const, value: levelId }] : []),
    ],
    pagination: { pageSize: PAGE_SIZE },
    sorters: [{ field: "name", order: "asc" }],
    // Giữ kết quả cũ trong lúc chờ kết quả mới: bảng không nháy trống, hộp không co giật khi gõ.
    queryOptions: { enabled: open && !body, placeholderData: keepPreviousData },
  });

  // Cuộn tới cuối bảng là tải thêm — danh mục hơn 1.700 thiết bị, không bắt bấm "Sau" từng trang.
  const rows = useMemo(() => (result.data?.pages ?? []).flatMap((p) => (p.data ?? []) as PickedCatalog[]), [result.data]);
  const total = result.data?.pages?.[0]?.total ?? 0;
  const loadMoreRef = useInfiniteScroll({
    hasMore: result.hasNextPage ?? false,
    isFetching: query.isFetchingNextPage,
    onLoadMore: () => void query.fetchNextPage(),
  });
  const pickable = rows.filter((r) => !exclude.has(r.id));

  function toggle(row: PickedCatalog) {
    if (exclude.has(row.id)) return;
    // Chọn một: bấm vào dòng là xong, không bắt bấm thêm nút xác nhận.
    if (single) {
      onPick([row], null);
      reset();
      return;
    }
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(row.id)) next.delete(row.id);
      else next.set(row.id, row);
      return next;
    });
  }

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
          <DialogTitle>{title}</DialogTitle>
          {/* Giữ cho trình đọc màn hình (Radix cần một mô tả), ẩn khỏi mắt: bốn dòng chữ giải thích
              chiếm mất chỗ của chính cái bảng người ta mở hộp này để nhìn. */}
          <DialogDescription className="sr-only">{description}</DialogDescription>
        </DialogHeader>
        {header}
        {body ?? (
        <>

        {/* Một hàng lọc: ô tìm (gõ là lọc), hai ô chọn loại / môn; "Thêm mới" đứng cuối hàng vì
            người ta chỉ cần nó đúng lúc tìm không ra.
            Ô tìm là <div> chứ không phải <form>: hộp này mở TRONG form phiếu
            nhập, và một form lồng trong form thì Enter ở đây submit cả phiếu. */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-80 max-w-full">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              onKeyDown={(e) => {
                // Enter ở đây không được submit form phiếu bên ngoài; áp ngay khỏi chờ.
                if (e.key === "Enter") {
                  e.preventDefault();
                  setApplied(term.trim());
                }
              }}
              placeholder="Mã hoặc tên thiết bị…"
              className="rounded-full pl-8"
              aria-label="Tìm thiết bị"
            />
          </div>
          {/* Trường đã có cấp học thì KHÔNG có ô chọn cấp: thiết bị của cấp khác không ghi tăng được cho
              trường này (máy chủ cũng không trả về và từ chối khi lưu). Ô chọn chỉ còn với trường chưa
              khai cấp học. */}
          {schoolLevel ? null : (
            <IconFilter icon={<GraduationCap />} label="cấp học" allLabel="Mọi cấp học" value={levelId === ALL ? null : levelId}
              onChange={(v) => setLevelPick(v ?? ALL)}
              groups={[{ items: (levels?.data ?? []).map((l: any) => ({ key: String(l.id), label: l.name })) }]} />
          )}
          <IconFilter icon={<Boxes />} label="loại thiết bị" allLabel="Tất cả loại" value={typeId === ALL ? null : typeId}
            onChange={(v) => setTypeId(v ?? ALL)}
            groups={[{ items: (types?.data ?? []).map((t: any) => ({ key: String(t.id), label: t.name })) }]} />
          <IconFilter icon={<BookOpen />} label="môn học" allLabel="Tất cả môn" value={subjectId === ALL ? null : subjectId}
            onChange={(v) => setSubjectId(v ?? ALL)}
            groups={[{ items: (subjects?.data ?? []).map((x: any) => ({ key: String(x.id), label: x.name })) }]} />
          {mayCreate ? (
            <Button type="button" variant="outline" className="ms-auto" onClick={() => setCreating(true)}>
              <Plus />
              Thêm mới
            </Button>
          ) : (
            // Trường không ghi danh mục của Sở, nhưng thêm được thiết bị NGOÀI danh mục của riêng mình.
            // Nhãn ngắn: hàng này còn ô tìm và các ô lọc. Lời giải thích nằm sau dấu "?" cạnh nút — không
            // dùng chú thích tự bật khi rê chuột qua nút (nó che mất ô lọc bên cạnh mỗi lần lướt qua).
            <span className="ms-auto flex items-center gap-1.5">
              <Button type="button" variant="outline" onClick={() => setAddingOwn(true)}>
                <Plus />
                Ngoài danh mục
              </Button>
              <HelpHint>
                Dùng khi thiết bị không có trong danh mục của Sở.
              </HelpHint>
            </span>
          )}
        </div>

        {/* Chiều cao CỐ ĐỊNH, không max-h: lọc ra ít dòng thì bảng chừa trống chứ hộp không co lại. */}
        <div className="min-h-0 flex-1 overflow-auto rounded-md border [&>[data-slot=table-container]]:overflow-visible [&_tbody_tr:last-child]:border-b">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  {/* Chỉ cộng / trừ các dòng của TRANG NÀY. Thay cả Map bằng trang hiện tại thì
                      tích ở trang 2 xoá sạch thứ đã chọn ở trang 1 — người dùng không thấy, vì
                      những dòng ấy không nằm trên màn. */}
                  <Checkbox
                    checked={pickable.length > 0 && pickable.every((r) => selected.has(r.id))}
                    onCheckedChange={(v) =>
                      setSelected((prev) => {
                        const next = new Map(prev);
                        if (v) pickable.forEach((r) => next.set(r.id, r));
                        else pickable.forEach((r) => next.delete(r.id));
                        return next;
                      })
                    }
                  />
                </TableHead>
                <TableHead>Mã thiết bị</TableHead>
                <TableHead>Thiết bị</TableHead>
                {/* Không có cột Loại thiết bị và Môn học: hai ô lọc ngay trên bảng đã là hai cột đó,
                    và chúng đẩy cột Thiết bị — thứ người ta thực sự đọc để chọn — bị cắt mất chữ. */}
                <TableHead className="w-20">ĐVT</TableHead>
                <TableHead className="w-28">Quản lý</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground py-6 text-center">
                    Đang tải…
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground py-6 text-center">
                    Không có thiết bị nào phù hợp.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => {
                  const already = exclude.has(row.id);
                  return (
                    <TableRow
                      key={row.id}
                      className={cn("group/row", LIFT_ROW, already ? "text-muted-foreground" : "cursor-pointer")}
                      onClick={() => toggle(row)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          disabled={already}
                          checked={selected.has(row.id)}
                          onCheckedChange={() => toggle(row)}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs whitespace-nowrap">{row.code}</TableCell>
                      <TableCell>
                        {row.name}
                        {row.ownerSchool ? (
                          <Badge variant="warning" className="ms-2" title={`Thiết bị riêng của ${row.ownerSchool.name}`}>
                            Ngoài danh mục{row.origin ? ` · ${CATALOG_ORIGIN_LABELS[row.origin as keyof typeof CATALOG_ORIGIN_LABELS] ?? row.origin}` : ""}
                          </Badge>
                        ) : null}
                        {already ? (
                          <div className="text-xs">Phiếu đã có dòng cho thiết bị này</div>
                        ) : null}
                      </TableCell>
                      <TableCell>{row.unit?.name ?? "—"}</TableCell>
                      <TableCell>
                        {row.trackingType ? (
                          <Badge variant={row.trackingType === "BULK" ? "info" : "neutral"}>
                            {TRACKING_LABELS[row.trackingType] ?? row.trackingType}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          {result.hasNextPage ? (
            <div ref={loadMoreRef} className="text-muted-foreground py-3 text-center text-xs">
              {query.isFetchingNextPage ? "Đang tải thêm…" : "Cuộn để tải thêm"}
            </div>
          ) : null}
        </div>

        {/* Tìm KHÔNG RA thì chỉ ngay lối thêm thiết bị ngoài danh mục, tên điền sẵn từ khoá vừa gõ —
            hiện thường trực thì thành một dòng chữ không ai đọc. */}
        {mayCreate || !applied || rows.length > 0 || query.isFetching ? null : (
          <p className="text-muted-foreground -mt-1 flex flex-wrap items-center gap-x-2 text-xs">
            Không có “{applied}” trong danh mục. Bạn có thể
            <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setAddingOwn(true)}>
              thêm làm thiết bị ngoài danh mục
            </Button>
          </p>
        )}

        {/* Một thanh dưới: số đã tải bên trái; số đã chọn và hai nút bên phải. */}
        <div className="flex flex-wrap items-center gap-3 border-t pt-4">
          {total > 0 ? (
            <span className="text-muted-foreground text-sm">
              <span className="tabular-nums">{rows.length}</span> / <span className="text-foreground font-medium tabular-nums">{total}</span> thiết bị
            </span>
          ) : null}
          <div className="ms-auto flex items-center gap-3">
            {single ? null : (
              <span className="text-muted-foreground text-sm">
                Đã chọn <span className="text-foreground font-semibold tabular-nums">{selected.size}</span>
              </span>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Đóng
            </Button>
            {single ? null : (
              <Button
                type="button"
                className="min-w-28"
                disabled={selected.size === 0}
                onClick={() => {
                  onPick([...selected.values()], roomId ? Number(roomId) : null);
                  reset();
                }}
              >
                Thêm {selected.size > 0 ? selected.size : ""} dòng
              </Button>
            )}
          </div>
        </div>

        <SchoolItemDialog
          open={addingOwn}
          onOpenChange={setAddingOwn}
          initialName={applied}
          onCreated={(row) => {
            setAddingOwn(false);
            // Vừa thêm xong thì chọn luôn — không ai mở hộp này để thêm rồi thôi.
            if (single) { onPick([row], null); reset(); }
            else setSelected((prev) => new Map(prev).set(row.id, row));
            query.refetch?.();
          }}
        />
        <NewCatalogDialog
          open={creating}
          onOpenChange={setCreating}
          types={types?.data ?? []}
          onCreated={(row) => {
            setCreating(false);
            // Vừa tạo xong thì chọn luôn — không ai mở hộp này để tạo rồi thôi.
            if (single) { onPick([row], null); reset(); }
            else setSelected((prev) => new Map(prev).set(row.id, row));
            query.refetch?.();
          }}
        />
        </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Tạo nhanh một mặt hàng ngay trong lúc lập phiếu.
 *
 * <p>Chỉ hỏi những gì KHÔNG suy ra được và những gì phiếu cần ngay: mã, tên,
 * đơn vị tính, cách quản lý, loại tài sản. Phần còn lại của hồ sơ mặt hàng —
 * môn học, khối lớp, căn cứ thông tư, định mức — để màn danh mục làm cho tử
 * tế; nhét cả hai mươi ô vào đây thì người ta bấm bừa cho xong để quay lại
 * phiếu đang dở.
 *
 * <p>Ba ô có dấu sao là vì phiếu sẽ hỏi lại chúng ở bước trình: đơn vị tính
 * nằm trong {@code Equipment.missingProfile()}, và cách quản lý quyết định
 * dòng sinh ra tài sản hay cộng tồn kho.
 */
function NewCatalogDialog({
  open,
  onOpenChange,
  types,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  types: any[];
  onCreated: (row: PickedCatalog) => void;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [unitId, setUnitId] = useState<string>("");
  const [typeId, setTypeId] = useState<string>(ALL);
  const [tracking, setTracking] = useState("SERIAL");
  const [category, setCategory] = useState<string>(ALL);
  const [error, setError] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const { mutateAsync } = useCreate();
  const { result: units } = useList<any>({
    resource: "units",
    pagination: { pageSize: 200 },
    queryOptions: { enabled: open },
  });

  const codeError = textError("CODE", "Mã", code);
  const nameError = textError("NAME", "Tên", name);

  const reset = () => {
    setCode(""); setName(""); setUnitId(""); setTypeId(ALL);
    setTracking("SERIAL"); setCategory(ALL); setError(null);
  };

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const created: any = await mutateAsync({
        resource: "equipment_catalogs",
        values: {
          code: code.trim(),
          name: name.trim(),
          unit: unitId ? { id: Number(unitId) } : undefined,
          equipmentType: typeId !== ALL ? { id: Number(typeId) } : undefined,
          trackingType: tracking,
          assetCategory: category !== ALL ? category : undefined,
          physicalOrDigital: "PHYSICAL",
          active: true,
        },
        successNotification: false,
      });
      const row = created?.data ?? created;
      reset();
      onCreated({
        id: row.id,
        code: row.code,
        name: row.name,
        trackingType: row.trackingType,
        assetCategory: row.assetCategory ?? null,
        physicalOrDigital: row.physicalOrDigital ?? null,
        unit: row.unit ?? null,
        equipmentType: row.equipmentType ?? null,
        subject: row.subject ?? null,
      });
    } catch (e) {
      setError(await errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent size="form">
        <DialogHeader>
          <DialogTitle>Thêm thiết bị vào danh mục</DialogTitle>
          <DialogDescription>
            Thiết bị này sẽ dùng chung cho mọi trường. Thông tin còn lại bổ sung sau ở màn Danh mục thiết bị.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Mã <span className="text-destructive">*</span></Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="VD: TB-MAYCHIEU" maxLength={maxLengthOf("CODE")} />
            {codeError ? <p className="text-destructive text-sm">{codeError}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label>Tên <span className="text-destructive">*</span></Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Máy chiếu đa năng" maxLength={maxLengthOf("NAME")} />
            {nameError ? <p className="text-destructive text-sm">{nameError}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label>Đơn vị tính <span className="text-destructive">*</span></Label>
            <Select value={unitId} onValueChange={setUnitId}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Vui lòng chọn đơn vị tính" /></SelectTrigger>
              <SelectContent className="max-h-64">
                {(units?.data ?? []).map((u: any) => (
                  <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Loại thiết bị</Label>
            <Select value={typeId === ALL ? "" : typeId} onValueChange={setTypeId}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Vui lòng chọn loại thiết bị" /></SelectTrigger>
              <SelectContent className="max-h-64">
                {typeId === ALL ? null : <SelectItem value={ALL} className="text-muted-foreground">Bỏ chọn</SelectItem>}
                {types.map((t: any) => (
                  <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Cách quản lý <span className="text-destructive">*</span></Label>
            <Select value={tracking} onValueChange={setTracking}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-64">
                {Object.entries(TRACKING_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Loại tài sản</Label>
            <Select value={category === ALL ? "" : category} onValueChange={setCategory}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Vui lòng chọn loại tài sản" /></SelectTrigger>
              <SelectContent className="max-h-64">
                {category === ALL ? null : <SelectItem value={ALL} className="text-muted-foreground">Bỏ chọn</SelectItem>}
                {Object.entries(ASSET_CATEGORY_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <p className="text-muted-foreground text-xs">
          Chọn đúng cách quản lý ngay từ đầu. Đã nhập hàng rồi thì không đổi được.
        </p>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Huỷ</Button>
          <Button
            type="button"
            disabled={busy || !code.trim() || !name.trim() || !unitId || !!codeError || !!nameError}
            onClick={submit}
          >
            Tạo và chọn
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
