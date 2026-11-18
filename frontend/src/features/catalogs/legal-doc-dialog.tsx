import { useCan, useInvalidate, useNotification } from "@refinedev/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarX2, Pencil, RotateCcw, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useForm, type Control } from "react-hook-form";

import { LEGAL_DOC_NUMBER } from "@/domains/legal-document/types";
import type { AttachmentInfo } from "@/domains/voucher/types";
import { kyInstance } from "@/shared/api/data";
import { RefField } from "@/shared/components/catalog/ref-field";
import { ConfirmContent } from "@/shared/components/confirm/confirm-content";
import { DateInput } from "@/shared/components/form/date-input";
import { TextareaField, TextField } from "@/shared/components/form/simple-fields";
import { AttachmentsPanel } from "@/shared/components/voucher/attachments-panel";
import { FileDrop, FileTypeIcon } from "@/shared/components/voucher/file-drop";
import { FilePreviewDialog, type PreviewSource } from "@/shared/components/voucher/file-preview";
import { errorMessage } from "@/shared/lib/api-error";
import { formatPlainDate } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { AlertDialog } from "@/shared/ui/alert-dialog";
import { Badge } from "@/shared/ui/badge";
import { dateRules, mergeRules } from "@/shared/lib/field-rules";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { Skeleton } from "@/shared/ui/skeleton";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Hộp thoại Văn bản căn cứ (thông tư của Bộ về thiết bị và cơ sở vật chất) — Thêm, Xem và Sửa dùng CHUNG một bố cục
 * (trưởng nhóm 17/11/2026); Xem là chính form đó ở chế độ chỉ đọc, bấm Sửa thì mở khoá tại chỗ. Tệp thông tư (PDF hoặc Word) bắt buộc:
 * thêm mới thì chọn tệp trước, tải lên ngay sau khi lưu.
 */

export type LegalDocDialogState = { mode: "create" | "edit" | "view"; id?: number } | null;

const RESOURCE = "legal_documents";
const MAX_PDF = 20 * 1024 * 1024;
const PDF_TITLE = "Bản thông tư";
const PDF_LIMIT = "PDF hoặc Word, tối đa 20 MB";
/** Cùng tập đuôi với `LegalDocumentAttachmentAccess`. */
const DOC_FILE = /\.(pdf|docx?)$/i;

const EMPTY = { code: "", name: "", issuedOn: null, effectiveFrom: null, effectiveTo: null, replaces: { id: null }, note: "" };

const fileSize = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

