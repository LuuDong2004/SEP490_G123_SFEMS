import { useInvalidate } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { useEffect } from "react";
import { useFieldArray, type Control } from "react-hook-form";

import { RefField } from "@/shared/components/catalog/ref-field";
import { DateInput } from "@/shared/components/form/date-input";
import { TextareaField, TextField } from "@/shared/components/form/simple-fields";
import { dateRules, inputModeOf, maxLengthOf, mergeRules, textRules, type TextRule } from "@/shared/lib/field-rules";
import { Button } from "@/shared/ui/button";
import { DialogFooter } from "@/shared/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/shared/ui/form";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { DOCUMENT_ROLE_LABELS } from "@/domains/equipment-standard/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Hộp Hồ sơ bộ ở chế độ SỬA.
 * - Bộ NHÁP: sửa hết — cùng khuôn với lúc xem (lưới thông tin, bảng văn bản căn cứ), giá trị thành ô nhập.
 * - Bộ ĐANG ÁP DỤNG: nội dung lấy từ văn bản của Bộ nên khoá hết; chỉ còn thứ Sở quyết — năm học áp dụng và
 *   ghi chú ("Đặt năm học áp dụng"). Chỉ gửi ba ô đó. Máy chủ kiểm lại cùng luật (`EquipmentStandardService.update`).
 */
