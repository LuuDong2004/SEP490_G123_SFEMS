import { DateField, SelectField, TextareaField, TextField } from "@/shared/components/form/simple-fields";
import { VoucherFormPage, type VoucherFieldsProps } from "@/shared/components/voucher/voucher-form-page";
import { StepTitle, type ChecklistItem } from "@/shared/components/voucher/voucher-layout";
import { todayLocal } from "@/shared/lib/format";
import { IntField, NO_REF, RefField, type RefValue } from "@/features/organization/equipment-intakes/fields";
import { FROM_HEAD, LinesEditor, OPEN_LINE_EVENT, type CatalogValue, type LineForm } from "@/features/organization/equipment-intakes/lines-editor";
import {
  FUNDING_SOURCE_OPTIONS,
  INSPECTION_RESULT_OPTIONS,
  lineIssues,
  type EquipmentIntake,
  type Ref,
} from "@/domains/equipment-intake/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

const DEFAULTS = {
  intakeDate: todayLocal(),
  deliverer: "",
  documentNo: "",
  documentDate: "",
  supplier: "",
  fundingSource: "",
  originSource: NO_REF,
  originNote: "",
  acquisitionMethod: NO_REF,
  schoolYear: NO_REF,
  warrantyMonths: "" as number | "",
  note: "",
  delivererRepresentative: "",
  receiver: "",
  receiverPosition: "",
  storekeeper: "",
  inspectionResult: "",
  handoverNo: "",
  lines: [] as LineForm[],
};

const refOf = (r: Ref | null | undefined): RefValue => (r ? { id: r.id, name: r.name, code: r.code } : NO_REF);
const idRef = (r: RefValue | null | undefined) => (r?.id ? { id: r.id } : null);
const textOrNull = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const numOrNull = (v: unknown) => (v === "" || v == null ? null : Number(v));

function toForm(r: EquipmentIntake) {
  return {
    intakeDate: r.intakeDate ?? "",
    deliverer: r.deliverer ?? "",
    documentNo: r.documentNo ?? "",
    documentDate: r.documentDate ?? "",
    supplier: r.supplier ?? "",
    fundingSource: r.fundingSource ?? "",
    originSource: refOf(r.originSource),
    originNote: r.originNote ?? "",
    acquisitionMethod: refOf(r.acquisitionMethod),
    schoolYear: refOf(r.schoolYear),
    warrantyMonths: r.warrantyMonths ?? "",
    note: r.note ?? "",
    delivererRepresentative: r.delivererRepresentative ?? "",
    receiver: r.receiver ?? "",
    receiverPosition: r.receiverPosition ?? "",
    storekeeper: r.storekeeper ?? "",
    inspectionResult: r.inspectionResult ?? "",
    handoverNo: r.handoverNo ?? "",
    lines: (r.lines ?? []).map((l): LineForm => ({
      catalog: {
        id: l.catalog.id, name: l.catalog.name, code: l.catalog.code,
        trackingType: l.trackingType, unit: l.unit ? { id: l.unit.id, name: l.unit.name } : null,
        physicalOrDigital: l.physicalOrDigital,
      } as CatalogValue,
      name: l.name ?? "",
      physicalOrDigital: l.physicalOrDigital ?? "",
      documentQuantity: l.documentQuantity,
      receivedQuantity: l.receivedQuantity,
      varianceReason: l.varianceReason ?? "",
      unitPrice: l.unitPrice,
      room: refOf(l.room),
      movementReason: refOf(l.movementReason),
      supplier: l.supplier ?? "",
      documentNo: l.documentNo ?? "",
      documentDate: l.documentDate ?? "",
      fundingSource: l.fundingSource ?? FROM_HEAD,
      warrantyMonths: l.warrantyMonths ?? "",
      model: l.model ?? "",
      manufacturer: l.manufacturer ?? "",
      note: l.note ?? "",
    })),
  };
}

