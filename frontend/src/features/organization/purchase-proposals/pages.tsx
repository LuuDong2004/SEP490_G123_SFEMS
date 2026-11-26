import { useCan, useNotification, useShow } from "@refinedev/core";
import { AddLinesButton, AddLinesEmpty } from "@/shared/components/voucher/add-lines";
import { useQueries, useQuery } from "@tanstack/react-query";
import { createColumnHelper } from "@tanstack/react-table";
import { ClipboardCheck, Info, PackageCheck, RefreshCw, Trash2 } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Controller, useFieldArray, useFormContext, useWatch, type Control, type UseFieldArrayReturn } from "react-hook-form";
import { Link, useNavigate } from "react-router";

import { kyInstance } from "@/shared/api/data";
import { AsyncCombobox } from "@/shared/components/form/async-combobox";
import { MoneyInput } from "@/shared/components/form/money-input";
import { DateField, TextareaField, TextField } from "@/shared/components/form/simple-fields";
import { VoucherFormPage } from "@/shared/components/voucher/voucher-form-page";
import { VoucherList } from "@/shared/components/voucher/voucher-list";
import { VoucherShowShell } from "@/shared/components/voucher/voucher-show-shell";
import { StandardTraceBlock, useStandardTraces } from "../school-year/standard-trace";
import { errorMessage } from "@/shared/lib/api-error";
import { formatPlainDate, todayLocal } from "@/shared/lib/format";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { StepTitle, VoucherLinesCard } from "@/shared/components/voucher/voucher-layout";
import { FormControl, FormField, FormMessage } from "@/shared/ui/form";
import { maxLengthOf, numberMax, numberRules, textRules, type NumberRule, type TextRule } from "@/shared/lib/field-rules";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import {
  PURCHASE_LINE_KIND_LABELS,
  type PurchaseProposal,
  type SchoolAdequacy,
} from "@/domains/procurement/types";
import { useVoucherSchoolId, VoucherSchoolField } from "@/features/organization/vouchers/voucher-school-field";
import { OverlapNote, OverlapSummary, useProposalOverlaps, type OverlapIndex } from "./overlap";
import { ProposalPickerDialog } from "./picker";
import { LIFT_ROW } from "@/shared/lib/row-lift";
import { cn } from "@/shared/lib/utils";
import { usePerspective } from "@/shared/hooks/use-perspective";

/* eslint-disable @typescript-eslint/no-explicit-any */

const RESOURCE = "purchase_proposals";
/*
 * Đề xuất mua sắm là trường xin Sở cấp kinh phí: thiết bị nào, bao nhiêu, giá tham khảo (nếu có báo giá), vì sao cần. Nguồn kinh phí,
 * mức ưu tiên, thông số, thương hiệu, thời hạn, báo giá là việc của Sở khi lập kế hoạch mua sắm — phiếu không hỏi (301).
 */

const money = new Intl.NumberFormat("vi-VN");
const opts = (m: Record<string, string>) => Object.entries(m).map(([value, label]) => ({ value, label }));

const DEFAULTS = {
  school: { id: null },
  // Getter: tính lúc form mount (khi `defaults` được trải ra), không chốt lúc tải trang.
  get proposalDate() {
    return todayLocal();
  },
  budgetYear: String(new Date().getFullYear() + 1),
  reason: "",
  note: "",
  lines: [] as any[],
};

const toForm = (r: PurchaseProposal) => ({
  school: { id: r.school?.id },
  proposalDate: r.proposalDate,
  budgetYear: r.budgetYear == null ? "" : String(r.budgetYear),
  reason: r.reason ?? "",
  note: r.note ?? "",
  lines: r.lines.map((l) => ({
    catalogId: String(l.catalog.id),
    catalogLabel: `${l.catalog.code} · ${l.catalog.name}`,
    kind: l.kind,
    unitName: l.unitName ?? "",
    quantity: String(l.quantity),
    unitPrice: l.unitPrice == null ? "" : String(l.unitPrice),
    note: l.note ?? "",
  })),
});

const num = (v: any) => (v === "" || v == null ? null : Number(v));

