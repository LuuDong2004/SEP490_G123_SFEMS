import { useNotification, useShow } from "@refinedev/core";
import { AddLinesButton, AddLinesEmpty } from "@/shared/components/voucher/add-lines";
import { useQueries, useQuery } from "@tanstack/react-query";
import { createColumnHelper } from "@tanstack/react-table";
import { PackageCheck, RefreshCw, Trash2, TriangleAlert } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Controller, useFieldArray, useFormContext, useWatch, type Control, type UseFieldArrayReturn } from "react-hook-form";
import { Link, useNavigate } from "react-router";

import { kyInstance } from "@/shared/api/data";
import { AsyncCombobox } from "@/shared/components/form/async-combobox";
import { MoneyInput } from "@/shared/components/form/money-input";
import { DateField, SelectField, TextareaField, TextField } from "@/shared/components/form/simple-fields";
import { VoucherFormPage } from "@/shared/components/voucher/voucher-form-page";
import { VoucherList } from "@/shared/components/voucher/voucher-list";
import { VoucherShowShell } from "@/shared/components/voucher/voucher-show-shell";
import { LineDetailsButton, lineDetailsText } from "@/shared/components/voucher/voucher-details";
import { StandardTraceBlock } from "../school-year/standard-trace";
import { useVoucherForm } from "@/shared/hooks/use-voucher-form";
import { errorMessage } from "@/shared/lib/api-error";
import { formatPlainDate, todayLocal } from "@/shared/lib/format";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { StepTitle, VoucherLinesCard } from "@/shared/components/voucher/voucher-layout";
import { FormControl, FormField, FormMessage } from "@/shared/ui/form";
import { maxLengthOf, numberRules, textRules, type NumberRule, type TextRule } from "@/shared/lib/field-rules";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { FUNDING_LABELS } from "@/domains/equipment/types";
import {
  PRIORITY_LABELS,
  PURCHASE_LINE_KIND_LABELS,
  type PurchaseProposal,
  type SchoolAdequacy,
} from "@/domains/procurement/types";
import { useVoucherSchoolId, VoucherSchoolField } from "@/features/organization/vouchers/voucher-school-field";
import { OverlapNote, OverlapSummary, useProposalOverlaps, type OverlapIndex } from "./overlap";
import { ProposalPickerDialog } from "./picker";
import { LIFT_ROW } from "@/shared/lib/row-lift";
import { cn } from "@/shared/lib/utils";

/* eslint-disable @typescript-eslint/no-explicit-any */

const RESOURCE = "purchase_proposals";
/**
 * Nguồn kinh phí dự kiến của một đề xuất MUA SẮM: hàng về sẽ ghi tăng với nguồn hình thành "Mua sắm", nên gồm
 * các nguồn đi được với nó (`OriginRule.MUA_SAM` ở máy chủ) — cả "Tài trợ" (nhà tài trợ cho tiền, trường tự mua)
 *, trừ "Chưa xác định nguồn".
 */
const PURCHASE_FUNDING = Object.fromEntries(
  Object.entries(FUNDING_LABELS).filter(([value]) => value !== "UNDETERMINED"),
);

const money = new Intl.NumberFormat("vi-VN");
const opts = (m: Record<string, string>) => Object.entries(m).map(([value, label]) => ({ value, label }));

const DEFAULTS = {
  school: { id: null },
  // Getter: tính lúc form mount (khi `defaults` được trải ra), không chốt lúc tải trang.
  get proposalDate() {
    return todayLocal();
  },
  budgetYear: String(new Date().getFullYear() + 1),
  fundingSource: "STATE_BUDGET",
  reason: "",
  note: "",
  lines: [] as any[],
};

