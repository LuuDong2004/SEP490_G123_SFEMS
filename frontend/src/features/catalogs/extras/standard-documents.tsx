import { useState, type FormEvent } from "react";
import { useCan, useCustomMutation, useInvalidate, useNotification } from "@refinedev/core";

import { API_URL } from "@/shared/api/constants";
import { AlertDialog } from "@/shared/ui/alert-dialog";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { ConfirmContent } from "@/shared/components/confirm/confirm-content";
import { AttachmentsPanel } from "@/shared/components/voucher/attachments-panel";

const ROLES = {
  MAIN: "Văn bản chính", AMENDMENT: "Sửa đổi, bổ sung", GUIDANCE: "Hướng dẫn",
  REPLACEMENT: "Thay thế", REFERENCE: "Tham khảo",
} as const;

export type StandardDocument = {
  id: number;
  documentRole: keyof typeof ROLES;
  documentNo: string;
  documentName: string | null;
  issuingAuthority: string | null;
  issueDate: string | null;
  effectiveDate: string | null;
  url: string | null;
  sortOrder: number | null;
};

type DocumentForm = Omit<StandardDocument, "id">;
const EMPTY: DocumentForm = {
  documentRole: "MAIN", documentNo: "", documentName: "", issuingAuthority: "",
  issueDate: "", effectiveDate: "", url: "", sortOrder: null,
};

export function StandardDocuments({ standardId, status, documents }: {
  standardId: number;
  status: string;
  documents: StandardDocument[];
}) {
  const mayWrite = useCan({ resource: "equipment_standards", action: "edit" }).data?.can ?? false;
  const mayDelete = useCan({ resource: "equipment_standards", action: "delete" }).data?.can ?? false;
  const editable = status === "DRAFT" && mayWrite;
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [form, setForm] = useState<DocumentForm>(EMPTY);
  const { mutate, mutation } = useCustomMutation();
  const invalidate = useInvalidate();
  const { open } = useNotification();

  function begin(document?: StandardDocument) {
    setForm(document ? {
      documentRole: document.documentRole, documentNo: document.documentNo,
      documentName: document.documentName ?? "", issuingAuthority: document.issuingAuthority ?? "",
      issueDate: document.issueDate ?? "", effectiveDate: document.effectiveDate ?? "",
      url: document.url ?? "", sortOrder: document.sortOrder,
    } : EMPTY);
    setEditing(document?.id ?? "new");
  }

  function refresh(message: string) {
    void invalidate({ resource: "equipment_standards", invalidates: ["list", "detail"] });
    open?.({ type: "success", message });
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editing === null) return;
    mutate({
      url: `${API_URL}/equipment_standards/${standardId}/documents${editing === "new" ? "" : `/${editing}`}`,
      method: editing === "new" ? "post" : "patch",
      values: {
        ...form,
        issueDate: form.issueDate || null,
        effectiveDate: form.effectiveDate || null,
        url: form.url || null,
      },
      successNotification: false,
    }, { onSuccess: () => { setEditing(null); refresh("Đã lưu văn bản căn cứ"); } });
  }

  function remove() {
    if (deleting === null) return;
    mutate({
      url: `${API_URL}/equipment_standards/${standardId}/documents/${deleting}`,
      method: "delete", values: {}, successNotification: false,
    }, { onSuccess: () => { setDeleting(null); refresh("Đã xoá văn bản căn cứ"); } });
  }

  const field = (key: keyof DocumentForm, label: string, type = "text") =>
    <label className="grid gap-1 text-sm" key={key}>
      <span>{label}</span>
      <Input type={type} value={String(form[key] ?? "")}
        onChange={(event) => setForm((previous) => ({ ...previous, [key]: event.target.value }))} />
    </label>;

  return <section className="sm:col-span-2 space-y-3">
    <div className="flex items-center justify-between gap-2">
      <h3 className="font-semibold">Văn bản căn cứ</h3>
      {editable ? <Button type="button" variant="outline" size="sm" onClick={() => begin()}>Thêm văn bản</Button> : null}
    </div>
    {documents.length === 0 ? <p className="text-sm text-muted-foreground">Chưa có văn bản căn cứ.</p> : null}
    {documents.map((document) => <div key={document.id} className="rounded-lg border p-3 text-sm space-y-1">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><strong>{document.documentNo}</strong> <span className="text-muted-foreground">· {ROLES[document.documentRole]}</span></div>
        {editable ? <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => begin(document)}>Sửa</Button>
          {mayDelete ? <Button type="button" variant="outline" size="sm" onClick={() => setDeleting(document.id)}>Xoá</Button> : null}
        </div> : null}
      </div>
      <p>{document.documentName}</p>
      <p className="text-muted-foreground">{document.issuingAuthority}{document.issueDate ? ` · Ban hành ${document.issueDate}` : ""}{document.effectiveDate ? ` · Hiệu lực ${document.effectiveDate}` : ""}</p>
      {document.url ? <a className="text-primary underline" href={document.url} target="_blank" rel="noreferrer">Mở văn bản</a> : null}
      {/* Bản PDF của văn bản: mở ngay trên màn, không phụ thuộc đường dẫn ngoài còn sống hay không. */}
      <AttachmentsPanel
        resource="equipment_standard_documents"
        recordId={document.id}
        canWrite={mayWrite}
        compact
        title="Tệp văn bản"
        description="Tệp PDF của văn bản. Bấm biểu tượng con mắt để xem."
      />
    </div>)}

    <Dialog open={editing !== null} onOpenChange={(value) => { if (!value && !mutation.isPending) setEditing(null); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>{editing === "new" ? "Thêm văn bản căn cứ" : "Sửa văn bản căn cứ"}</DialogTitle>
          <DialogDescription>Chỉ bản nháp được sửa văn bản.</DialogDescription></DialogHeader>
        <form id="standard-document-form" onSubmit={save} className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm"><span>Vai trò văn bản</span>
            <Select value={form.documentRole} onValueChange={(value) => setForm((previous) => ({ ...previous, documentRole: value as DocumentForm["documentRole"] }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(ROLES).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
            </Select>
          </label>
          <label className="grid gap-1 text-sm"><span>Số hiệu *</span><Input required maxLength={100} value={form.documentNo}
            onChange={(event) => setForm((previous) => ({ ...previous, documentNo: event.target.value }))} /></label>
          {field("documentName", "Tên văn bản")}
          {field("issuingAuthority", "Cơ quan ban hành")}
          {field("issueDate", "Ngày ban hành", "date")}
          {field("effectiveDate", "Ngày hiệu lực", "date")}
          {field("url", "Đường dẫn văn bản")}
        </form>
        <DialogFooter><Button type="button" variant="outline" onClick={() => setEditing(null)}>Đóng</Button>
          <Button type="submit" form="standard-document-form" disabled={mutation.isPending}>Lưu văn bản</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <AlertDialog open={deleting !== null} onOpenChange={(value) => { if (!value && !mutation.isPending) setDeleting(null); }}>
      <ConfirmContent tone="danger" title="Xoá văn bản căn cứ này?" description="Liên kết văn bản trên các dòng định mức sẽ được gỡ."
        cancelLabel="Giữ văn bản" confirmLabel="Xoá" busy={mutation.isPending} keepOpen onConfirm={remove} />
    </AlertDialog>
  </section>;
}