function DateBox({ control, name, label, required, rule = "ANY", validate, disabled }: {
  control: Control<any>;
  name: string;
  label: string;
  required?: boolean;
  rule?: "ANY" | "PAST_OR_TODAY";
  validate?: (value: any, values: any) => true | string;
  disabled?: boolean;
}) {
  return (
    <FormField
      control={control}
      name={name}
      rules={mergeRules(dateRules(rule, label, { required }), validate ? { validate } : undefined)}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <DateInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name} disabled={disabled} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/** Ô PDF lúc THÊM: giữ tệp trong bộ nhớ, tải lên sau khi văn bản được lưu. */
function PendingPdf({ file, onChange, missing }: { file: File | null; onChange: (f: File | null) => void; missing: boolean }) {
  const { open } = useNotification();
  const [preview, setPreview] = useState<PreviewSource | null>(null);
  const add = (list: File[]) => {
    const f = list[0];
    if (!f) return;
    if (!DOC_FILE.test(f.name)) {
      open?.({ type: "error", message: `${f.name} không phải tệp PDF hoặc Word` });
      return;
    }
    if (f.size > MAX_PDF) {
      open?.({ type: "error", message: `${f.name} vượt quá 20 MB` });
      return;
    }
    onChange(f);
  };
  return (
    <div>
      <FileDrop label={PDF_TITLE} required compact limit={PDF_LIMIT} hint="Tải lên khi lưu" onAdd={add}
        items={file ? [{
          key: `${file.name}-${file.size}`,
          name: file.name,
          meta: `${fileSize(file.size)} · tải lên khi lưu`,
          icon: <FileTypeIcon name={file.name} type={file.type} />,
          onOpen: () => setPreview({ name: file.name, type: file.type, blob: file }),
          actions: (
            <Button type="button" variant="ghost" size="icon" className="size-8" title="Bỏ tệp này" onClick={() => onChange(null)}>
              <X />
            </Button>
          ),
        }] : []} />
      {missing && !file ? <p className="text-destructive mt-1.5 text-sm">Chọn tệp thông tư (PDF hoặc Word)</p> : null}
      <FilePreviewDialog source={preview} onClose={() => setPreview(null)} />
    </div>
  );
}

/**
 * Đổi hiệu lực của văn bản (trưởng nhóm 17/11/2026, cách A): "Hết hiệu lực" hỏi ngày rồi ghi; ghi nhầm thì "Còn hiệu lực
 * lại". Văn bản bị thay thế thì máy chủ tự ghi ngày — nút này cho văn bản bị bãi bỏ không có văn bản thay.
 */
function EffectAction({ record }: { record: any }) {
  const [asking, setAsking] = useState(false);
  const [date, setDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { open: notify } = useNotification();
  const invalidate = useInvalidate();
  const queryClient = useQueryClient();
  const ended = !!record.effectiveTo;
  const run = async () => {
    if (!ended && !date) {
      setError("Chọn ngày hết hiệu lực");
      return;
    }
    setBusy(true);
    try {
      await kyInstance.post(`${RESOURCE}/${record.id}/${ended ? "reinstate" : "end"}`, ended ? {} : { json: { endDate: date } });
      await invalidate({ resource: RESOURCE, invalidates: ["list", "many", "detail"] });
      await queryClient.invalidateQueries({ queryKey: [RESOURCE] });
      notify?.({ type: "success", message: ended ? "Văn bản còn hiệu lực lại" : "Đã ghi hết hiệu lực" });
      setAsking(false);
    } catch (e: any) {
      const message = e?.errors?.endDate ?? (await errorMessage(e));
      setError(message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button type="button" variant="outline" className="me-auto" onClick={() => {
        const d = new Date();
        setDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
        setError(null);
        setAsking(true);
      }}>
        {ended ? <RotateCcw /> : <CalendarX2 />}
        {ended ? "Còn hiệu lực lại" : "Hết hiệu lực"}
      </Button>
      <AlertDialog open={asking} onOpenChange={(o) => !o && !busy && setAsking(false)}>
        <ConfirmContent
          tone={ended ? "neutral" : "warning"}
          title={ended ? `${record.code} còn hiệu lực lại?` : `${record.code} hết hiệu lực?`}
          description={ended ? `Bỏ ngày hết hiệu lực ${formatPlainDate(record.effectiveTo)}.` : undefined}
          cancelLabel="Không đổi"
          confirmLabel={ended ? "Còn hiệu lực lại" : "Hết hiệu lực"}
          busy={busy}
          keepOpen
          onConfirm={() => void run()}
        >
          {ended ? (error ? <p className="text-destructive text-sm">{error}</p> : null) : (
            <div className="space-y-1.5">
              <div className="text-sm font-medium">Hết hiệu lực từ ngày</div>
              <div className="w-40">
                <DateInput value={date} onChange={(v: any) => { setDate(v); setError(null); }} name="endDate" />
              </div>
              {error ? <p className="text-destructive text-sm">{error}</p> : null}
            </div>
          )}
        </ConfirmContent>
      </AlertDialog>
    </>
  );
}

function Info({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0 space-y-1", className)}>
      <div className="text-muted-foreground text-sm">{label}</div>
      <div className="text-sm font-medium">{children}</div>
    </div>
  );
}

/** Màn XEM: cùng bố cục với form (cùng hàng, cùng thứ tự ô) nhưng là chữ, không phải ô nhập khoá. */
function ViewFields({ record }: { record: any }) {
  return (
    <div className="grid min-w-0 items-start gap-x-4 gap-y-5">
      <div className="grid items-start gap-x-4 gap-y-5 sm:grid-cols-[14rem_minmax(0,1fr)]">
        <Info label="Số hiệu"><span className="tabular-nums">{record.code}</span></Info>
        <Info label="Tên văn bản">{record.name}</Info>
      </div>
      <div className="grid items-start gap-x-4 gap-y-5 sm:grid-cols-[repeat(4,max-content)] sm:gap-x-10">
        <Info label="Ngày ban hành"><span className="tabular-nums">{formatPlainDate(record.issuedOn)}</span></Info>
        <Info label="Ngày có hiệu lực"><span className="tabular-nums">{formatPlainDate(record.effectiveFrom)}</span></Info>
        {record.replaces?.code ? <Info label="Thay thế thông tư">{record.replaces.code}</Info> : null}
        <Info label="Hiệu lực">
          {record.effective ? <Badge variant="success">Đang hiệu lực</Badge>
            : <Badge variant="neutral">Hết hiệu lực{record.effectiveTo ? ` từ ${formatPlainDate(record.effectiveTo)}` : ""}</Badge>}
        </Info>
      </div>
      {record.note ? <Info label="Ghi chú"><span className="font-normal whitespace-pre-line">{record.note}</span></Info> : null}
      <ViewFiles id={record.id} />
    </div>
  );
}

/** Tệp của màn XEM: xếp ngay dưới nhãn, bấm là xem trước trong ứng dụng. */
function ViewFiles({ id }: { id: number }) {
  const { open } = useNotification();
  const [preview, setPreview] = useState<PreviewSource | null>(null);
  const { data } = useQuery({
    queryKey: ["attachments", RESOURCE, id],
    queryFn: () => kyInstance.get("attachments", { searchParams: { resource: RESOURCE, recordId: String(id) } }).json<AttachmentInfo[]>(),
  });
  const files = Array.isArray(data) ? data : [];
  const view = async (f: AttachmentInfo) => {
    try {
      const blob = await kyInstance.get(`attachments/${f.id}/content`).blob();
      setPreview({ name: f.fileName, type: f.contentType, blob });
    } catch (error) {
      open?.({ type: "error", message: await errorMessage(error) });
    }
  };
  return (
    <Info label={PDF_TITLE}>
      {files.length ? (
        <div className="flex flex-wrap gap-2">
          {files.map((f) => (
            <button key={f.id} type="button" onClick={() => void view(f)} title={`Xem ${f.fileName}`}
              className="bg-card hover:border-primary flex max-w-[22rem] items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left">
              <FileTypeIcon name={f.fileName} type={f.contentType} />
              <span className="min-w-0 truncate font-normal">{f.fileName}</span>
              <span className="text-muted-foreground shrink-0 text-xs font-normal">{fileSize(f.sizeBytes)}</span>
            </button>
          ))}
        </div>
      ) : (
        <span className="text-muted-foreground font-normal">Chưa có tệp</span>
      )}
      <FilePreviewDialog source={preview} onClose={() => setPreview(null)} />
    </Info>
  );
}

export function LegalDocDialog({ state, onClose, onSaved }: {
  state: LegalDocDialogState;
  onClose: () => void;
  /** Sau khi lưu, kèm bản ghi vừa lưu (popup chọn văn bản chọn sẵn nó). */
  onSaved?: (record: { id: number }) => void;
}) {
  const [mode, setMode] = useState<"create" | "edit" | "view">("view");
  const id = state?.id;
  useEffect(() => {
    if (state) setMode(state.mode);
  }, [state]);
  const mayWrite = useCan({ resource: RESOURCE, action: "edit" }).data?.can ?? false;
  const { data: record, isLoading } = useQuery({
    queryKey: [RESOURCE, "dialog", id],
    enabled: !!state && id != null,
    queryFn: () => kyInstance.get(`${RESOURCE}/${id}`).json<any>(),
  });
  const { data: attachments } = useQuery({
    queryKey: ["attachments", RESOURCE, id],
    enabled: !!state && id != null,
    queryFn: () => kyInstance.get("attachments", { searchParams: { resource: RESOURCE, recordId: String(id) } }).json<unknown[]>(),
  });
  const form = useForm<any>({ mode: "onBlur", defaultValues: EMPTY });
  const [pdf, setPdf] = useState<File | null>(null);
  const [pdfMissing, setPdfMissing] = useState(false);
  const [saving, setSaving] = useState(false);
  const { open: notify } = useNotification();
  const invalidate = useInvalidate();
  const queryClient = useQueryClient();

  // Mở hộp: thêm mới thì form trống; xem / sửa thì nạp bản ghi.
  useEffect(() => {
    if (!state) return;
    setPdf(null);
    setPdfMissing(false);
    if (state.mode === "create") form.reset(EMPTY);
  }, [state, form]);
  useEffect(() => {
    if (record && id != null) {
      form.reset({
        code: record.code ?? "",
        name: record.name ?? "",
        issuedOn: record.issuedOn ?? null,
        effectiveFrom: record.effectiveFrom ?? null,
        effectiveTo: record.effectiveTo ?? null,
        replaces: { id: record.replaces?.id ?? null },
        note: record.note ?? "",
      });
    }
  }, [record, id, form]);

  const readOnly = mode === "view";
  const hasPdf = mode === "create" ? !!pdf : (Array.isArray(attachments) ? attachments.length : 0) > 0;

  const submit = form.handleSubmit(async (v) => {
    if (!hasPdf) {
      setPdfMissing(true);
      return;
    }
    setSaving(true);
    const body = {
      code: v.code.trim(),
      name: v.name.trim(),
      note: v.note?.trim() || null,
      docType: "THONG_TU",
      issuer: record?.issuer ?? "Bộ Giáo dục và Đào tạo",
      issuedOn: v.issuedOn,
      effectiveFrom: v.effectiveFrom,
      // Không còn ô Hết hiệu lực: văn bản hết hiệu lực khi có thông tư mới thay thế (máy chủ tự ghi) — giữ nguyên giá trị cũ.
      effectiveTo: record?.effectiveTo ?? null,
      replaces: { id: v.replaces?.id ?? null },
      active: true,
    };
    try {
      const saved = mode === "create"
        ? await kyInstance.post(RESOURCE, { json: body }).json<any>()
        : await kyInstance.patch(`${RESOURCE}/${id}`, { json: body }).json<any>();
      if (mode === "create" && pdf) {
        const data = new FormData();
        data.append("resource", RESOURCE);
        data.append("recordId", String(saved.id));
        data.append("file", pdf);
        try {
          await kyInstance.post("attachments", { body: data });
        } catch (error) {
          notify?.({ type: "error", message: await errorMessage(error), description: "Đã lưu văn bản nhưng chưa tải được tệp" });
        }
      }
      await invalidate({ resource: RESOURCE, invalidates: ["list", "many", "detail"] });
      await queryClient.invalidateQueries({ queryKey: [RESOURCE] });
      notify?.({ type: "success", message: mode === "create" ? "Đã thêm văn bản" : "Đã lưu thay đổi" });
      onSaved?.({ id: saved.id });
      onClose();
    } catch (error: any) {
      const errors = error?.errors as Record<string, string> | undefined;
      if (errors && Object.keys(errors).length) {
        for (const [field, message] of Object.entries(errors)) form.setError(field as any, { message });
      } else {
        notify?.({ type: "error", message: await errorMessage(error) });
      }
    } finally {
      setSaving(false);
    }
  });

  const title = mode === "create" ? "Thêm văn bản căn cứ" : mode === "edit" ? "Sửa văn bản căn cứ" : record?.code ?? "Văn bản căn cứ";

  return (
    <Dialog open={!!state} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="formFit" className="gap-0 p-0">
        <DialogHeader className="border-b px-6 pt-6 pb-4 pr-12">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">Thông tư căn cứ</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={(e) => { if (!hasPdf) setPdfMissing(true); void submit(e); }} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              {id != null && isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <div className="space-y-5">
                  {readOnly && record ? <ViewFields record={record} /> : (
                  <div className="grid min-w-0 items-start gap-x-4 gap-y-5">
                    <div className="grid items-start gap-x-4 gap-y-5 sm:grid-cols-[14rem_minmax(0,1fr)]">
                      <TextField control={form.control} name="code" label="Số hiệu" rule="SHORT_TEXT" max={50}
                        placeholder="37/2021/TT-BGDĐT"
                        rules={{ required: "Nhập số hiệu", pattern: { value: LEGAL_DOC_NUMBER, message: "Số hiệu chỉ gồm chữ, số và dấu / . -" } }} />
                      <TextField control={form.control} name="name" label="Tên văn bản" rule="NAME" rules={{ required: "Nhập tên văn bản" }}
                        placeholder="Ban hành Danh mục thiết bị dạy học tối thiểu cấp Tiểu học" />
                    </div>
                    <div className="grid items-start gap-x-4 gap-y-5 sm:grid-cols-[repeat(2,minmax(0,10rem))_minmax(0,22rem)]">
                      <DateBox control={form.control} name="issuedOn" label="Ngày ban hành" rule="PAST_OR_TODAY" required />
                      <DateBox control={form.control} name="effectiveFrom" label="Ngày có hiệu lực" required
                        validate={(v, values) => !v || !values?.issuedOn || String(v) >= String(values.issuedOn) || "Không được trước ngày ban hành"} />
                      <RefField control={form.control} name="replaces" resource={RESOURCE} label="Thay thế thông tư" placeholder="Không thay thế"
                        labelField="code" current={record?.replaces} className="max-w-[22rem]"
                        validate={(v: any) => !v?.id || v.id !== id || "Văn bản không thay thế chính nó"} />
                    </div>
                    <TextareaField control={form.control} name="note" label="Ghi chú" rule="NOTE" className="max-w-none" />
                  </div>
                  )}
                  {mode === "create" ? (
                    <PendingPdf file={pdf} onChange={(f) => { setPdf(f); setPdfMissing(false); }} missing={pdfMissing} />
                  ) : id != null && !readOnly ? (
                    <div>
                      <AttachmentsPanel resource={RESOURCE} recordId={id} canWrite field compact required
                        title={PDF_TITLE} hint="Tệp được lưu ngay khi chọn" />
                      {pdfMissing && !hasPdf ? <p className="text-destructive mt-1.5 text-sm">Tải tệp thông tư (PDF hoặc Word)</p> : null}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
            <DialogFooter className="border-t px-6 py-3">
              {readOnly ? (
                <>
                  {mayWrite && record ? <EffectAction record={record} /> : null}
                  <Button type="button" variant="outline" onClick={onClose}>Đóng</Button>
                  {mayWrite && record ? (
                    <Button key="edit" type="button" onClick={(e) => { e.preventDefault(); setMode("edit"); }}>
                      <Pencil />
                      Sửa
                    </Button>
                  ) : null}
                </>
              ) : (
                <>
                  <Button type="button" variant="outline" onClick={onClose}>Huỷ</Button>
                  <Button key="save" type="submit" disabled={saving}>{mode === "create" ? "Lưu" : "Lưu thay đổi"}</Button>
                </>
              )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