const toForm = (r: PurchaseProposal) => ({
  school: { id: r.school?.id },
  proposalDate: r.proposalDate,
  budgetYear: r.budgetYear == null ? "" : String(r.budgetYear),
  fundingSource: r.fundingSource,
  reason: r.reason ?? "",
  note: r.note ?? "",
  lines: r.lines.map((l) => ({
    catalogId: String(l.catalog.id),
    catalogLabel: `${l.catalog.code} · ${l.catalog.name}`,
    kind: l.kind,
    name: l.name,
    specification: l.specification ?? "",
    unitName: l.unitName ?? "",
    quantity: String(l.quantity),
    unitPrice: l.unitPrice == null ? "" : String(l.unitPrice),
    priority: String(l.priority),
    note: l.note ?? "",
    details: l.details ?? {},
  })),
});

const num = (v: any) => (v === "" || v == null ? null : Number(v));

const toPayload = (v: any) => ({
  school: v.school?.id ? { id: v.school.id } : null,
  proposalDate: v.proposalDate,
  budgetYear: num(v.budgetYear),
  fundingSource: v.fundingSource || null,
  reason: v.reason,
  note: v.note,
  lines: (v.lines ?? []).map((l: any) => ({
    catalog: l.catalogId ? { id: Number(l.catalogId) } : null,
    kind: l.kind,
    name: l.name,
    specification: l.specification,
    // Đơn vị tính theo danh mục của thiết bị — máy chủ tự lấy khi trống; gửi giá trị cũ của form thì đổi thiết bị
    // xong vẫn mang đơn vị của thiết bị trước.
    unitName: null,
    quantity: num(l.quantity),
    unitPrice: num(l.unitPrice),
    priority: num(l.priority),
    note: l.note,
    details: l.details ?? {},
  })),
});

const blankLine = (catalogId = "", name = "", quantity = "1", catalogLabel = ""): Record<string, any> => ({
  catalogId,
  catalogLabel,
  kind: "NEW",
  name,
  specification: "",
  unitName: "",
  quantity,
  unitPrice: "",
  priority: "2",
  note: "",
});

function useAdequacy(schoolId: number | null | undefined) {
  return useQuery({
    queryKey: [RESOURCE, "adequacy", schoolId],
    enabled: schoolId != null,
    queryFn: ({ signal }) => kyInstance.get(`${RESOURCE}/adequacy`, { signal,  searchParams: { schoolId: String(schoolId) } }).json<SchoolAdequacy>(),
  });
}

/**
 * Mức đáp ứng Danh mục thiết bị tối thiểu của một trường: mỗi THIẾT BỊ phụ lục đòi bao nhiêu, đang
 * dùng được bao nhiêu, thiếu bao nhiêu. Vài trăm dòng một trường, nên gom theo MÔN — dòng nhóm nói
 * môn đó thiếu / đủ bao nhiêu thiết bị, mở ra mới thấy từng thiết bị.
 */
function LineInput({ control, name, type = "text", placeholder, className, label, rule, max, numberRule }: {
  control: Control<any>; name: string; type?: string; placeholder?: string; className?: string;
  /** Nhãn trong câu báo lỗi (tiêu đề cột). */ label: string; rule?: TextRule; max?: number; numberRule?: NumberRule;
}) {
  return (
    <FormField
      control={control}
      name={name}
      rules={rule ? textRules(rule, label, { max }) : numberRule ? numberRules(numberRule, label) : undefined}
      render={({ field }) => (
        <>
          <FormControl>
            <Input type={type} className={className} value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} placeholder={placeholder}
              maxLength={rule ? maxLengthOf(rule, max) : undefined} />
          </FormControl>
          <FormMessage className="text-xs" />
        </>
      )}
    />
  );
}

function LineSelect({ control, name, options, className }: { control: Control<any>; name: string; options: { value: string; label: string }[]; className?: string }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <Select value={field.value ?? ""} onValueChange={field.onChange}>
          <FormControl>
            <SelectTrigger className={className ?? "w-full"}><SelectValue placeholder="Chọn" /></SelectTrigger>
          </FormControl>
          <SelectContent>
            {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
    />
  );
}

/** Dòng đầu tiên (đánh số từ 1) của phiếu mang thiết bị này. */
function lineWithCatalog(lines: any[] | undefined, catalogId: string) {
  const i = (lines ?? []).findIndex((l) => l?.catalogId && String(l.catalogId) === catalogId);
  return i < 0 ? undefined : i + 1;
}

