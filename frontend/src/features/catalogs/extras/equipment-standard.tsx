import type { Control } from "react-hook-form";
import { useCan, useCustomMutation, useInvalidate, useNotification } from "@refinedev/core";
import type { HttpError } from "@refinedev/core";
import type { UseTableReturnType } from "@refinedev/react-table";
import { Link } from "react-router";
import { useState } from "react";

import { OptionFilter } from "@/shared/components/data-table/ref-filter";
import { ReadField } from "@/shared/components/form/read-field";
import { TextField } from "@/shared/components/form/simple-fields";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { API_URL } from "@/shared/api/constants";
import type { CatalogConfig, CatalogFormValues, CatalogRecord } from "@/features/catalogs/catalog-config";
import { RefSelectField } from "@/features/catalogs/ref-select-field";
import { AlertDialog } from "@/shared/ui/alert-dialog";
import { ConfirmContent } from "@/shared/components/confirm/confirm-content";
import { Input } from "@/shared/ui/input";
import { StandardDocuments, type StandardDocument } from "@/features/catalogs/extras/standard-documents";

const STATUS = { DRAFT: "Bản nháp", ACTIVE: "Đang áp dụng", RETIRED: "Hết hiệu lực" } as const;

type Standard = CatalogRecord & {
  status: keyof typeof STATUS;
  educationLevel: { name: string } | null;
  startSchoolYear: { name: string } | null;
  endSchoolYear: { name: string } | null;
  standardVersion: string | null;
  previousStandard: { name: string; code: string } | null;
  documents: StandardDocument[];
};

function Fields({ control }: { control: Control<CatalogFormValues> }) {
  return <>
    <RefSelectField control={control} name="educationLevel" label="Cấp học" resource="education_levels" placeholder="Chọn THPT" required="Chọn cấp học" />
    <RefSelectField control={control} name="startSchoolYear" label="Năm học bắt đầu" resource="school_years" placeholder="Chọn năm học" />
    <RefSelectField control={control} name="endSchoolYear" label="Năm học kết thúc" resource="school_years" placeholder="Chưa xác định" />
    <TextField control={control} name="standardVersion" label="Văn bản căn cứ / phiên bản" placeholder="39/2021/TT-BGDĐT" />
  </>;
}

