import { useShow } from "@refinedev/core";
import { useQuery } from "@tanstack/react-query";
import { createColumnHelper } from "@tanstack/react-table";
import { Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Controller, useFieldArray, useWatch, type Control, type UseFieldArrayReturn } from "react-hook-form";
import { Link, useSearchParams } from "react-router";

import { kyInstance } from "@/shared/api/data";
import { AsyncCombobox } from "@/shared/components/form/async-combobox";
import { MoneyInput } from "@/shared/components/form/money-input";
import { SchoolField } from "@/shared/components/form/school-field";
import { DateField, SelectField, TextareaField, TextField } from "@/shared/components/form/simple-fields";
import { AddLinesButton, AddLinesEmpty } from "@/shared/components/voucher/add-lines";
import { AttachmentsPanel } from "@/shared/components/voucher/attachments-panel";
import { VoucherFormPage } from "@/shared/components/voucher/voucher-form-page";
import { StepTitle, VoucherLinesCard } from "@/shared/components/voucher/voucher-layout";
import { VoucherList } from "@/shared/components/voucher/voucher-list";
import { VoucherShowShell } from "@/shared/components/voucher/voucher-show-shell";
import { VoucherActions } from "@/shared/components/voucher/voucher-actions";
import { VoucherViewSwitch } from "@/shared/components/voucher/voucher-view-switch";
import { ShowView, ShowViewHeader } from "@/shared/components/views/show-view";
import { useVoucherView } from "@/shared/hooks/use-voucher-view";
import { formatPlainDate, todayLocal } from "@/shared/lib/format";
import { maxLengthOf, numberRules, textRules } from "@/shared/lib/field-rules";
import { LIFT_ROW } from "@/shared/lib/row-lift";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { FormControl, FormField, FormMessage } from "@/shared/ui/form";
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
import { ExportProposalButton, ExportProposalMenuItem, ProposalDocument } from "./document";
import { OverlapNote, OverlapSummary, useProposalOverlaps, type OverlapIndex } from "./overlap";
import { ProposalPickerDialog } from "./picker";

/* eslint-disable @typescript-eslint/no-explicit-any */

const RESOURCE = "purchase_proposals";
/**
 * Nguồn kinh phí dự kiến của một đề xuất MUA SẮM: hàng về sẽ ghi tăng với nguồn hình thành "Mua sắm", nên
 * gồm các nguồn đi được với nó — cả "Tài trợ" (nhà tài trợ cho tiền, trường tự mua), trừ "Chưa xác định nguồn".
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
    unitName: l.unitName,
    quantity: num(l.quantity),
    unitPrice: num(l.unitPrice),
    priority: num(l.priority),
    note: l.note,
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

/** Trường đang chọn trên form (ô Trường là thứ đầu tiên phải có). */
const useVoucherSchoolId = (control: Control<any>, record?: any): number | null => {
  const watched = useWatch({ control, name: "school.id" });
  const id = Number(watched);
  return Number.isFinite(id) && id > 0 ? id : (record?.school?.id ?? null);
};

function useAdequacy(schoolId: number | null | undefined) {
  return useQuery({
    queryKey: [RESOURCE, "adequacy", schoolId],
    enabled: schoolId != null,
    queryFn: ({ signal }) =>
      kyInstance
        .get(`${RESOURCE}/adequacy`, { signal, searchParams: { schoolId: String(schoolId) } })
        .json<SchoolAdequacy>(),
  });
}

/** Ô nhập chữ của một dòng thiết bị. */
function LineInput({ control, name, placeholder, label, rule, max, numberRule }: {
  control: Control<any>;
  name: string;
  placeholder?: string;
  /** Nhãn trong câu báo lỗi (tiêu đề cột). */
  label: string;
  rule?: "NAME" | "LONG_TEXT" | "NOTE";
  max?: number;
  numberRule?: "QUANTITY";
}) {
  return (
    <FormField
      control={control}
      name={name}
      rules={rule ? textRules(rule, label, { max }) : numberRule ? numberRules(numberRule, label) : undefined}
      render={({ field }) => (
        <>
          <FormControl>
            <Input
              type={numberRule ? "number" : "text"}
              value={field.value ?? ""}
              onChange={field.onChange}
              onBlur={field.onBlur}
              placeholder={placeholder}
              maxLength={rule ? maxLengthOf(rule, max) : undefined}
            />
          </FormControl>
          <FormMessage className="text-xs" />
        </>
      )}
    />
  );
}