const toPayload = (v: any) => ({
  school: v.school?.id ? { id: v.school.id } : null,
  proposalDate: v.proposalDate,
  budgetYear: num(v.budgetYear),
  reason: v.reason,
  note: v.note,
  lines: (v.lines ?? []).map((l: any) => ({
    catalog: l.catalogId ? { id: Number(l.catalogId) } : null,
    kind: l.kind,
    // Tên theo danh mục của thiết bị — máy chủ tự lấy khi trống.
    name: null,
    // Đơn vị tính theo danh mục của thiết bị — máy chủ tự lấy khi trống; gửi giá trị cũ của form thì đổi thiết bị
    // xong vẫn mang đơn vị của thiết bị trước.
    unitName: null,
    quantity: num(l.quantity),
    unitPrice: num(l.unitPrice),
    note: l.note,
  })),
});

const blankLine = (catalogId = "", quantity = "1", catalogLabel = ""): Record<string, any> => ({
  catalogId,
  catalogLabel,
  kind: "NEW",
  unitName: "",
  quantity,
  unitPrice: "",
  note: "",
});

/** Thiết bị có trong danh mục tối thiểu của trường (theo bảng định mức); `undefined` khi chưa có dữ liệu. */
function normCatalogSet(adequacy: SchoolAdequacy | undefined): Set<number> | undefined {
  if (!adequacy?.rows) return undefined;
  return new Set(adequacy.rows.map((r) => r.catalogId).filter((id): id is number => id != null));
}

/**
 * Nhãn của dòng xin thiết bị KHÔNG có trong danh mục tối thiểu (chọn ở tab "Toàn bộ danh mục": thay cái hỏng, thiết bị
 * dùng chung…) — để lãnh đạo trường và Sở thấy ngay dòng nào ngoài định mức khi xét.
 */
function OutsideNormBadge({ outside }: { outside: boolean }) {
  return outside ? <Badge variant="warning" size="sm" className="mt-1">Ngoài danh mục tối thiểu</Badge> : null;
}

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