export function StandardProfileForm({ standard, onCancel, onSaved }: {
  standard: any;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const invalidate = useInvalidate();
  const locked = standard.status !== "DRAFT";
  const {
    refineCore: { onFinish, query },
    ...form
  } = useForm({
    warnWhenUnsavedChanges: false,
    // Kiểm khi gõ; lỗi chỉ HIỆN sau khi rời ô (FormItem tự làm).
    mode: "onChange",
    refineCoreProps: {
      resource: "equipment_standards",
      action: "edit",
      id: standard.id,
      redirect: false,
      onMutationSuccess: async () => {
        await invalidate({ resource: "equipment_standards", invalidates: ["list", "detail"] });
        onSaved();
      },
    },
    defaultValues: standard,
  });
  const record = query?.data?.data;
  const { reset } = form;
  useEffect(() => {
    if (record) reset(record as any, { keepDirtyValues: true });
  }, [record, reset]);

  const control = form.control;
  const submit = form.handleSubmit((values: any) => {
    if (locked) {
      // Năm kết thúc của bộ đang áp dụng tự đặt khi áp dụng bộ mới thay nó — không gửi.
      return onFinish({ startSchoolYear: values.startSchoolYear ?? null, note: values.note ?? "" } as any);
    }
    // Đúng MỘT văn bản căn cứ chính — luật của cả danh sách, không thuộc riêng ô nào.
    const mains = (values.documents ?? []).filter((d: any) => d.documentRole === "main").length;
    if (mains !== 1) {
      form.setError("root", { message: mains === 0 ? "Bộ phải có một văn bản căn cứ chính." : "Bộ chỉ có MỘT văn bản căn cứ chính." });
      return;
    }
    return onFinish(values);
  });

  // Một hàng "Năm học áp dụng: [từ] → [đến]". Ô hiện mã năm ("2021-2022") — nhãn đã nói là năm học. Bộ đang áp
  // dụng: "đến" là "Đến nay" (chỉ xem), tự đặt khi áp dụng bộ mới thay nó.
  const end = record?.endSchoolYear ?? standard.endSchoolYear;
  const years = (
    <>
      <div className="grid min-w-0 gap-2 sm:col-span-2">
        <span className="text-sm leading-none font-medium">Năm học áp dụng</span>
        <div className="flex flex-wrap items-start gap-2">
          <RefField control={control} name="startSchoolYear" resource="school_years" label="Năm học bắt đầu" hideLabel
            labelField="code" placeholder="Từ năm học" className="w-[11rem]"
            current={record?.startSchoolYear ?? standard.startSchoolYear} />
          <span className="text-muted-foreground flex h-9 items-center" aria-hidden>→</span>
          {locked ? (
            <div className="bg-surface-subtle text-muted-foreground flex h-9 w-[11rem] items-center rounded-full border px-3.5 text-sm"
              title="Tự đặt khi áp dụng bộ mới thay bộ này">
              {end?.code ?? "Đến nay"}
            </div>
          ) : (
            <RefField control={control} name="endSchoolYear" resource="school_years" label="Năm học kết thúc" hideLabel
              labelField="code" placeholder="Đến nay" className="w-[11rem]" current={end} />
          )}
        </div>
      </div>
      <TextareaField control={control} name="note" label="Ghi chú" rule="NOTE" className="sm:col-span-2" />
    </>
  );
  const footer = (
    <DialogFooter>
      <Button type="button" variant="outline" onClick={onCancel}>Huỷ</Button>
      <Button type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Đang lưu…" : "Lưu thay đổi"}
      </Button>
    </DialogFooter>
  );

  if (locked) {
    return (
      <Form {...form}>
        <form onSubmit={submit} className="space-y-5">
          <div className="grid items-start gap-x-4 gap-y-5 sm:grid-cols-2">{years}</div>
          {footer}
        </form>
      </Form>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={submit} className="space-y-5">
        <div className="grid items-start gap-x-4 gap-y-5 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-4">
          <TextField control={control} name="code" label="Mã bộ" rule="CODE" rules={{ required: "Nhập mã bộ" }} />
          <RefField control={control} name="educationLevel" resource="education_levels" label="Cấp học"
            current={record?.educationLevel ?? standard.educationLevel} required />
          <TextField control={control} name="standardVersion" label="Phiên bản" placeholder="2021, sửa đổi 2023"
            rule="SHORT_TEXT" max={50} rules={{ required: "Nhập phiên bản" }} />
          <RefField control={control} name="previousStandard" resource="equipment_standards" label="Thay thế bộ"
            current={record?.previousStandard ?? standard.previousStandard} />
          <TextField control={control} name="name" label="Tên bộ" rule="NAME" rules={{ required: "Nhập tên bộ" }}
            className="sm:col-span-2" />
          {years}
        </div>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Văn bản căn cứ</h3>
          <DocumentsTable control={control} getValues={form.getValues} revisionDocumentId={standard.revisionDocumentId ?? null} />
          {form.formState.errors.root?.message ? (
            <p className="text-destructive text-sm">{form.formState.errors.root.message}</p>
          ) : null}
        </section>

        {footer}
      </form>
    </Form>
  );
}

function Required() {
  return <span className="text-destructive ms-0.5">*</span>;
}

/**
 * Bảng văn bản căn cứ của bộ nháp — mỗi văn bản một dòng nhập, cùng cột với bảng lúc xem.
 */
function DocumentsTable({ control, getValues, revisionDocumentId }: {
  control: Control<any>;
  getValues: (name?: any) => any;
  revisionDocumentId: number | null;
}) {
  const { fields, append, remove } = useFieldArray({ control, name: "documents", keyName: "_key" });
  const at = (i: number, key: string) => `documents.${i}.${key}`;

  return (
    <div className="space-y-2">
      <div className="bg-card overflow-x-auto rounded-lg border">
        <Table className="min-w-[66rem] table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[10.5rem]">Số hiệu<Required /></TableHead>
              <TableHead className="w-[11rem]">Vai trò<Required /></TableHead>
              <TableHead>Trích yếu<Required /></TableHead>
              <TableHead className="w-[8.5rem]" title="Cơ quan ban hành">Cơ quan</TableHead>
              <TableHead className="w-[10rem]">Ban hành<Required /></TableHead>
              <TableHead className="w-[10rem]">Hiệu lực</TableHead>
              <TableHead className="w-[8rem]">Đường dẫn</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.map((f: any, i) => (
              <TableRow key={f._key} className="align-top">
                <TableCell className="px-1.5 py-2">
                  <CellText control={control} name={at(i, "documentNo")} label="Số hiệu" rule="SHORT_TEXT" max={100} required
                    placeholder="37/2021/TT-BGDĐT"
                    validate={(v: string) => {
                      const key = (v ?? "").trim().toLowerCase();
                      const same = (getValues("documents") ?? []).filter((d: any) => (d.documentNo ?? "").trim().toLowerCase() === key);
                      return !key || same.length <= 1 || "Số hiệu trùng với văn bản khác trong bộ";
                    }} />
                </TableCell>
                <TableCell className="px-1.5 py-2">
                    <FormField control={control} name={at(i, "documentRole")} rules={{ required: "Chọn vai trò" }}
                      render={({ field }) => (
                        <FormItem>
                          <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger className="w-full" aria-label="Vai trò"><SelectValue placeholder="Vui lòng chọn vai trò" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {Object.entries(DOCUMENT_ROLE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                </TableCell>
                <TableCell className="px-1.5 py-2">
                  <CellText control={control} name={at(i, "documentName")} label="Trích yếu" rule="NOTE" required multiline />
                </TableCell>
                <TableCell className="px-1.5 py-2">
                  <CellText control={control} name={at(i, "issuingAuthority")} label="Cơ quan ban hành" rule="NAME" placeholder="Bộ GD&ĐT" />
                </TableCell>
                <TableCell className="px-1.5 py-2">
                  <CellDate control={control} name={at(i, "issueDate")}
                    rules={mergeRules(dateRules("PAST_OR_TODAY", "Ngày ban hành", { required: true }), { deps: [at(i, "effectiveDate")] })} />
                </TableCell>
                <TableCell className="px-1.5 py-2">
                  <CellDate control={control} name={at(i, "effectiveDate")}
                    rules={mergeRules(dateRules("ANY", "Ngày hiệu lực"), {
                      validate: (v: string | null) => {
                        const doc = getValues(`documents.${i}`) ?? {};
                        // Văn bản hợp nhất / tham khảo không có ngày hiệu lực riêng.
                        if (!v) return doc.documentRole === "reference" || "Nhập ngày hiệu lực";
                        return !doc.issueDate || v >= doc.issueDate || "Không được trước ngày ban hành";
                      },
                    })} />
                </TableCell>
                <TableCell className="px-1.5 py-2">
                  <CellText control={control} name={at(i, "url")} label="Đường dẫn" rule="URL" max={1000} placeholder="https://" />
                </TableCell>
                <TableCell className="px-1 py-2">
                  {/* Văn bản của lần sửa là căn cứ của cả bản nháp — không xoá (máy chủ cũng chặn). */}
                  {f.id != null && f.id === revisionDocumentId ? null : (
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Xoá văn bản" title="Xoá văn bản"
                      className="text-muted-foreground hover:text-destructive" onClick={() => remove(i)}>
                      <Trash2 />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Button type="button" variant="outline" size="sm"
        onClick={() => append({
          id: null,
          documentRole: fields.length === 0 ? "main" : "amendment",
          documentNo: "",
          documentName: "",
          issuingAuthority: "Bộ Giáo dục và Đào tạo",
          issueDate: null,
          effectiveDate: null,
          url: "",
        })}>
        <Plus />
        Thêm văn bản
      </Button>
    </div>
  );
}


/** Ô chữ trong bảng: không nhãn (đầu cột là nhãn), lỗi hiện dưới ô khi rời ô. */
function CellText({ control, name, label, rule, max, required, placeholder, validate, multiline }: {
  control: Control<any>;
  name: string;
  label: string;
  rule: TextRule;
  max?: number;
  required?: boolean;
  placeholder?: string;
  validate?: (v: any) => true | string;
  /** Chữ dài (trích yếu): ô tự giãn xuống dòng để đọc hết, không cắt. */
  multiline?: boolean;
}) {
  return (
    <FormField control={control} name={name}
      rules={mergeRules(textRules(rule, label, { max, required }), validate ? { validate } : undefined)}
      render={({ field }) => (
        <FormItem>
          <FormControl>
            {multiline ? (
              <Textarea rows={1} className="min-h-9" value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur}
                name={field.name} ref={field.ref} aria-label={label} maxLength={maxLengthOf(rule, max)} />
            ) : (
              <Input value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value)} onBlur={field.onBlur}
                name={field.name} ref={field.ref} aria-label={label} placeholder={placeholder}
                maxLength={maxLengthOf(rule, max)} inputMode={inputModeOf(rule)} title={field.value ?? undefined} />
            )}
          </FormControl>
          <FormMessage />
        </FormItem>
      )} />
  );
}

function CellDate({ control, name, rules }: { control: Control<any>; name: string; rules: any }) {
  return (
    <FormField control={control} name={name} rules={rules}
      render={({ field }) => (
        <FormItem className="min-w-0">
          <FormControl>
            <DateInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name} placeholder="dd/mm/yyyy" />
          </FormControl>
          <FormMessage />
        </FormItem>
      )} />
  );
}

