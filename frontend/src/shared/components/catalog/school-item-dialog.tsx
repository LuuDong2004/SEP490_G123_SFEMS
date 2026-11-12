import { useList } from "@refinedev/core";
import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { useFormContext } from "react-hook-form";

import { kyInstance } from "@/shared/api/data";
import { HelpHint } from "@/shared/components/form/help-hint";
import { ReadField } from "@/shared/components/form/read-field";
import { useOriginRules } from "@/shared/hooks/use-origin-rules";
import { errorMessage } from "@/shared/lib/api-error";
import { maxLengthOf, textError } from "@/shared/lib/field-rules";
import { cn } from "@/shared/lib/utils";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Textarea } from "@/shared/ui/textarea";
import { CATALOG_ORIGIN_LABELS } from "@/domains/equipment-catalog/types";
import { TRACKING_LABELS } from "@/domains/equipment-intake/types";
import { ASSET_CATEGORY_LABELS } from "@/domains/equipment/types";
import type { PickedCatalog } from "@/domains/equipment-catalog/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Chỉ vật tư tiêu hao (vật tư, hoá chất) được quản lý theo số lượng — cùng luật máy chủ kiểm. */
const BULK_OK = new Set(["SUPPLY", "CHEMICAL"]);

/**
 * Một nhóm ô nhập, có tên nhóm nhỏ ở trên.
 *
 * Chín ô xếp thành một lưới hai cột phẳng thì hàng nào cũng ghép hai thứ không liên quan — "Nguồn
 * gốc" cạnh "Loại thiết bị", "Môn học" cạnh "Đơn vị tính" — và người điền phải đọc từng nhãn mới
 * biết mình đang khai gì. Gom theo CÂU HỎI (thiết bị là gì · xếp vào nhóm nào · đếm thế nào) thì
 * mỗi nhóm trả lời một câu, và chỉ nhóm giữa là thứ quyết định báo cáo của Sở cộng đúng hay không.
 */
function Group({
  title,
  caption,
  children,
}: {
  title: string;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      {/* Lời giải thích nằm sau dấu "?" cạnh tên nhóm, không thành một dòng chữ dưới nó: hộp thoại có
          chín ô, thêm ba bốn dòng chú thích là cao quá màn hình và phải cuộn mới thấy nút. */}
      <h3 className="text-overline text-muted-foreground flex items-center gap-1.5">
        {title}
        {caption ? <HelpHint>{caption}</HelpHint> : null}
      </h3>
      <div className="grid items-start gap-x-4 gap-y-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  hint,
  wide,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  /** Lỗi kiểm tra của ô (cùng luật máy chủ), hiện ngay dưới ô. */
  error?: string;
  /** Câu giải thích của chính ô này, sau dấu "?" cạnh nhãn. */
  hint?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", wide && "sm:col-span-2")}>
      <Label>
        {label}
        {required ? <span className="text-destructive ms-0.5">*</span> : null}
        {hint ? <HelpHint className="ms-1">{hint}</HelpHint> : null}
      </Label>
      {children}
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
  );
}