function PurchaseLinesField({ control, array, schoolId, overlaps, onAdd, normCatalogs }: {
  control: Control<any>;
  array: UseFieldArrayReturn<any, "lines">;
  schoolId: number | null;
  overlaps: OverlapIndex;
  /** Thiết bị có trong danh mục tối thiểu của trường; `undefined` khi chưa tải xong (khi đó không gắn nhãn). */
  normCatalogs?: Set<number>;
  /** Mở hộp "Chọn thiết bị cần mua". */
  onAdd: () => void;
}) {
  const { setValue } = useFormContext();
  const { fields, remove } = array;
  const lines = useWatch({ control, name: "lines" }) as any[] | undefined;
  const total = (lines ?? []).reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0);
  const unpriced = fields.length ? (lines ?? []).filter((l) => !(Number(l?.unitPrice) > 0)).length : 0;
  const units = useCatalogUnits([...new Set((lines ?? []).map((l) => Number(l?.catalogId)).filter((id) => id > 0))]);
  return (
    <div>
      <div className="flex items-center justify-between gap-3 px-4 py-3.5">
        <StepTitle title="Thiết bị đề xuất" aside={fields.length ? `${fields.length} dòng${total > 0 ? ` · tổng giá tham khảo ${money.format(total)} đ` : ""}` : undefined} />
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
              ghim đầu danh sách). */}
          <Table className="min-w-[60rem] table-fixed [&_td]:align-middle">
            {/* Thiết bị ~40%, các cột sau chia đều phần còn lại (cột không khai bề rộng); ô nhập trong cột có bề rộng
                riêng theo nội dung — cột rộng ra thì ô không kéo dài theo (trưởng nhóm: ô không dài ngoằng). */}
            {/* Hai cột tiền rộng đủ số trăm tỷ (trần MONEY) — ô tiền giãn theo cột, không chặn ở bề rộng cố định. */}
            <colgroup>
              <col className="w-10" />
              <col className="w-[34%]" />
              <col />
              <col className="w-24" />
              <col className="w-16" />
              <col className="w-44" />
              <col className="w-40" />
              <col className="w-12" />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Thiết bị</TableHead>
                <TableHead>Mục đích</TableHead>
                <TableHead>Số lượng</TableHead>
                <TableHead>Đơn vị</TableHead>
                <TableHead title="Giá MỘT đơn vị theo báo giá, không bắt buộc. Sở chốt giá khi lập kế hoạch">Đơn giá tham khảo (đ)</TableHead>
                <TableHead className="text-right">Thành tiền (đ)</TableHead>
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
                          <OutsideNormBadge outside={normCatalogs != null && !normCatalogs.has(Number(lines[i].catalogId))} />
                          <OverlapNote newTab list={overlaps.get(Number(lines[i].catalogId))}
                            duplicateOf={first != null && first !== i + 1 ? first : undefined} />
                        </div>
                      );
                    })()}
                  </TableCell>
                  <TableCell><LineSelect control={control} name={`lines.${i}.kind`} options={opts(PURCHASE_LINE_KIND_LABELS)} className="w-28" /></TableCell>
                  <TableCell data-quantity-line={i}><LineInput control={control} name={`lines.${i}.quantity`} type="number" label="Số lượng" numberRule="QUANTITY" className="w-18" /></TableCell>
                  {/* Đơn vị tính theo danh mục, không sửa: Gam (hoá chất), Chiếc (máy chiếu), Tờ (lược đồ)… */}
                  <TableCell className="text-muted-foreground">{units.get(Number(lines?.[i]?.catalogId)) ?? lines?.[i]?.unitName ?? ""}</TableCell>
                  <TableCell>
                    <FormField control={control} name={`lines.${i}.unitPrice`} rules={numberRules("MONEY", "Đơn giá tham khảo")} render={({ field }) => (
                      <>
                        <FormControl>
                          <MoneyInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} placeholder="Nếu có"
                            maxValue={numberMax("MONEY")} className="w-full" />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </>
                    )} />
                  </TableCell>
                  {/* Thành tiền = số lượng × đơn giá tham khảo; chưa ghi giá thì để trống. */}
                  <TableCell className="text-right tabular-nums">
                    {Number(lines?.[i]?.unitPrice) > 0
                      ? money.format((Number(lines?.[i]?.quantity) || 0) * Number(lines?.[i]?.unitPrice))
                      : <span className="text-muted-foreground text-xs">Chưa có giá</span>}
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
      {/* Giá tham khảo không bắt buộc: trường đề xuất nhu cầu, Sở chốt giá khi lập kế hoạch — chỉ nhắc, không chặn trình. */}
      {unpriced > 0 ? (
        <p className="text-muted-foreground flex items-center gap-1.5 border-t px-4 py-2.5 text-xs">
          <Info className="size-3.5 shrink-0" />
          {unpriced} thiết bị chưa có giá tham khảo. Không bắt buộc, có báo giá thì ghi và đính kèm để Sở căn cứ lập kế hoạch.
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
      {/* Ba cột: hàng 1 ba ô ngắn (ngày, năm ngân sách, số công văn trình); hàng 2 "Lý do đề xuất" hai cột (bắt buộc,
          viết dài) + "Ghi chú" một cột. Ô ngày giãn theo cột (bỏ trần max-w-40). */}
      <div className="grid grid-cols-1 items-start gap-x-4 gap-y-5 @md:grid-cols-2 @2xl:grid-cols-3 [&_[data-date-input]]:max-w-none">
        <div className="empty:hidden @md:col-span-2 @2xl:col-span-3">
          <VoucherSchoolField control={control} record={record} setValue={setValue} />
        </div>
        <DateField control={control} name="proposalDate" label="Ngày đề xuất" rules={{ required: "Chọn ngày" }} />
        <TextField control={control} name="budgetYear" label="Năm ngân sách" description="Năm dự kiến mua. Sở lập kế hoạch mua sắm theo năm này." type="number"
          rules={{ required: "Vui lòng nhập năm ngân sách", validate: (v: unknown) => (Number.isInteger(Number(v)) && Number(v) >= 2000 && Number(v) <= 2100) || "Năm ngân sách phải từ 2000 đến 2100" }} />
        {/* Trường chứng từ (`details`, voucher-forms/purchase_proposals.json, mục `inline`) — đặt ở đây thay vì
            đứng riêng một khối "Thông tin bổ sung" chỉ có một ô. */}
        <TextField control={control} name="details.submittedDocNo" label="Số công văn trình" rule="SHORT_TEXT" max={100}
          placeholder="VD: 125/THPT-CSVC" />
        <TextareaField control={control} name="reason" label="Lý do đề xuất" rule="LONG_TEXT" max={1000} inGrid
          placeholder="Thiếu so với định mức, thay thiết bị hỏng, chương trình mới…"
          description="Vì sao cần mua. Bắt buộc khi trình." />
        <TextareaField control={control} name="note" label="Ghi chú" rule="NOTE" inGrid className="@2xl:col-span-1" />
      </div>
      {/* Bảng định mức không nằm trong form nữa: nó là hộp chọn mở từ nút "Thêm thiết bị",
          cùng khuôn với phiếu ghi tăng — form chỉ còn các dòng đã chọn. */}
      <VoucherLinesCard>
        <PurchaseLinesField control={control} array={array} schoolId={schoolId} overlaps={overlaps} onAdd={() => setPicking(true)}
          normCatalogs={normCatalogSet(adequacy)} />
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
            array.append(blankLine(String(r.catalogId), String(r.quantity), r.label));
          }
        }}
      />
    </div>
  );
}