function toPayload(v: typeof DEFAULTS) {
  return {
    intakeDate: v.intakeDate || null,
    deliverer: textOrNull(v.deliverer),
    documentNo: textOrNull(v.documentNo),
    documentDate: v.documentDate || null,
    supplier: textOrNull(v.supplier),
    fundingSource: v.fundingSource || null,
    originSource: idRef(v.originSource),
    originNote: textOrNull(v.originNote),
    acquisitionMethod: idRef(v.acquisitionMethod),
    schoolYear: idRef(v.schoolYear),
    warrantyMonths: numOrNull(v.warrantyMonths),
    note: textOrNull(v.note),
    delivererRepresentative: textOrNull(v.delivererRepresentative),
    receiver: textOrNull(v.receiver),
    receiverPosition: textOrNull(v.receiverPosition),
    storekeeper: textOrNull(v.storekeeper),
    inspectionResult: v.inspectionResult || null,
    handoverNo: textOrNull(v.handoverNo),
    lines: (v.lines ?? []).map((l) => ({
      catalog: idRef(l.catalog),
      name: textOrNull(l.name),
      physicalOrDigital: l.physicalOrDigital || null,
      documentQuantity: numOrNull(l.documentQuantity),
      receivedQuantity: numOrNull(l.receivedQuantity),
      // Lý do lệch chỉ có nghĩa khi hai số khác nhau — ô bị ẩn thì không gửi chữ cũ còn sót.
      varianceReason: Number(l.documentQuantity) !== Number(l.receivedQuantity) ? textOrNull(l.varianceReason) : null,
      unitPrice: l.unitPrice ?? null,
      room: idRef(l.room),
      movementReason: idRef(l.movementReason),
      supplier: textOrNull(l.supplier),
      documentNo: textOrNull(l.documentNo),
      documentDate: l.documentDate || null,
      fundingSource: l.fundingSource && l.fundingSource !== FROM_HEAD ? l.fundingSource : null,
      warrantyMonths: numOrNull(l.warrantyMonths),
      model: textOrNull(l.model),
      manufacturer: textOrNull(l.manufacturer),
      note: textOrNull(l.note),
    })),
  };
}

function HeadFields({ control, setValue, watch }: VoucherFieldsProps) {
  return (
    <>
      <div className="grid items-start gap-x-4 gap-y-5 @2xl:grid-cols-2 @4xl:grid-cols-3">
        <DateField control={control} name="intakeDate" label="Ngày nhập" />
        <TextField control={control} name="deliverer" label="Người giao" />
        <RefField control={control} name="schoolYear" label="Năm học" resource="school_years" />
        <RefField control={control} name="originSource" label="Nguồn hình thành" resource="origin_sources" />
        <RefField control={control} name="acquisitionMethod" label="Hình thức mua sắm" resource="acquisition_methods" />
        <SelectField control={control} name="fundingSource" label="Nguồn kinh phí" options={FUNDING_SOURCE_OPTIONS}
          description="Áp cho các dòng không khai riêng" />
        <TextField control={control} name="supplier" label="Nhà cung cấp" />
        <TextField control={control} name="documentNo" label="Số hoá đơn, hợp đồng" />
        <DateField control={control} name="documentDate" label="Ngày hoá đơn" />
        <IntField control={control} name="warrantyMonths" label="Bảo hành (tháng)" min={0} max={600} />
      </div>
      <TextareaField control={control} name="note" label="Ghi chú" rows={2} />

      <div className="grid gap-4 border-t pt-4">
        <StepTitle title="Biên bản giao nhận" hint="Không bắt buộc, trừ người giao ở trên" />
        <div className="grid items-start gap-x-4 gap-y-5 @2xl:grid-cols-2 @4xl:grid-cols-3">
          <TextField control={control} name="handoverNo" label="Số biên bản" />
          <TextField control={control} name="delivererRepresentative" label="Đại diện bên giao" />
          <SelectField control={control} name="inspectionResult" label="Kết quả kiểm tra" options={INSPECTION_RESULT_OPTIONS} />
          <TextField control={control} name="receiver" label="Người nhận" />
          <TextField control={control} name="receiverPosition" label="Chức vụ người nhận" />
          <TextField control={control} name="storekeeper" label="Thủ kho" />
        </div>
      </div>

      <LinesEditor control={control} setValue={setValue} getValues={(n?: any) => (n ? watch(n) : watch())} />
    </>
  );
}

const REQUIRED = [
  { name: "intakeDate", label: "Ngày nhập" },
  { name: "deliverer", label: "Người giao" },
];

/** Mỗi dòng còn thiếu gì — mục bấm được, mở đúng dòng. Cùng luật với máy chủ lúc trình. */
function lineChecks(values: Record<string, any>): ChecklistItem[] {
  const lines = (values.lines ?? []) as LineForm[];
  return lines.flatMap((l, i) => {
    const issues = lineIssues(l, l.catalog ?? undefined, values.fundingSource);
    if (!issues.length) return [];
    return [{
      key: `line:${i}`,
      label: `Dòng ${i + 1}: ${issues[0]}`,
      hint: issues.length > 1 ? `và ${issues.length - 1} mục khác` : (l.name || l.catalog?.name || undefined),
      ok: false,
      onClick: () => window.dispatchEvent(new CustomEvent(OPEN_LINE_EVENT, { detail: i })),
    }];
  });
}

/** Lập / sửa phiếu nhập thiết bị (PN-01, PN-02). */
export function EquipmentIntakeForm({ mode }: { mode: "create" | "edit" }) {
  return (
    <VoucherFormPage
      mode={mode}
      defaults={DEFAULTS}
      toForm={toForm}
      toPayload={toPayload}
      required={REQUIRED}
      checks={lineChecks}
    >
      {(props) => <HeadFields {...props} />}
    </VoucherFormPage>
  );
}