function Pick({ value, onChange, placeholder, items }: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  items: { value: string; label: string; disabled?: boolean }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-64">
        {items.map((i) => (
          <SelectItem key={i.value} value={i.value} disabled={i.disabled}>
            {i.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Ô chọn NHIỀU môn: một thiết bị dùng được cho vài môn (cân điện tử: Toán, Hoá học). Không có dòng
 * "Dùng chung" để chọn — không tích môn nào chính là dùng chung, và ô ghi đúng chữ đó khi trống. Thứ tự
 * tích được giữ: môn đầu là môn chính (đánh dấu trong danh sách), bỏ tích môn chính thì môn kế lên thay.
 */
function SubjectsPick({ value, onChange, items }: {
  value: string[];
  onChange: (v: string[]) => void;
  items: { value: string; label: string }[];
}) {
  const label = (id: string) => items.find((i) => i.value === id)?.label ?? id;
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="h-9 w-full justify-between overflow-hidden px-3 font-normal">
          <span className={cn("min-w-0 truncate text-left", !value.length && "text-muted-foreground")}>
            {value.length ? value.map(label).join(", ") : "Dùng chung"}
          </span>
          <ChevronDown className="shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-64 w-(--radix-popover-trigger-width) overflow-y-auto p-1">
        {items.map((i) => {
          const at = value.indexOf(i.value);
          return (
            <label key={i.value} className="hover:bg-accent flex cursor-pointer items-center gap-2.5 rounded-sm px-2 py-1.5 text-sm">
              <Checkbox checked={at >= 0} onCheckedChange={() => toggle(i.value)} />
              <span className="min-w-0 flex-1 truncate">{i.label}</span>
              {at === 0 ? <span className="text-muted-foreground text-xs">môn chính</span> : null}
            </label>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

/**
 * Nguồn hình thành của PHIẾU ghi tăng (mã dòng `origin_sources`) → nguồn gốc của thiết bị ngoài danh mục
 * thêm trên phiếu đó. Hai ô hỏi cùng một điều ("đồ này từ đâu ra"), nên khi phiếu đã nói thì thiết bị
 * theo phiếu, không hỏi lại — hỏi hai lần là có ngày phiếu ghi "Mua sắm" mà thiết bị ghi "Tự làm".
 * Ba nguồn còn lại của phiếu (được Sở phân bổ, kiểm kê thừa, khác) không suy ra được: người dùng tự chọn.
 */
const ORIGIN_BY_VOUCHER: Record<string, string> = {
  TU_LAM: "SELF_MADE",
  TANG_TAI_TRO: "DONATED",
  MUA_SAM: "OUTSIDE_PURCHASE",
};

/**
 * Trường thêm một thiết bị NGOÀI danh mục của Sở — đồ tự làm, được tài trợ, mua ngoài danh mục —
 * ngay lúc ghi tăng, không phải chờ Sở bổ sung. Chỉ trường mình thấy và chọn được nó; mã do hệ thống
 * cấp. Hỏi đúng những nhãn báo cáo của Sở cộng theo (loại, môn, đơn vị tính, phân loại, nguồn gốc),
 * nên thiết bị này được tính đủ dù không có trong danh mục.
 *
 * <p>Có `record` là SỬA thiết bị đó (hồ sơ thiết bị trong danh mục, `PATCH /school-items/{id}`): điền sẵn
 * mọi ô, nguồn gốc tự chọn (không theo phiếu nào). Máy chủ chỉ cho trường sở hữu sửa, và không cho đổi
 * cách quản lý khi đã có tài sản.
 */
export function SchoolItemDialog({
  open,
  onOpenChange,
  initialName = "",
  onCreated,
  record,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Từ khoá vừa tìm không ra — điền sẵn làm tên. */
  initialName?: string;
  onCreated: (row: PickedCatalog) => void;
  /** Thiết bị ngoài danh mục đang sửa (bản ghi `equipment_catalogs`); vắng là thêm mới. */
  record?: any;
}) {
  const editing = !!record?.id;
  const [name, setName] = useState("");
  const [typeId, setTypeId] = useState("");
  // Các môn dùng thiết bị, THEO THỨ TỰ CHỌN: môn đầu là môn chính. Rỗng = dùng chung.
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const [unitId, setUnitId] = useState("");
  const [category, setCategory] = useState("");
  const [tracking, setTracking] = useState("SERIAL");
  const [origin, setOrigin] = useState("SELF_MADE");
  const [model, setModel] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!record?.id) {
      setName(initialName);
      return;
    }
    setName(record.name ?? "");
    setTypeId(record.equipmentType?.id ? String(record.equipmentType.id) : "");
    setSubjectIds((record.subjects?.length ? record.subjects : record.subject ? [record.subject] : []).map((x: any) => String(x.id)));
    setUnitId(record.unit?.id ? String(record.unit.id) : "");
    setCategory(record.assetCategory ?? "");
    setTracking(record.trackingType ?? "SERIAL");
    setOrigin(record.origin ?? "SELF_MADE");
    setModel(record.model ?? "");
    setNote(record.note ?? "");
    setError(null);
  }, [open, initialName, record]);
  // Hộp này mở từ form phiếu ghi tăng: đọc nguồn hình thành của phiếu (context của form đi qua portal).
  const voucher = useFormContext();
  const voucherOriginId = voucher?.watch("originSource.id");
  const voucherRule = useOriginRules(open).ruleOf(voucherOriginId);
  const fixedOrigin = !editing && voucherRule ? ORIGIN_BY_VOUCHER[voucherRule.code] : undefined;
  useEffect(() => {
    if (open && fixedOrigin) setOrigin(fixedOrigin);
  }, [open, fixedOrigin]);
  // Đổi sang phân loại không phải vật tư tiêu hao thì không còn được quản lý theo số lượng.
  useEffect(() => {
    if (category && !BULK_OK.has(category)) setTracking("SERIAL");
  }, [category]);

  const list = (resource: string) => ({
    resource,
    pagination: { pageSize: 200 },
    filters: [{ field: "active", operator: "eq" as const, value: true }],
    sorters: [{ field: "sortOrder", order: "asc" as const }],
    queryOptions: { enabled: open },
  });
  const { result: types } = useList<any>(list("equipment_types"));
  const { result: subjects } = useList<any>(list("subjects"));
  const { result: units } = useList<any>(list("units"));

  const reset = () => {
    setName(""); setTypeId(""); setSubjectIds([]); setUnitId(""); setCategory("");
    setTracking("SERIAL"); setOrigin("SELF_MADE"); setModel(""); setNote(""); setError(null);
  };

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const url = editing ? `equipment_catalogs/school-items/${record.id}` : "equipment_catalogs/school-items";
      const row: any = await kyInstance(url, {
          method: editing ? "patch" : "post",
          json: {
            name: name.trim(),
            equipmentType: { id: Number(typeId) },
            subjects: subjectIds.map((id) => ({ id: Number(id) })),
            unit: { id: Number(unitId) },
            assetCategory: category,
            trackingType: tracking,
            physicalOrDigital: record?.physicalOrDigital ?? "PHYSICAL",
            origin,
            model: model.trim() || null,
            note: note.trim() || null,
          },
        })
        .json();
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
        ownerSchool: row.ownerSchool ?? null,
        origin: row.origin ?? null,
      });
    } catch (e) {
      setError(await errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  // Cùng luật với `SchoolItemRequest` ở máy chủ: báo ngay khi gõ thay vì đợi 422.
  const nameError = textError("NAME", "Tên thiết bị", name);
  const modelError = textError("SHORT_TEXT", "Model / quy cách", model);
  const noteError = textError("NOTE", "Ghi chú", note);
  const ready = name.trim() && typeId && unitId && category && origin && !nameError && !modelError && !noteError;
  // Luật "theo số lượng chỉ cho vật tư, hoá chất" nói ngay dưới ô nó chi phối, và nói theo phân loại
  // ĐANG chọn — một đoạn chung ở cuối phiếu thì lúc cần không ai còn đọc.
  const trackingHint = !category
    ? "Vật tư, hoá chất thì đếm theo số lượng. Thiết bị khác thì mỗi cái một mã."
    : BULK_OK.has(category)
      ? "Đếm theo số lượng, cả lô dùng chung một mã. Đã nhập hàng rồi thì không đổi được."
      : "Mỗi cái một mã riêng. Đã nhập hàng rồi thì không đổi được.";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent size="form">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {editing ? "Sửa thiết bị ngoài danh mục" : "Thêm thiết bị ngoài danh mục"}
            <HelpHint>
              Dùng khi thiết bị không có trong danh mục của Sở. Chỉ trường mình thấy thiết bị này.
            </HelpHint>
          </DialogTitle>
          {/* Vẫn giữ cho trình đọc màn hình (Radix đòi hộp thoại có mô tả), chỉ không vẽ ra. */}
          <DialogDescription className="sr-only">
            Đồ trường tự làm, được tài trợ hoặc mua ngoài danh mục của Sở. Chỉ trường mình chọn được, mã được cấp tự động.
          </DialogDescription>
        </DialogHeader>

        {/* Cao hơn màn hình thì cuộn phần ô nhập, không cuộn cả hộp thoại: tiêu đề và hàng nút phải
            luôn nhìn thấy. `-mx-6 px-6` để viền sáng khi lấy nét không bị cắt mất ở mép vùng cuộn. */}
        <div className="-mx-6 max-h-[60vh] space-y-5 overflow-y-auto px-6 py-1">
          <Group title="Thiết bị">
            <Field label="Tên thiết bị" required error={nameError}>
              {/* Ô nhiều dòng: tên thiết bị trong danh mục thường dài cả câu ("Bộ tranh mô hình hoá các thành
                  tố của các loại văn bản thơ") — ô một dòng chỉ thấy được nửa tên đang gõ. Tối đa 255 ký
                  tự như máy chủ nhận; bộ đếm chỉ hiện khi sắp chạm trần. */}
              <Textarea
                autoFocus
                rows={2}
                maxLength={maxLengthOf("NAME")}
                value={name}
                onChange={(e) => setName(e.target.value.replace(/\n/g, " "))}
                placeholder="VD: Mô hình cấu tạo tế bào (tự làm)"
                className="min-h-0 resize-none"
              />
              {name.length > 200 ? (
                <p className="text-muted-foreground text-end text-xs tabular-nums">{name.length}/255</p>
              ) : null}
            </Field>
            {fixedOrigin ? (
              // Phiếu đã nói nguồn hình thành: nguồn gốc theo phiếu, chỉ xem.
              <ReadField label="Nguồn gốc" className="gap-1.5">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate">{CATALOG_ORIGIN_LABELS[fixedOrigin as keyof typeof CATALOG_ORIGIN_LABELS]}</span>
                  <HelpHint>Theo nguồn hình thành của phiếu ("{voucherRule?.name}"). Muốn nguồn khác thì đổi nguồn hình thành ở đầu phiếu.</HelpHint>
                </span>
              </ReadField>
            ) : (
              <Field label="Nguồn gốc" required hint={voucherRule || editing ? undefined : "Chọn nguồn hình thành ở đầu phiếu thì ô này tự theo."}>
                <Pick value={origin} onChange={setOrigin} placeholder="Vui lòng chọn nguồn gốc"
                  items={Object.entries(CATALOG_ORIGIN_LABELS).map(([value, label]) => ({ value, label }))} />
              </Field>
            )}
            <Field label="Model / quy cách" error={modelError}>
              <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Không bắt buộc" maxLength={maxLengthOf("SHORT_TEXT")} />
            </Field>
          </Group>

          <Group
            title="Xếp nhóm"
            caption="Chọn đúng loại và môn để thiết bị được tính vào báo cáo."
          >
            <Field label="Loại thiết bị" required>
              <Pick value={typeId} onChange={setTypeId} placeholder="Vui lòng chọn loại thiết bị"
                items={(types?.data ?? []).map((t: any) => ({ value: String(t.id), label: t.name }))} />
            </Field>
            <Field label="Môn học" hint="Chọn một hoặc nhiều môn. Để trống nếu dùng chung cho mọi môn.">
              <SubjectsPick value={subjectIds} onChange={setSubjectIds}
                items={(subjects?.data ?? []).map((x: any) => ({ value: String(x.id), label: x.name }))} />
            </Field>
          </Group>

          <Group title="Đếm và quản lý">
            <Field label="Phân loại tài sản" required>
              <Pick value={category} onChange={setCategory} placeholder="Vui lòng chọn phân loại"
                items={Object.entries(ASSET_CATEGORY_LABELS).map(([value, label]) => ({ value, label }))} />
            </Field>
            <Field label="Đơn vị tính" required>
              <Pick value={unitId} onChange={setUnitId} placeholder="Vui lòng chọn đơn vị tính"
                items={(units?.data ?? []).map((u: any) => ({ value: String(u.id), label: u.name }))} />
            </Field>
            <Field label="Cách quản lý" required hint={trackingHint}>
              <Pick value={tracking} onChange={setTracking} placeholder="Vui lòng chọn cách quản lý"
                items={Object.entries(TRACKING_LABELS).map(([value, label]) => ({
                  value, label, disabled: value === "BULK" && !BULK_OK.has(category),
                }))} />
            </Field>
            <Field label="Ghi chú" wide error={noteError}>
              <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={maxLengthOf("NOTE")} placeholder="VD: Tổ Sinh tự làm năm học 2025-2026" />
            </Field>
          </Group>
        </div>

        {error ? (
          <p role="alert" className="bg-destructive-subtle text-destructive-text rounded-md px-3 py-2 text-sm">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Huỷ</Button>
          <Button type="button" disabled={busy || !ready} onClick={() => void submit()}>
            {busy ? "Đang lưu…" : editing ? "Lưu thay đổi" : "Thêm và chọn"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