/**
 * Đơn vị tính của từng thiết bị theo danh mục (Chiếc, Tờ, Gam, Lít…) — để ô Số lượng nói rõ "50 Gam" chứ không chỉ
 * "50". Đọc từng thiết bị một lần và giữ lại (danh mục ít đổi).
 */
function useCatalogUnits(ids: number[]) {
  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: ["catalog-unit", id],
      staleTime: 30 * 60_000,
      queryFn: async () => (await kyInstance.get(`equipment_catalogs/${id}`).json<{ unit?: { name: string } | null }>())?.unit?.name ?? null,
    })),
  });
  return new Map(ids.map((id, i) => [id, results[i]?.data ?? null]));
}

function PurchaseLinesField({ control, array, schoolId, overlaps, onAdd }: {
  control: Control<any>;
  array: UseFieldArrayReturn<any, "lines">;
  schoolId: number | null;
  overlaps: OverlapIndex;
  /** Mở hộp "Chọn thiết bị cần mua". */
  onAdd: () => void;
}) {
  const config = useVoucherForm(RESOURCE);
  const { setValue } = useFormContext();
  const { fields, remove } = array;
  const lines = useWatch({ control, name: "lines" }) as any[] | undefined;
  const total = (lines ?? []).reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0);
  const unpriced = fields.length ? (lines ?? []).filter((l) => !(Number(l?.unitPrice) > 0)).length : 0;
  const units = useCatalogUnits([...new Set((lines ?? []).map((l) => Number(l?.catalogId)).filter((id) => id > 0))]);
  return (
    <div>
      <div className="flex items-center justify-between gap-3 px-4 py-3.5">
        <StepTitle title="Thiết bị đề xuất" aside={fields.length ? `${fields.length} dòng · dự toán ${money.format(total)} đ` : undefined} />
        {fields.length ? <AddLinesButton label="Thêm thiết bị" onClick={onAdd} disabled={schoolId == null} /> : null}
      </div>
      {fields.length === 0 ? (
        <AddLinesEmpty label="Thêm thiết bị" hint="Theo định mức còn thiếu hoặc từ danh mục" onClick={onAdd}
          disabled={schoolId == null} disabledLabel="Chọn trường trước" />
      ) : (
        <div className="overflow-x-auto border-t">
          {/* Cột cố định (`table-fixed`): cột Thiết bị lấy phần còn lại nhưng không dưới ~20rem — bảng giữ tối thiểu 72rem,
              khung hẹp hơn thì CUỘN NGANG (thanh trượt dưới bảng) chứ không ép cột Thiết bị. Ô Thiết bị là CHỮ (mã + tên
              đầy đủ, tự xuống dòng), không phải ô chọn rút gọn — ô chọn chỉ còn "THCS-16-0…" khi cột hẹp, bấm vào lại mở
              cả danh mục mà không cho biết đang chọn gì; đổi thiết bị qua liên kết "Đổi thiết bị" (thiết bị đang chọn
              ghim đầu danh sách). Tên cụ thể và thông số kỹ thuật (không bắt buộc) nằm trong "Chi tiết thêm" của dòng —
              cột riêng hai ô trống "Theo tên nhóm / Thông số kỹ thuật" khó hiểu và chiếm chỗ. */}
          <Table className="min-w-[60rem] table-fixed [&_td]:align-middle">
            {/* Thiết bị ~36%, năm cột sau chia đều phần còn lại (cột không khai bề rộng); ô nhập trong cột có bề rộng
                riêng theo nội dung — cột rộng ra thì ô không kéo dài theo (trưởng nhóm: ô không dài ngoằng). */}
            <colgroup>
              <col className="w-10" />
              <col className="w-[32%]" />
              <col />
              <col />
              <col className="w-20" />
              <col />
              <col />
              <col />
              <col className="w-12" />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Thiết bị</TableHead>
                <TableHead>Mục đích</TableHead>
                <TableHead>Số lượng</TableHead>
                <TableHead>Đơn vị</TableHead>
                <TableHead>Đơn giá (đ)</TableHead>
                <TableHead>Ưu tiên</TableHead>
                <TableHead />
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((f: any, i) => (
                <TableRow key={f.id}>
                  <TableCell className="text-muted-foreground tabular-nums">{i + 1}</TableCell>
                  {/* whitespace-normal: ô bảng mặc định không xuống dòng — tên dài, cảnh báo "Đã có trong …" tràn đè cột bên. */}
                  <TableCell className="whitespace-normal">
                    {(() => {
                      const label: string = lines?.[i]?.catalogLabel || "";
                      const cut = label.indexOf(" · ");
                      const code = cut > 0 ? label.slice(0, cut) : "";
                      const name = cut > 0 ? label.slice(cut + 3) : label;
                      // Hơn một nghìn thiết bị (danh mục tối thiểu): tìm ở máy chủ, không đổ sẵn vào ô chọn.
                      const picker = (trigger?: ReactNode) => (
                        <Controller control={control} name={`lines.${i}.catalogId`} render={({ field }) => (
                          <AsyncCombobox<any>
                            resource="equipment_catalogs"
                            value={field.value ? Number(field.value) : null}
                            onChange={(id) => field.onChange(id == null ? "" : String(id))}
                            onPick={(c) => setValue(`lines.${i}.catalogLabel`, `${c.code} · ${c.name}`)}
                            labelOf={(c) => `${c.code} · ${c.name}`}
                            fallbackLabel={label || null}
                            placeholder="Vui lòng chọn thiết bị"
                            searchPlaceholder="Tìm theo tên hoặc mã DM thiết bị…"
                            trigger={trigger}
                            pinCurrent={!!trigger}
                            clearable={!trigger}
                          />
                        )} />
                      );
                      if (!lines?.[i]?.catalogId || !label) return picker();
                      const first = lineWithCatalog(lines, String(lines[i].catalogId));
                      return (
                        <div className="space-y-1.5">
                          {/* "Đổi thiết bị" nối ngay sau tên (cùng dòng chữ) — đặt ở mép phải cột thì cột rộng là nó
                              cách tên cả gang tay, khó nhận ra nó đi với thiết bị nào. */}
                          <div className="min-w-0">
                            {code ? <div className="text-muted-foreground font-mono text-xs">{code}</div> : null}
                            <div className="font-medium">
                              {name}
                              <span className="ms-2 inline-block align-baseline">
                                {picker(
                                  <button type="button" title="Đổi sang thiết bị khác"
                                    className="text-primary inline-flex items-center gap-1 text-xs font-normal whitespace-nowrap hover:underline">
                                    <RefreshCw className="size-3" /> Đổi thiết bị
                                  </button>,
                                )}
                              </span>
                            </div>
                          </div>
                          <OverlapNote newTab list={overlaps.get(Number(lines[i].catalogId))}
                            duplicateOf={first != null && first !== i + 1 ? first : undefined} />
                        </div>
                      );
                    })()}
                  </TableCell>
                  <TableCell><LineSelect control={control} name={`lines.${i}.kind`} options={opts(PURCHASE_LINE_KIND_LABELS)} className="w-28" /></TableCell>
                  <TableCell><LineInput control={control} name={`lines.${i}.quantity`} type="number" label="Số lượng" numberRule="QUANTITY" className="w-18" /></TableCell>
                  {/* Đơn vị tính theo danh mục, không sửa: Gam (hoá chất), Chiếc (máy chiếu), Tờ (lược đồ)… */}
                  <TableCell className="text-muted-foreground">{units.get(Number(lines?.[i]?.catalogId)) ?? lines?.[i]?.unitName ?? ""}</TableCell>
                  <TableCell>
                    <FormField control={control} name={`lines.${i}.unitPrice`} rules={numberRules("MONEY", "Đơn giá")} render={({ field }) => (
                      <>
                        <FormControl>
                          <MoneyInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} placeholder="0" className="w-28" />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </>
                    )} />
                  </TableCell>
                  <TableCell>
                    <LineSelect control={control} name={`lines.${i}.priority`} className="w-26"
                      options={Object.entries(PRIORITY_LABELS).map(([value, label]) => ({ value, label }))} />
                  </TableCell>
                  <TableCell>
                    <Controller control={control} name={`lines.${i}.details`} render={({ field }) => (
                      <LineDetailsButton config={config} value={field.value} onChange={field.onChange} schoolId={schoolId}
                        title={`Dòng ${i + 1}`} label="Chi tiết thêm" buttonClassName="text-primary hover:text-primary bg-info-subtle hover:bg-info-subtle border-primary/40 shadow-e1 rounded-full border font-semibold hover:brightness-95"
                        // Tên cụ thể / thông số kỹ thuật của thiết bị cần mua — không bắt buộc; tên trống thì máy chủ lấy tên
                        // trong danh mục. Bên mua (Sở) đọc ở màn kế hoạch và file Excel kế hoạch.
                        extras={[
                          { key: "name", label: "Tên cụ thể", placeholder: "Để trống thì dùng tên trong danh mục", max: maxLengthOf("NAME") },
                          // "Mô tả, yêu cầu chung" — không gọi "Thông số kỹ thuật": bảng thông số (tên · giá trị · đơn vị)
                          // ngay bên dưới đã mang tên đó.
                          { key: "specification", label: "Mô tả, yêu cầu chung", placeholder: "Kích thước, chất liệu, cấu hình… mà trường cần", max: 1000, wide: true },
                        ]}
                        // Hàng 1: ba ô ngắn (tên rộng nhất); hàng 2: mô tả cả hàng; dưới: bảng thông số và phụ kiện cạnh nhau.
                        layout={[
                          { key: "name", span: 6 }, { key: "brandOrigin", span: 4 }, { key: "gradeLevel", span: 2 },
                          { key: "specification", span: 12 },
                        ]}
                        extraValues={{ name: lines?.[i]?.name, specification: lines?.[i]?.specification }}
                        onExtraChange={(v) => {
                          setValue(`lines.${i}.name`, v.name, { shouldDirty: true });
                          setValue(`lines.${i}.specification`, v.specification, { shouldDirty: true });
                        }} />
                    )} />
                  </TableCell>
                  <TableCell>
                    <Button type="button" variant="ghost" size="icon" title="Bỏ dòng" onClick={() => remove(i)}>
                      <Trash2 className="text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {/* Đơn giá không bắt buộc: trường đề xuất nhu cầu, giá do cơ quan lập kế hoạch xác định — chỉ nhắc, không chặn trình. */}
      {unpriced > 0 ? (
        <p className="text-warning-text flex items-center gap-1.5 border-t px-4 py-2.5 text-xs">
          <TriangleAlert className="size-3.5 shrink-0" />
          {unpriced} thiết bị chưa có đơn giá — cơ quan quản lý sẽ xác định khi lập kế hoạch mua sắm.
        </p>
      ) : null}
    </div>
  );
}

function ProposalFields({ control, record, setValue }: { control: Control<any>; record?: any; setValue: any }) {
  const schoolId = useVoucherSchoolId(control, record);
  const [picking, setPicking] = useState(false);
  const { data: adequacy } = useAdequacy(schoolId);
  const overlaps = useProposalOverlaps(schoolId, record?.id, schoolId != null);
  const array = useFieldArray({ control, name: "lines" });
  const lines = useWatch({ control, name: "lines" }) as any[] | undefined;
  const chosen = new Set((lines ?? []).map((l) => Number(l?.catalogId)).filter((id) => id > 0));

  return (
    <div className="space-y-6">
      {/* Ba cột, thẳng hàng với khối "Thông tin bổ sung" (ba ô) bên dưới: hàng 1 ba ô ngắn; hàng 2 "Sự cần thiết"
          hai cột (bắt buộc, viết dài) + "Ghi chú" một cột. Ô ngày giãn theo cột (bỏ trần max-w-40). */}
      <div className="grid grid-cols-1 items-start gap-x-4 gap-y-5 @md:grid-cols-2 @2xl:grid-cols-3 [&_[data-date-input]]:max-w-none">
        <div className="empty:hidden @md:col-span-2 @2xl:col-span-3">
          <VoucherSchoolField control={control} record={record} setValue={setValue} />
        </div>
        <DateField control={control} name="proposalDate" label="Ngày đề xuất" rules={{ required: "Chọn ngày" }} />
        <TextField control={control} name="budgetYear" label="Năm ngân sách" description="Năm dự kiến mua. Cơ quan quản lý lập kế hoạch mua sắm theo năm này." type="number"
          rules={{ validate: (v: unknown) => v == null || v === "" || (Number.isInteger(Number(v)) && Number(v) >= 1950 && Number(v) <= 2100) || "Năm ngân sách phải từ 1950 đến 2100" }} />
        <SelectField control={control} name="fundingSource" label="Nguồn kinh phí dự kiến" options={opts(PURCHASE_FUNDING)} />
        <TextareaField control={control} name="reason" label="Sự cần thiết" rule="LONG_TEXT" max={1000} inGrid
          placeholder="Thiếu so với định mức, thay thiết bị hỏng, chương trình mới…"
          description="Vì sao cần mua. Bắt buộc khi trình." />
        <TextareaField control={control} name="note" label="Ghi chú" rule="NOTE" inGrid className="@2xl:col-span-1" />
      </div>
      {/* Bảng định mức không nằm trong form nữa: nó là hộp chọn mở từ nút "Thêm thiết bị",
          cùng khuôn với phiếu ghi tăng — form chỉ còn các dòng đã chọn. */}
      <VoucherLinesCard>
        <PurchaseLinesField control={control} array={array} schoolId={schoolId} overlaps={overlaps} onAdd={() => setPicking(true)} />
      </VoucherLinesCard>
      <ProposalPickerDialog
        open={picking}
        onOpenChange={setPicking}
        schoolId={schoolId}
        adequacy={adequacy}
        overlaps={overlaps}
        exclude={chosen}
        onPick={(rows) => {
          for (const r of rows) {
            if (chosen.has(r.catalogId)) continue;
            array.append(blankLine(String(r.catalogId), "", String(r.quantity), r.label));
          }
        }}
      />
    </div>
  );
}

export const PurchaseProposalList = () => {
  const columns = useMemo(() => {
    const h = createColumnHelper<PurchaseProposal>();
    return [
      h.accessor("proposalDate", { id: "proposalDate", header: "Ngày", enableSorting: true, cell: ({ getValue }) => formatPlainDate(getValue()) }),
      h.accessor("budgetYear", { id: "budgetYear", header: "Năm NS", enableSorting: true }),
      h.display({
        id: "amount",
        header: "Dự toán",
        cell: ({ row }) => <span className="tabular-nums">{money.format(row.original.totalAmount)} đ</span>,
      }),
      h.display({
        id: "plan",
        header: "Kế hoạch",
        cell: ({ row }) => row.original.plan
          ? <Link className="text-primary hover:underline" to={`/procurement-plans/show/${row.original.plan.id}`}>{row.original.plan.title}</Link>
          : <span className="text-muted-foreground">—</span>,
      }),
    ];
  }, []);
  return (
    <VoucherList<PurchaseProposal>
      resource={RESOURCE}
      columns={columns}
    />
  );
};

/** "N thiết bị đã có trong đề xuất khác" trên thẻ bên phải của form — cùng truy vấn với bảng dòng. */
function ProposalOverlapNotice({ control, record }: { control: Control<any>; record?: any }) {
  const schoolId = useVoucherSchoolId(control, record);
  const overlaps = useProposalOverlaps(schoolId, record?.id, schoolId != null);
  const lines = useWatch({ control, name: "lines" }) as any[] | undefined;
  const count = new Set((lines ?? []).map((l) => Number(l?.catalogId)).filter((id) => id && overlaps.has(id))).size;
  return <OverlapSummary count={count} />;
}

const overlapNotice = (p: { control: Control<any>; record?: any }) => <ProposalOverlapNotice {...p} />;

export const PurchaseProposalCreate = () => (
  <VoucherFormPage mode="create" required={[{ name: "reason", label: "Sự cần thiết" }]} defaults={DEFAULTS} toPayload={toPayload} notice={overlapNotice}>
    {(p) => <ProposalFields {...p} />}
  </VoucherFormPage>
);

export const PurchaseProposalEdit = () => (
  <VoucherFormPage mode="edit" required={[{ name: "reason", label: "Sự cần thiết" }]} defaults={DEFAULTS} toForm={toForm} toPayload={toPayload} notice={overlapNotice}>
    {(p) => <ProposalFields {...p} />}
  </VoucherFormPage>
);

/** Hàng về: lập phiếu nhập nháp từ đề xuất rồi mở nó ra để cán bộ đếm và trình. */
function CreateIntakeButton({ record }: { record: PurchaseProposal }) {
  const { open: notify } = useNotification();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      const r = await kyInstance.post(`${RESOURCE}/${record.id}/intake`).json<{ intakeId: number }>();
      notify?.({ type: "success", message: "Đã lập phiếu ghi tăng nháp. Kiểm đếm số thực nhận rồi trình." });
      navigate(`/equipment-intakes/edit/${r.intakeId}`);
    } catch (error) {
      notify?.({ type: "error", message: await errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button type="button" onClick={() => void run()} disabled={busy}>
      <PackageCheck />
      Hàng về, lập phiếu ghi tăng
    </Button>
  );
}

export const PurchaseProposalShow = () => {
  const { result: record, query } = useShow<PurchaseProposal>({});
  const config = useVoucherForm(RESOURCE);
  // Người duyệt thấy thiết bị nào đang được xin ở đề xuất khác — chỉ khi phiếu còn chờ quyết định.
  const deciding = record?.status === "DRAFT" || record?.status === "PENDING";
  const overlaps = useProposalOverlaps(record?.school?.id, record?.id, !!record && deciding);
  return (
    <VoucherShowShell
      resource={RESOURCE}
      print={{
        title: "Tờ trình đề xuất mua sắm thiết bị",
        table: {
          headers: ["STT", "Tên thiết bị, quy cách", "ĐVT", "SL", "Đơn giá (đ)", "Thành tiền (đ)", "Đang có / định mức"],
          alignRight: [3, 4, 5],
          rows: (record?.lines ?? []).map((l) => [
            l.lineNo,
            l.specification ? `${l.name} — ${l.specification}` : l.name,
            l.unitName ?? "",
            l.quantity,
            l.unitPrice != null ? money.format(l.unitPrice) : "",
            l.amount != null ? money.format(l.amount) : "",
            `${l.currentQuantity ?? "—"} / ${l.requiredQuantity ?? "—"}`,
          ]),
        },
        signers: ["Người lập", "Thủ trưởng đơn vị"],
      }}
      kind="Đề xuất mua sắm"
      record={record}
      loading={query.isLoading}
      facts={[
        { label: "Ngày đề xuất", value: formatPlainDate(record?.proposalDate) },
        { label: "Năm ngân sách", value: record?.budgetYear ?? "—" },
        { label: "Nguồn kinh phí dự kiến", value: record?.fundingSource ? FUNDING_LABELS[record.fundingSource] : "—" },
        { label: "Dự toán", value: record ? `${money.format(record.totalAmount)} đ (${record.totalQuantity} đơn vị)` : "—" },
        {
          label: "Kế hoạch mua sắm",
          value: record?.plan
            ? <Link className="text-primary hover:underline" to={`/procurement-plans/show/${record.plan.id}`}>{record.plan.title}</Link>
            : record?.status === "APPROVED" ? "Chờ cơ quan quản lý đưa vào kế hoạch" : "—",
        },
        ...(record?.intakeId
          ? [{ label: "Phiếu ghi tăng", value: <Link className="text-primary hover:underline" to={`/equipment-intakes/show/${record.intakeId}`}>Xem phiếu ghi tăng</Link> }]
          : []),
        { label: "Sự cần thiết", value: record?.reason ?? "—" },
      ]}
      actions={{
        text: {
          approve: { description: "Lãnh đạo trường xác nhận nhu cầu. Cơ quan quản lý đồng ý đưa vào kế hoạch mua sắm." },
          reject: { description: "Đề xuất dừng hẳn. Còn nhu cầu thì trường lập đề xuất mới." },
        },
      }}
      extraActions={record?._actions?.includes("intake") ? <CreateIntakeButton record={record} /> : null}
      attachmentsHint="Báo giá, thông số kỹ thuật, biên bản khảo sát nhu cầu."
    >
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">#</TableHead>
              <TableHead>Thiết bị</TableHead>
              <TableHead>Mục đích</TableHead>
              <TableHead className="text-right">SL</TableHead>
              <TableHead className="text-right">Đơn giá</TableHead>
              <TableHead className="text-right">Thành tiền</TableHead>
              <TableHead>Ưu tiên</TableHead>
              <TableHead className="text-right">Đang có / định mức</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(record?.lines ?? []).map((l) => (
              <TableRow key={l.id} className={cn("group/row", LIFT_ROW)}>
                <TableCell className="text-muted-foreground tabular-nums">{l.lineNo}</TableCell>
                <TableCell>
                  <div>{l.name}</div>
                  <div className="text-muted-foreground text-xs">{l.catalog.name}{l.specification ? ` · ${l.specification}` : ""}</div>
                  {deciding ? <OverlapNote className="mt-1" list={overlaps.get(l.catalog.id)} /> : null}
                  {lineDetailsText(config, l.details) ? <div className="text-muted-foreground text-xs">{lineDetailsText(config, l.details)}</div> : null}
                  {Array.isArray(l.details?.specs) && l.details.specs.length ? (
                    <div className="text-muted-foreground text-xs">
                      Thông số: {(l.details.specs as Record<string, unknown>[]).map((s) => `${s.attrName ?? ""} ${s.attrValue ?? ""}${s.unit ? " " + String(s.unit) : ""}`).join("; ")}
                    </div>
                  ) : null}
                  {Array.isArray(l.details?.accessoryLines) && l.details.accessoryLines.length ? (
                    <div className="text-muted-foreground text-xs">
                      Phụ kiện: {(l.details.accessoryLines as Record<string, unknown>[]).map((a) => `${a.name ?? ""}${a.quantity ? " × " + String(a.quantity) : ""}`).join("; ")}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell>{PURCHASE_LINE_KIND_LABELS[l.kind]}</TableCell>
                <TableCell className="text-right tabular-nums">{l.quantity} {l.unitName ?? ""}</TableCell>
                <TableCell className="text-right tabular-nums">{l.unitPrice != null ? money.format(l.unitPrice) : "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{l.amount != null ? money.format(l.amount) : "—"}</TableCell>
                <TableCell>
                  <Badge variant={l.priority === 1 ? "destructive" : l.priority === 2 ? "warning" : "neutral"}>{PRIORITY_LABELS[l.priority]}</Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">{l.currentQuantity ?? "—"} / {l.requiredQuantity ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={5} className="text-right font-medium">Tổng</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">{money.format(record?.totalAmount ?? 0)}</TableCell>
              <TableCell colSpan={2} />
            </TableRow>
          </TableFooter>
        </Table>
      </div>
      {/* Đề xuất lập từ chuẩn tối thiểu theo năm học: căn cứ từng dòng (điểm trường, chuẩn TT, điều chỉnh). */}
      {record ? <div className="mt-4"><StandardTraceBlock proposalId={record.id} /></div> : null}
    </VoucherShowShell>
  );
};