function LineSelect({ control, name, options, className }: {
  control: Control<any>;
  name: string;
  options: { value: string; label: string }[];
  className?: string;
}) {
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

function PurchaseLinesField({ control, array, schoolId, overlaps, onAdd }: {
  control: Control<any>;
  array: UseFieldArrayReturn<any, "lines">;
  schoolId: number | null;
  overlaps: OverlapIndex;
  /** Mở hộp "Chọn thiết bị cần mua". */
  onAdd: () => void;
}) {
  const { fields, remove } = array;
  const lines = useWatch({ control, name: "lines" }) as any[] | undefined;
  const total = (lines ?? []).reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0);
  return (
    <div>
      <div className="flex items-center justify-between gap-3 px-4 py-3.5">
        <StepTitle
          title="Thiết bị đề xuất"
          aside={fields.length ? `${fields.length} dòng · dự toán ${money.format(total)} đ` : undefined}
        />
        {fields.length ? <AddLinesButton label="Thêm thiết bị" onClick={onAdd} disabled={schoolId == null} /> : null}
      </div>
      {fields.length === 0 ? (
        <AddLinesEmpty
          label="Thêm thiết bị"
          hint="Theo định mức còn thiếu hoặc từ danh mục"
          onClick={onAdd}
          disabled={schoolId == null}
          disabledLabel="Chọn trường trước"
        />
      ) : (
        <div className="overflow-x-auto border-t">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead className="min-w-52">Thiết bị</TableHead>
                <TableHead className="min-w-28">Loại</TableHead>
                <TableHead className="min-w-44">Tên / quy cách</TableHead>
                <TableHead className="w-24">Số lượng</TableHead>
                <TableHead className="w-36">Đơn giá (đ)</TableHead>
                <TableHead className="min-w-28">Ưu tiên</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((f: any, i) => (
                <TableRow key={f.id}>
                  <TableCell className="text-muted-foreground tabular-nums">{i + 1}</TableCell>
                  <TableCell>
                    {/* Hơn một nghìn thiết bị: tìm ở máy chủ, không đổ sẵn vào ô chọn. */}
                    <Controller
                      control={control}
                      name={`lines.${i}.catalogId`}
                      render={({ field }) => (
                        <AsyncCombobox<any>
                          resource="equipment_catalogs"
                          value={field.value ? Number(field.value) : null}
                          onChange={(id) => field.onChange(id == null ? "" : String(id))}
                          labelOf={(c) => `${c.code} · ${c.name}`}
                          fallbackLabel={lines?.[i]?.catalogLabel || null}
                          placeholder="Vui lòng chọn thiết bị"
                          searchPlaceholder="Tìm theo mã hoặc tên…"
                        />
                      )}
                    />
                    {lines?.[i]?.catalogId
                      ? (() => {
                          const first = lineWithCatalog(lines, String(lines[i].catalogId));
                          return (
                            <OverlapNote
                              className="mt-1.5"
                              newTab
                              list={overlaps.get(Number(lines[i].catalogId))}
                              duplicateOf={first != null && first !== i + 1 ? first : undefined}
                            />
                          );
                        })()
                      : null}
                  </TableCell>
                  <TableCell>
                    <LineSelect control={control} name={`lines.${i}.kind`} options={opts(PURCHASE_LINE_KIND_LABELS)} />
                  </TableCell>
                  <TableCell className="space-y-1">
                    <LineInput control={control} name={`lines.${i}.name`} placeholder="Theo tên nhóm" label="Tên" rule="NAME" />
                    <LineInput
                      control={control}
                      name={`lines.${i}.specification`}
                      placeholder="Thông số kỹ thuật"
                      label="Thông số kỹ thuật"
                      rule="LONG_TEXT"
                      max={1000}
                    />
                  </TableCell>
                  <TableCell>
                    <LineInput control={control} name={`lines.${i}.quantity`} label="Số lượng" numberRule="QUANTITY" />
                  </TableCell>
                  <TableCell>
                    <FormField
                      control={control}
                      name={`lines.${i}.unitPrice`}
                      rules={numberRules("MONEY", "Đơn giá")}
                      render={({ field }) => (
                        <>
                          <FormControl>
                            <MoneyInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} placeholder="0" />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </>
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <LineSelect
                      control={control}
                      name={`lines.${i}.priority`}
                      options={Object.entries(PRIORITY_LABELS).map(([value, label]) => ({ value, label }))}
                    />
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
    </div>
  );
}

function ProposalFields({ control, record }: { control: Control<any>; record?: any }) {
  const schoolId = useVoucherSchoolId(control, record);
  const [picking, setPicking] = useState(false);
  const { data: adequacy } = useAdequacy(schoolId);
  const overlaps = useProposalOverlaps(schoolId, record?.id, schoolId != null);
  const array = useFieldArray({ control, name: "lines" });
  const lines = useWatch({ control, name: "lines" }) as any[] | undefined;
  const chosen = new Set((lines ?? []).map((l) => Number(l?.catalogId)).filter((id) => id > 0));

  return (
    <div className="space-y-6">
      <div className="form-flow">
        <SchoolField control={control} record={record} required />
        <DateField control={control} name="proposalDate" label="Ngày đề xuất" rules={{ required: "Chọn ngày" }} />
        <TextField
          control={control}
          name="budgetYear"
          label="Năm ngân sách"
          description="Năm dự kiến mua. Sở lập kế hoạch mua sắm theo năm này."
          type="number"
          rules={{
            validate: (v: unknown) =>
              v == null || v === "" || (Number.isInteger(Number(v)) && Number(v) >= 2000 && Number(v) <= 2100)
              || "Năm ngân sách phải từ 2000 đến 2100",
          }}
        />
        <SelectField control={control} name="fundingSource" label="Nguồn kinh phí dự kiến" options={opts(PURCHASE_FUNDING)} />
        <TextareaField
          control={control}
          name="reason"
          label="Sự cần thiết"
          rules={textRules("LONG_TEXT", "Sự cần thiết", { max: 1000 })}
          inGrid
          placeholder="Thiếu so với định mức, thay thiết bị hỏng, chương trình mới…"
          description="Vì sao cần mua. Bắt buộc khi trình."
        />
        <TextareaField
          control={control}
          name="note"
          label="Ghi chú"
          rules={textRules("NOTE", "Ghi chú")}
          inGrid
          className="@2xl:col-span-1 @4xl:col-span-2"
        />
      </div>
      {/* Bảng định mức không nằm trong form: nó là hộp chọn mở từ nút "Thêm thiết bị", cùng khuôn với phiếu
          ghi tăng — form chỉ còn các dòng đã chọn. */}
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
      h.accessor("proposalDate", {
        id: "proposalDate",
        header: "Ngày",
        enableSorting: true,
        cell: ({ getValue }) => formatPlainDate(getValue()),
      }),
      h.accessor("budgetYear", { id: "budgetYear", header: "Năm NS", enableSorting: true }),
      h.display({
        id: "amount",
        header: "Dự toán",
        cell: ({ row }) => <span className="tabular-nums">{money.format(row.original.totalAmount)} đ</span>,
      }),
      h.display({
        id: "plan",
        header: "Kế hoạch",
        cell: ({ row }) =>
          row.original.plan ? (
            <Link className="text-primary hover:underline" to={`/procurement-plans/show/${row.original.plan.id}`}>
              {row.original.plan.title}
            </Link>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      }),
    ];
  }, []);
  return <VoucherList<PurchaseProposal> resource={RESOURCE} columns={columns} />;
};

/** "N thiết bị đã có trong đề xuất khác" trên thẻ bên phải của form — cùng truy vấn với bảng dòng. */
function ProposalOverlapNotice({ control, record }: { control: Control<any>; record?: any }) {
  const schoolId = useVoucherSchoolId(control, record);
  const overlaps = useProposalOverlaps(schoolId, record?.id, schoolId != null);
  const lines = useWatch({ control, name: "lines" }) as any[] | undefined;
  const count = new Set(
    (lines ?? []).map((l) => Number(l?.catalogId)).filter((id) => id && overlaps.has(id)),
  ).size;
  return <OverlapSummary count={count} />;
}

const overlapNotice = (p: { control: Control<any>; record?: any }) => <ProposalOverlapNotice {...p} />;

export const PurchaseProposalCreate = () => {
  // Mở từ màn của một trường (?school.id=): điền sẵn trường đó.
  const [params] = useSearchParams();
  const preset = Number(params.get("school.id"));
  const defaults = Number.isInteger(preset) && preset > 0 ? { ...DEFAULTS, school: { id: preset } } : DEFAULTS;
  return (
    <VoucherFormPage mode="create" required={[{ name: "reason", label: "Sự cần thiết" }]} defaults={defaults} toPayload={toPayload} notice={overlapNotice}>
      {(p) => <ProposalFields {...p} />}
    </VoucherFormPage>
  );
};

export const PurchaseProposalEdit = () => (
  <VoucherFormPage mode="edit" required={[{ name: "reason", label: "Sự cần thiết" }]} defaults={DEFAULTS} toForm={toForm} toPayload={toPayload} notice={overlapNotice}>
    {(p) => <ProposalFields {...p} />}
  </VoucherFormPage>
);

/**
 * NC-07 — "Hàng về, lập phiếu ghi tăng" CHƯA nối: máy chủ chưa có hành động `intake` trên đề xuất
 * (cần ba hàm của `EquipmentIntakeService`, thuộc vùng của DongLV). Khi có, thêm lại nút này vào
 * `extraActions` của màn chi tiết.
 */
export const PurchaseProposalShow = () => {
  const { result: record, query } = useShow<PurchaseProposal>({});
  // Người duyệt thấy thiết bị nào đang được xin ở đề xuất khác — chỉ khi phiếu còn chờ quyết định.
  const deciding = record?.status === "DRAFT" || record?.status === "PENDING";
  const overlaps = useProposalOverlaps(record?.school?.id, record?.id, !!record && deciding);
  // Hai dạng xem như phiếu nhập: "Làm việc" (bảng, nút duyệt) và "Văn bản" (tờ trình A4 để in, ký).
  const [view, setView] = useVoucherView("purchase_proposal");
  const viewSwitch = record ? <VoucherViewSwitch view={view} onChange={setView} /> : null;
  const exportDocument = () => {
    setView("document");
    setTimeout(() => window.print(), 300);
  };
  const actionText = {
    approve: { description: "Lãnh đạo trường xác nhận nhu cầu. Sở đồng ý đưa vào kế hoạch mua sắm." },
    reject: { description: "Đề xuất dừng hẳn. Còn nhu cầu thì trường lập đề xuất mới." },
  };

  if (record && view === "document") {
    return (
      <ShowView>
        <ShowViewHeader
          actions={
            <>
              {viewSwitch}
              <ExportProposalButton />
              <VoucherActions resource={RESOURCE} record={record} text={actionText} />
            </>
          }
        />
        <ProposalDocument record={record} />
      </ShowView>
    );
  }

  return (
    <VoucherShowShell
      resource={RESOURCE}
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
          value: record?.plan ? (
            <Link className="text-primary hover:underline" to={`/procurement-plans/show/${record.plan.id}`}>
              {record.plan.title}
            </Link>
          ) : record?.status === "APPROVED" ? (
            "Chờ Sở đưa vào kế hoạch"
          ) : (
            "—"
          ),
        },
        ...(record?.intakeId
          ? [{
              label: "Phiếu ghi tăng",
              value: (
                <Link className="text-primary hover:underline" to={`/equipment-intakes/show/${record.intakeId}`}>
                  Xem phiếu ghi tăng
                </Link>
              ),
            }]
          : []),
        { label: "Sự cần thiết", value: record?.reason ?? "—" },
      ]}
      actions={{ text: actionText }}
      extraActions={viewSwitch}
      menuItems={<ExportProposalMenuItem onExport={() => setTimeout(exportDocument, 200)} />}
    >
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">#</TableHead>
              <TableHead>Thiết bị</TableHead>
              <TableHead>Loại</TableHead>
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
                  <div className="text-muted-foreground text-xs">
                    {l.catalog.name}
                    {l.specification ? ` · ${l.specification}` : ""}
                  </div>
                  {deciding ? <OverlapNote className="mt-1" list={overlaps.get(l.catalog.id)} /> : null}
                  {l.note ? <div className="text-muted-foreground text-xs">{l.note}</div> : null}
                </TableCell>
                <TableCell>{PURCHASE_LINE_KIND_LABELS[l.kind]}</TableCell>
                <TableCell className="text-right tabular-nums">{l.quantity} {l.unitName ?? ""}</TableCell>
                <TableCell className="text-right tabular-nums">{l.unitPrice != null ? money.format(l.unitPrice) : "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{l.amount != null ? money.format(l.amount) : "—"}</TableCell>
                <TableCell>
                  <Badge variant={l.priority === 1 ? "destructive" : l.priority === 2 ? "warning" : "neutral"}>
                    {PRIORITY_LABELS[l.priority]}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {l.currentQuantity ?? "—"} / {l.requiredQuantity ?? "—"}
                </TableCell>
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

      {/* NC-03: người duyệt xem báo giá, biên bản khảo sát… kèm theo đề xuất. */}
      <AttachmentsPanel
        resource={RESOURCE}
        recordId={record?.id}
        canWrite={record?._can?.write === true}
        compact
        description="Báo giá, biên bản khảo sát nhu cầu và giấy tờ khác làm căn cứ cho đề xuất."
      />
    </VoucherShowShell>
  );
};