/**
 * Ô "Kế hoạch" của một đề xuất: mã kế hoạch (rê chuột thấy tên), bấm mở kế hoạch. Cùng luật xem của máy chủ
 * (`ProcurementPlanService.visible`): tài khoản TRƯỜNG chỉ xem kế hoạch ĐÃ DUYỆT — chưa duyệt thì với trường đề xuất như
 * chưa có kế hoạch (cùng chữ với đề xuất chưa vào kế hoạch nào). Mọi tài khoản Sở xem mọi kế hoạch của Sở, cả bản nháp.
 */
function PlanCell({ proposal, small }: { proposal: PurchaseProposal; small?: boolean }) {
  const { perspective } = usePerspective();
  const plan = proposal.plan;
  const visible = !!plan && (plan.status === "APPROVED" || perspective !== "school");
  if (!plan || !visible) {
    const text = proposal.status === "APPROVED" ? "Chờ Sở đưa vào kế hoạch" : "Chưa có kế hoạch";
    return small ? <span className="text-muted-foreground text-xs">{text}</span> : <>{text}</>;
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link className={cn("text-primary font-mono font-medium hover:underline", small && "text-xs")} to={`/procurement-plans/show/${plan.id}`}>
          {plan.code ?? plan.title}
          {/* Kế hoạch chưa duyệt (chỉ Sở thấy): ghi kèm tình trạng để biết đề xuất đang ở bản nháp hay chờ duyệt. */}
          {plan.status === "APPROVED" ? null : (
            <span className="text-muted-foreground font-sans font-normal"> · {plan.status === "PENDING" ? "chờ duyệt" : "nháp"}</span>
          )}
        </Link>
      </TooltipTrigger>
      <TooltipContent>{plan.title}</TooltipContent>
    </Tooltip>
  );
}