function Read({ record }: { record: CatalogRecord }) {
  const item = record as Standard;
  const [pending, setPending] = useState<"apply" | "revise" | null>(null);
  const [newVersion, setNewVersion] = useState("");
  const { mutate, mutation } = useCustomMutation();
  const mayEdit = useCan({ resource: "equipment_standards", action: "edit" }).data?.can ?? false;
  const invalidate = useInvalidate();
  const { open } = useNotification();
  const changeStatus = (action: "apply" | "revise") => mutate({
    url: `${API_URL}/equipment_standards/${item.id}/${action}`,
    method: "post",
    values: action === "revise" ? { standardVersion: newVersion.trim() || null } : {},
    config: { headers: { "Content-Type": "application/json" } },
    successNotification: false,
  }, { onSuccess: () => {
    setPending(null);
    void invalidate({ resource: "equipment_standards", invalidates: ["list", "detail"] });
    open?.({ type: "success", message: action === "apply" ? "Đã áp dụng bộ tiêu chuẩn" : "Đã lập bộ nháp mới" });
  } });
  return <>
    <ReadField label="Trạng thái"><Badge variant={item.status === "ACTIVE" ? "success" : "secondary"}>{STATUS[item.status]}</Badge></ReadField>
    <ReadField label="Cấp học">{item.educationLevel?.name}</ReadField>
    <ReadField label="Năm học bắt đầu">{item.startSchoolYear?.name}</ReadField>
    <ReadField label="Năm học kết thúc">{item.endSchoolYear?.name}</ReadField>
    <ReadField label="Văn bản căn cứ / phiên bản">{item.standardVersion}</ReadField>
    {item.previousStandard ? <ReadField label="Tạo từ bộ">{item.previousStandard.name} ({item.previousStandard.code})</ReadField> : null}
    <StandardDocuments standardId={item.id} status={item.status} documents={item.documents ?? []} />
    <div className="sm:col-span-2"><Button type="button" variant="outline" asChild><Link to="/catalogs/equipment-norms">Xem các dòng định mức</Link></Button></div>
    {mayEdit && item.status === "DRAFT" ? <div className="sm:col-span-2"><Button type="button" disabled={mutation.isPending} onClick={() => setPending("apply")}>Áp dụng bộ nháp</Button></div> : null}
    {mayEdit && item.status === "ACTIVE" ? <div className="sm:col-span-2"><Button type="button" disabled={mutation.isPending} onClick={() => { setNewVersion(""); setPending("revise"); }}>Lập bản nháp mới</Button></div> : null}
    <AlertDialog open={pending !== null} onOpenChange={(open) => { if (!open && !mutation.isPending) setPending(null); }}>
      <ConfirmContent
        tone={pending === "apply" ? "warning" : "neutral"}
        title={pending === "apply" ? "Áp dụng bộ tiêu chuẩn này?" : "Lập bản nháp từ bộ đang áp dụng?"}
        description={pending === "apply"
          ? "Bộ đang áp dụng sẽ chuyển thành hết hiệu lực. Các thiết bị tối thiểu sẽ được cập nhật theo bộ này."
          : "Hệ thống sẽ sao chép các dòng định mức vào bộ nháp để chỉnh sửa trước khi áp dụng."}
        confirmDisabled={pending === "revise" && newVersion.trim().length > 50}
        cancelLabel="Tiếp tục xem"
        confirmLabel={pending === "apply" ? "Áp dụng" : "Lập bản nháp"}
        busy={mutation.isPending}
        keepOpen
        onConfirm={() => { if (pending) changeStatus(pending); }}
      >
        {pending === "revise" ? <label className="grid gap-1 text-sm">Văn bản / phiên bản mới
          <Input maxLength={50} value={newVersion} onChange={(event) => setNewVersion(event.target.value)}
            placeholder="Ví dụ: sửa đổi năm 2026" />
        </label> : null}
      </ConfirmContent>
    </AlertDialog>
  </>;
}

function Filters({ table }: { table: UseTableReturnType<CatalogRecord, HttpError> }) {
  return <OptionFilter table={table} field="status" all="Mọi trạng thái" options={Object.entries(STATUS).map(([value, label]) => ({ value, label }))} />;
}

export const equipmentStandardConfig: CatalogConfig = {
  resource: "equipment_standards",
  noun: "bộ danh mục tối thiểu",
  description: "Mỗi bộ áp dụng cho cấp THPT; sửa các dòng trên bản nháp rồi áp dụng.",
  codePlaceholder: "TT39-2021-THPT",
  namePlaceholder: "Danh mục thiết bị dạy học tối thiểu cấp THPT",
  extraKeys: ["educationLevel", "startSchoolYear", "endSchoolYear", "standardVersion"],
  extraDefaults: { educationLevel: null, startSchoolYear: null, endSchoolYear: null, standardVersion: "" },
  extraColumns: [
    { id: "standardVersion", header: "Văn bản / phiên bản", size: 190, enableSorting: false, cell: ({ row }) => (row.original as Standard).standardVersion ?? "—" },
    { id: "status", header: "Hiệu lực", size: 130, enableSorting: false, cell: ({ row }) => STATUS[(row.original as Standard).status] },
  ],
  ExtraFields: Fields,
  ExtraRead: Read,
  ExtraFilters: Filters,
  canModify: (record) => (record as Standard).status === "DRAFT",
  hideActive: true,
  listLink: { to: "/catalogs/equipment-norms", label: "Xem dòng định mức" },
};