export const PurchaseProposalList = () => {
  const { data: canPlan } = useCan({ resource: "procurement_plans", action: "create" });
  const navigate = useNavigate();
  const columns = useMemo(() => {
    const h = createColumnHelper<PurchaseProposal>();
    return [
      h.accessor("proposalDate", { id: "proposalDate", header: "Ngày", enableSorting: true, cell: ({ getValue }) => formatPlainDate(getValue()) }),
      h.accessor("budgetYear", { id: "budgetYear", header: "Năm NS", enableSorting: true }),
      h.display({
        id: "amount",
        header: "Tổng giá tham khảo",
        cell: ({ row }) => row.original.totalAmount > 0
          ? <span className="tabular-nums">{money.format(row.original.totalAmount)} đ</span>
          : <span className="text-muted-foreground text-xs">Chưa có giá</span>,
      }),
      h.display({
        id: "plan",
        header: "Kế hoạch",
        // Mã kế hoạch (gọn, không bị cắt như tên dài); tên kế hoạch hiện khi rê chuột.
        cell: ({ row }) => <PlanCell proposal={row.original} small />,
      }),
    ];
  }, []);
  return (
    <VoucherList<PurchaseProposal>
      resource={RESOURCE}
      columns={columns}
      // Luồng đề xuất cố định: lãnh đạo trường → lãnh đạo Sở.
      approvalChain={["SCHOOL", "MANAGING_BODY"]}
      // Chuyên viên Sở chọn các đề xuất đã duyệt, chưa vào kế hoạch rồi lập kế hoạch từ chúng — màn lập kế hoạch nhận
      // sẵn các đề xuất đó (`?proposals=`).
      selection={{
        enabled: !!canPlan?.can,
        selectable: (r) => r.status === "APPROVED" && !r.plan,
        action: (ids) => {
          const button = (
            <Button type="button" size="sm" className="h-9 rounded-full" disabled={!ids.length}
              onClick={() => navigate(`/procurement-plans/create?proposals=${ids.join(",")}`)}>
              <ClipboardCheck />
              Lập kế hoạch{ids.length ? ` từ ${ids.length} đề xuất` : ""}
            </Button>
          );
          // Chưa chọn thì nút khoá — bọc một lớp để khung gợi ý của hệ thống vẫn hiện khi rê chuột.
          return ids.length ? button : (
            <Tooltip>
              <TooltipTrigger asChild><span tabIndex={0} className="inline-flex">{button}</span></TooltipTrigger>
              <TooltipContent>Tích chọn các đề xuất đã duyệt, chưa vào kế hoạch</TooltipContent>
            </Tooltip>
          );
        },
      }}
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

/**
 * "Kiểm tra trước khi trình" — cùng luật máy chủ kiểm lúc trình (`PurchaseProposalService.validateSubmit`): có ngày, năm
 * ngân sách (kế hoạch của Sở chỉ nhận đề xuất cùng năm ngân sách), lý do đề xuất, ít nhất một dòng, từng dòng có thiết bị,
 * số lượng lớn hơn 0 và không trùng thiết bị với dòng khác.
 */
const REQUIRED = [
  { name: "proposalDate", label: "Ngày đề xuất" },
  { name: "budgetYear", label: "Năm ngân sách" },
  { name: "reason", label: "Lý do đề xuất" },
];

function proposalLineIssue(line: any, index: number, lines: any[]): string | null {
  if (!line?.catalogId) return "chưa chọn thiết bị";
  const quantity = Number(line.quantity);
  if (!Number.isInteger(quantity) || quantity <= 0) return "số lượng phải lớn hơn 0";
  const first = lines.findIndex((l) => l?.catalogId && String(l.catalogId) === String(line.catalogId));
  return first >= 0 && first < index ? `trùng thiết bị với dòng ${first + 1}, gộp thành một dòng` : null;
}

export const PurchaseProposalCreate = () => (
  <VoucherFormPage mode="create" required={REQUIRED} lineIssue={proposalLineIssue} defaults={DEFAULTS} toPayload={toPayload} notice={overlapNotice}>
    {(p) => <ProposalFields {...p} />}
  </VoucherFormPage>
);

export const PurchaseProposalEdit = () => (
  <VoucherFormPage mode="edit" required={REQUIRED} lineIssue={proposalLineIssue} defaults={DEFAULTS} toForm={toForm} toPayload={toPayload} notice={overlapNotice}>
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
  // Người duyệt thấy thiết bị nào đang được xin ở đề xuất khác — chỉ khi phiếu còn chờ quyết định.
  const deciding = record?.status === "DRAFT" || record?.status === "PENDING";
  const overlaps = useProposalOverlaps(record?.school?.id, record?.id, !!record && deciding);
  // Lập từ chuẩn tối thiểu của một năm học trường CHƯA XÁC NHẬN đã khai: trình vẫn được (bỏ luật chặn 20/11 — trưởng nhóm 23/11/2026),
  // nhưng hộp trình nói trước để người trình biết số thiếu còn có thể đổi.
  const { data: traces } = useStandardTraces({ proposalId: record?.id });
  const openYear = traces?.find((t) => !t.yearConfirmed)?.schoolYearName;
  const { data: adequacy } = useAdequacy(record?.school?.id);
  const normCatalogs = normCatalogSet(adequacy);
  const outsideCount = normCatalogs ? (record?.lines ?? []).filter((l) => !normCatalogs.has(l.catalog.id)).length : 0;
  const replaceCount = (record?.lines ?? []).filter((l) => l.kind === "REPLACE").length;
  return (
    <VoucherShowShell
      sideFacts={record ? [
        { label: "Thiết bị", value: `${record.lineCount} loại · ${money.format(record.totalQuantity)} đơn vị` },
        ...(replaceCount ? [{ label: "Thay thế", value: `${replaceCount} loại` }] : []),
        ...(outsideCount ? [{ label: "Ngoài danh mục tối thiểu", value: `${outsideCount} loại` }] : []),
        { label: "Tổng giá tham khảo", value: record.totalAmount > 0 ? `${money.format(record.totalAmount)} đ` : "Chưa có giá" },
        {
          label: "Kế hoạch mua sắm",
          value: <PlanCell proposal={record} />,
        },
        ...(record.intakeId
          ? [{ label: "Phiếu ghi tăng", value: <Link className="text-primary hover:underline" to={`/equipment-intakes/show/${record.intakeId}`}>Xem phiếu ghi tăng</Link> }]
          : []),
      ] : undefined}
      resource={RESOURCE}
      print={{
        title: "Tờ trình đề xuất mua sắm thiết bị",
        table: {
          headers: ["STT", "Tên thiết bị", "ĐVT", "SL", "Đơn giá tham khảo (đ)", "Thành tiền (đ)", "Đang có / định mức"],
          alignRight: [3, 4, 5],
          rows: (record?.lines ?? []).map((l) => [
            l.lineNo,
            l.name,
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
        { label: "Số công văn trình", value: typeof record?.details?.submittedDocNo === "string" ? record.details.submittedDocNo : "—" },
        // Tổng giá, kế hoạch, phiếu ghi tăng nằm ở thẻ tóm tắt bên phải (sideFacts) — không lặp ở đây.
        { label: "Lý do đề xuất", value: record?.reason ?? "—" },
      ]}
      actions={{
        text: {
          ...(openYear ? {
            submit: {
              description: (
                <div className="grid gap-1.5">
                  <div>Phiếu được chuyển tới người duyệt. Trong lúc chờ duyệt thì không sửa được.</div>
                  <div className="text-warning-text">
                    Trường chưa xác nhận đã khai {openYear?.toLowerCase()}, nên số thiếu trong đề xuất có thể còn đổi.
                    Phiếu sẽ mang nhãn "Chưa xác nhận năm học" để người duyệt biết.
                  </div>
                </div>
              ),
            },
          } : {}),
          approve: { description: "Lãnh đạo trường xác nhận nhu cầu. Lãnh đạo Sở đồng ý để chuyên viên Sở đưa vào kế hoạch mua sắm." },
          reject: { description: "Đề xuất dừng hẳn. Còn nhu cầu thì trường lập đề xuất mới." },
        },
      }}
      extraActions={record?._actions?.includes("intake") ? <CreateIntakeButton record={record} /> : null}
      attachmentsHint="Báo giá, công văn đề nghị, biên bản rà soát nhu cầu thiết bị."
    >
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">#</TableHead>
              <TableHead>Thiết bị</TableHead>
              <TableHead>Mục đích</TableHead>
              <TableHead className="text-right">SL</TableHead>
              <TableHead className="text-right">Đơn giá tham khảo</TableHead>
              <TableHead className="text-right">Thành tiền</TableHead>
              <TableHead className="text-right">Đang có / định mức</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(record?.lines ?? []).map((l) => (
              <TableRow key={l.id} className={cn("group/row", LIFT_ROW)}>
                <TableCell className="text-muted-foreground tabular-nums">{l.lineNo}</TableCell>
                <TableCell>
                  <div>{l.name}</div>
                  <div className="text-muted-foreground font-mono text-xs">{l.catalog.code}</div>
                  <OutsideNormBadge outside={normCatalogs != null && !normCatalogs.has(l.catalog.id)} />
                  {deciding ? <OverlapNote className="mt-1" list={overlaps.get(l.catalog.id)} /> : null}
                </TableCell>
                <TableCell>{PURCHASE_LINE_KIND_LABELS[l.kind]}</TableCell>
                <TableCell className="text-right tabular-nums">{l.quantity} {l.unitName ?? ""}</TableCell>
                <TableCell className="text-right tabular-nums">{l.unitPrice != null ? money.format(l.unitPrice) : <span className="text-muted-foreground text-xs">Chưa có giá</span>}</TableCell>
                <TableCell className="text-right tabular-nums">{l.amount != null ? money.format(l.amount) : <span className="text-muted-foreground text-xs">Chưa có giá</span>}</TableCell>
                <TableCell className="text-right tabular-nums">{l.currentQuantity ?? "—"} / {l.requiredQuantity ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={5} className="text-right font-medium">Tổng</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {record?.totalAmount ? money.format(record.totalAmount) : <span className="text-muted-foreground text-xs font-normal">Chưa có giá</span>}
              </TableCell>
              <TableCell />
            </TableRow>
          </TableFooter>
        </Table>
      </div>
      {/* Đề xuất lập từ chuẩn tối thiểu theo năm học: căn cứ từng dòng (điểm trường, chuẩn TT, điều chỉnh). */}
      {record ? <div className="mt-4"><StandardTraceBlock proposalId={record.id} /></div> : null}
    </VoucherShowShell>
  );
};
