import { useList } from "@refinedev/core";
import { ChevronDown, CircleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { useFormContext } from "react-hook-form";

import { kyInstance } from "@/shared/api/data";
import { HelpHint } from "@/shared/components/form/help-hint";
import { LoadingText } from "@/shared/components/spinner";
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
import { CATALOG_ORIGIN_LABELS, TRACKING_TYPE_LABELS } from "@/domains/equipment-catalog/types";
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
  cols = 2,
  children,
}: {
  title: string;
  caption?: string;
  /** Số cột trên màn rộng — nhóm "Đếm và quản lý" để ba ô chọn ngắn trên một hàng. */
  cols?: 2 | 3;
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
      <div className={cn("grid items-start gap-x-4 gap-y-4", cols === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  hint,
  wide,
  max,
  error,
  children,
}: {
  label: string;
  /** Trần bề rộng của ô (vd. `max-w-[16rem]`) — ô không kéo hết cột khi nội dung ngắn. */
  max?: string;
  required?: boolean;
  /** Lỗi của ô (cùng luật máy chủ) — chỉ truyền khi đã đến lúc báo (rời ô / bấm lưu), không báo khi đang gõ. */
  error?: string;
  /** Câu giải thích của chính ô này, sau dấu "?" cạnh nhãn. */
  hint?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    // Ô sai: viền đỏ ở chính ô nhập / ô chọn và một dòng lỗi ngay dưới — `data-invalid` để bấm lưu cuộn tới ô sai đầu.
    <div data-invalid={error ? "" : undefined}
      className={cn("min-w-0 space-y-1.5", wide && "col-span-full", max,
        error && "[&_button[role=combobox]]:border-destructive [&_input]:border-destructive [&_textarea]:border-destructive [&>button]:border-destructive")}>
      <Label className={cn(error && "text-destructive-text")}>
        {label}
        {required ? <span className="text-destructive ms-0.5">*</span> : null}
        {hint ? <HelpHint className="ms-1">{hint}</HelpHint> : null}
      </Label>
      {children}
      {error ? (
        <p className="text-destructive-text flex items-start gap-1.5 text-sm">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

/** So tên bỏ dấu, hoa thường, khoảng trắng thừa — "May chieu" và "Máy  chiếu" là một. */
const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/gi, "d").toLowerCase().replace(/\s+/g, " ").trim();

/** Dòng danh mục (đọc từ `/equipment_catalogs`) → thiết bị chọn được trên phiếu. */
function toPicked(row: any): PickedCatalog {
  return {
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
  };
}

/**
 * Kiểm tên ngay khi gõ (chờ 400 ms) bằng đúng luật máy chủ dùng lúc lưu (`school-items/name-check`): so THEO TỪ —
 * bỏ dấu, hoa thường, dấu câu, không kể thứ tự — với thiết bị trường chọn được (của Sở đúng cấp học, và đồ ngoài danh
 * mục của chính trường). Cùng bộ từ ("Al bột" / "Al (Bột)") là trùng: chặn và mời chọn cái đã có; phần lớn từ chung
 * ("Bột nhôm Al") là gần giống: chỉ gợi ý.
 */
function useNameCheck(name: string, enabled: boolean, excludeId?: number) {
  const [found, setFound] = useState<{ same: any | null; similar: any[] }>({ same: null, similar: [] });
  const [checking, setChecking] = useState(false);
  const key = fold(name);
  useEffect(() => {
    if (!enabled || key.length < 2) {
      setFound({ same: null, similar: [] });
      return;
    }
    let stale = false;
    setChecking(true);
    const t = setTimeout(async () => {
      try {
        const searchParams: Record<string, string> = { name: name.trim() };
        if (excludeId) searchParams.excludeId = String(excludeId);
        const res = await kyInstance.get("equipment_catalogs/school-items/name-check", { searchParams })
          .json<{ same: any | null; similar: any[] }>();
        if (!stale) setFound({ same: res.same ?? null, similar: res.similar ?? [] });
      } catch {
        if (!stale) setFound({ same: null, similar: [] });
      } finally {
        if (!stale) setChecking(false);
      }
    }, 400);
    return () => { stale = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, excludeId]);
  return { ...found, checking: checking && key.length >= 2 };
}

/** Một thiết bị đã có, kèm nguồn (Sở / trường) và nút chọn nó thay vì thêm mới. */
function ExistingRow({ row, onPick }: { row: any; onPick?: () => void }) {
  return (
    // Tên đứng một dòng riêng (hai dòng khi dài) — cạnh mã và nguồn trong hộp hẹp thì chỉ còn "Ampe kế m…".
    <li className="flex min-w-0 items-center gap-3 py-1.5">
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-medium" title={row.name}>{row.name}</p>
        <p className="text-muted-foreground text-xs">
          <span className="font-mono">{row.code}</span> · {row.ownerSchool ? "Trường đã thêm" : "Danh mục Sở"}
        </p>
      </div>
      {onPick ? (
        <Button type="button" size="sm" variant="outline" className="h-7 shrink-0 px-2 text-xs" onClick={onPick}>Chọn</Button>
      ) : null}
    </li>
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
 * Ô chọn NHIỀU môn: một thiết bị dùng được cho vài môn (cân điện tử: Toán, Hoá học). Thứ tự tích được giữ: môn đầu
 * là môn chính (đánh dấu trong danh sách), bỏ tích môn chính thì môn kế lên thay.
 *
 * "Dùng chung" là một MÔN có thật trong danh mục (mã 00 — danh mục của Sở gắn thiết bị dùng chung vào đó), đứng đầu
 * danh sách và loại trừ các môn khác: tích nó là bỏ hết môn đã chọn, tích một môn là bỏ nó. Không tích gì cũng là
 * dùng chung — lúc lưu gửi đúng môn đó, để báo cáo theo môn cộng chung một nhóm với thiết bị của Sở.
 */
function SubjectsPick({ value, onChange, items, common }: {
  value: string[];
  onChange: (v: string[]) => void;
  items: { value: string; label: string }[];
  /** Id môn "Dùng chung" (mã 00). */
  common?: string;
}) {
  const label = (id: string) => items.find((i) => i.value === id)?.label ?? id;
  const picked = value.filter((v) => v !== common);
  const toggle = (id: string) => onChange(picked.includes(id) ? picked.filter((v) => v !== id) : [...picked, id]);
  const row = "hover:bg-accent flex cursor-pointer items-center gap-2.5 rounded-sm px-2 py-1.5 text-sm";
  return (
    // `modal`: hộp thoại cha chặn cuộn ngoài nó — không modal thì danh sách môn (đổ ra ngoài hộp) không cuộn được.
    <Popover modal>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="bg-field hover:bg-accent/60 border-input shadow-e1 h-9 w-full justify-between overflow-hidden px-3.5 text-sm font-normal">
          <span className="min-w-0 truncate text-left">{picked.length ? picked.map(label).join(", ") : "Dùng chung"}</span>
          <ChevronDown className="shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-64 w-(--radix-popover-trigger-width) overflow-y-auto overscroll-contain p-1">
        <label className={cn(row, "mb-1 border-b pb-2")}>
          <Checkbox checked={!picked.length} onCheckedChange={() => onChange([])} />
          <span className="min-w-0 flex-1 truncate">Dùng chung</span>
        </label>
        {items.filter((i) => i.value !== common).map((i) => {
          const at = picked.indexOf(i.value);
          return (
            <label key={i.value} className={row}>
              <Checkbox checked={at >= 0} onCheckedChange={() => toggle(i.value)} />
              <span className="min-w-0 flex-1 truncate">{i.label}</span>
              {at === 0 && picked.length > 1 ? <span className="text-muted-foreground text-xs">môn chính</span> : null}
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
  MUA_NGOAI_KH: "OUTSIDE_PURCHASE",
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
  const [tracking, setTracking] = useState("serial");
  const [origin, setOrigin] = useState("SELF_MADE");
  const [model, setModel] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Lỗi của ô chỉ báo sau khi rời ô (`touched`) hoặc đã bấm lưu (`tried`) — không đỏ cả hộp ngay lúc mở.
  const [tried, setTried] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  // Máy chủ từ chối vì trùng tên (409): báo dưới ô Tên, không ở cuối hộp.
  const [nameConflict, setNameConflict] = useState<string | null>(null);
  useEffect(() => setNameConflict(null), [name]);

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
    setTracking(record.trackingType ?? "serial");
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
    if (category && !BULK_OK.has(category)) setTracking("serial");
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
  // Môn "Dùng chung" (mã 00): không tích môn nào thì gửi môn này.
  const commonSubject = (subjects?.data ?? []).find((x: any) => x.code === "00");
  const common = commonSubject ? String(commonSubject.id) : undefined;
  const chosenSubjects = subjectIds.filter((id) => id !== common);
  const subjectsToSend = chosenSubjects.length ? chosenSubjects : common ? [common] : [];

  const reset = () => {
    setName(""); setTypeId(""); setSubjectIds([]); setUnitId(""); setCategory("");
    setTracking("serial"); setOrigin("SELF_MADE"); setModel(""); setNote(""); setError(null);
    setTried(false); setTouched({}); setNameConflict(null);
  };

  async function submit() {
    setError(null);
    if (invalid) {
      // Bấm lưu khi còn ô sai: báo hết các ô, đưa ô sai đầu tiên vào tầm nhìn.
      setTried(true);
      requestAnimationFrame(() => document.querySelector("[data-school-item] [data-invalid]")?.scrollIntoView({ block: "center", behavior: "smooth" }));
      return;
    }
    setBusy(true);
    try {
      const url = editing ? `equipment_catalogs/school-items/${record.id}` : "equipment_catalogs/school-items";
      const row: any = await kyInstance(url, {
          method: editing ? "patch" : "post",
          json: {
            name: name.trim(),
            equipmentType: { id: Number(typeId) },
            subjects: subjectsToSend.map((id) => ({ id: Number(id) })),
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
      const message = await errorMessage(e);
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        setNameConflict(message);
        setTried(true);
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  }

  // Cùng luật với `SchoolItemRequest` ở máy chủ: báo ngay khi gõ thay vì đợi 422.
  const nameError = textError("NAME", "Tên thiết bị", name);
  const modelError = textError("SHORT_TEXT", "Model / quy cách", model);
  const noteError = textError("NOTE", "Ghi chú", note);
  const check = useNameCheck(name, open, record?.id);
  const touch = (k: string) => () => setTouched((t) => (t[k] ? t : { ...t, [k]: true }));
  const errors = {
    name: !name.trim() ? "Nhập tên thiết bị" : nameError ?? nameConflict ?? undefined,
    origin: origin ? undefined : "Vui lòng chọn nguồn gốc",
    type: typeId ? undefined : "Vui lòng chọn loại thiết bị",
    category: category ? undefined : "Vui lòng chọn phân loại kế toán",
    unit: unitId ? undefined : "Vui lòng chọn đơn vị tính",
    model: modelError ?? undefined,
    note: noteError ?? undefined,
  };
  /**
   * Lỗi đến lúc báo của ô `k`. Thiếu ô bắt buộc chỉ báo khi đã bấm lưu; lỗi định dạng (quá dài, ký tự lạ) báo khi rời
   * ô đã gõ. Không báo "Nhập tên" lúc vừa rời ô trống: dòng lỗi chen vào đẩy nút xuống, cú bấm "Thêm" trượt mất.
   */
  const shown = (k: keyof typeof errors, filled = false) => (tried || (touched[k] && filled) ? errors[k] : undefined);
  // Trùng hẳn tên một thiết bị đã có: chặn lưu — khung đỏ dưới ô Tên đã nói và mời chọn cái đó.
  const invalid = Object.values(errors).some(Boolean) || !!check.same;
  const pickExisting = (row: any) => { reset(); onCreated(toPicked(row)); };
  // Luật "theo số lượng chỉ cho vật tư, hoá chất" nói ngay dưới ô nó chi phối, và nói theo phân loại
  // ĐANG chọn — một đoạn chung ở cuối phiếu thì lúc cần không ai còn đọc.
  const trackingHint = !category
    ? "Vật tư, hoá chất thì quản lý theo lô. Thiết bị khác thì từng cái, mỗi cái một mã."
    : BULK_OK.has(category)
      ? "Theo lô: cả lô dùng chung một mã. Đã nhập hàng rồi thì không đổi được."
      : "Mỗi cái một mã riêng. Đã nhập hàng rồi thì không đổi được.";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent>
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
        <div data-school-item className="-mx-6 max-h-[60vh] space-y-5 overflow-y-auto px-6 py-1">
          <Group title="Thiết bị">
            <Field label="Tên thiết bị" required error={shown("name", !!name.trim())}>
              {/* Ô nhiều dòng: tên thiết bị trong danh mục thường dài cả câu ("Bộ tranh mô hình hoá các thành
                  tố của các loại văn bản thơ") — ô một dòng chỉ thấy được nửa tên đang gõ. Tối đa 255 ký
                  tự như máy chủ nhận; bộ đếm chỉ hiện khi sắp chạm trần. */}
              <Textarea
                autoFocus
                rows={2}
                maxLength={maxLengthOf("NAME")}
                value={name}
                onChange={(e) => setName(e.target.value.replace(/\n/g, " "))}
                onBlur={touch("name")}
                placeholder="VD: Mô hình cấu tạo tế bào (tự làm)"
                className="min-h-0 resize-none"
              />
              {name.length > 200 ? (
                <p className="text-muted-foreground text-end text-xs tabular-nums">{name.length}/255</p>
              ) : null}
              {check.same ? (
                // Trùng hẳn tên (bỏ dấu, hoa thường): chặn lưu, mời chọn thiết bị đã có.
                <div role="alert" className="bg-destructive-subtle border-destructive/30 rounded-md border px-3 py-2">
                  <p className="text-destructive-text flex items-center gap-1.5 text-sm font-medium">
                    <CircleAlert className="size-3.5 shrink-0" />
                    {check.same.ownerSchool ? "Trường đã thêm thiết bị này" : "Danh mục của Sở đã có thiết bị này"}
                  </p>
                  <ul><ExistingRow row={check.same} onPick={editing ? undefined : () => pickExisting(check.same)} /></ul>
                </div>
              ) : check.similar.length ? (
                // Gần giống: chỉ gợi ý, vẫn thêm mới được.
                <div className="bg-muted/60 rounded-md border px-3 py-2">
                  <p className="text-muted-foreground text-xs font-medium">Có thể đã có — chọn nếu đúng thiết bị này</p>
                  <ul className="divide-y">
                    {check.similar.map((r) => (
                      <ExistingRow key={r.id} row={r} onPick={editing ? undefined : () => pickExisting(r)} />
                    ))}
                  </ul>
                </div>
              ) : check.checking ? (
                <LoadingText className="text-xs" label="Đang kiểm tên…" />
              ) : null}
            </Field>
            {fixedOrigin ? (
              // Phiếu đã nói nguồn hình thành: nguồn gốc theo phiếu, chỉ xem.
              <ReadField label="Nguồn gốc" className="max-w-[14rem] gap-1.5">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate">{CATALOG_ORIGIN_LABELS[fixedOrigin]}</span>
                  <HelpHint>Theo nguồn hình thành của phiếu ("{voucherRule?.name}"). Muốn nguồn khác thì đổi nguồn hình thành ở đầu phiếu.</HelpHint>
                </span>
              </ReadField>
            ) : (
              <Field label="Nguồn gốc" max="max-w-[14rem]" required error={shown("origin")} hint={voucherRule || editing ? undefined : "Chọn nguồn hình thành ở đầu phiếu thì ô này tự theo."}>
                <Pick value={origin} onChange={setOrigin} placeholder="Vui lòng chọn nguồn gốc"
                  items={Object.entries(CATALOG_ORIGIN_LABELS).map(([value, label]) => ({ value, label }))} />
              </Field>
            )}
            <Field label="Model / quy cách" max="max-w-[16rem]" error={shown("model", !!model.trim())}>
              <Input value={model} onChange={(e) => setModel(e.target.value)} onBlur={touch("model")} placeholder="Không bắt buộc" maxLength={maxLengthOf("SHORT_TEXT")} />
            </Field>
          </Group>

          <Group
            title="Xếp nhóm"
            caption="Chọn đúng loại và môn để thiết bị được tính vào báo cáo."
          >
            <Field label="Loại thiết bị" max="max-w-[16rem]" required error={shown("type")}>
              <Pick value={typeId} onChange={setTypeId} placeholder="Vui lòng chọn loại thiết bị"
                items={(types?.data ?? []).map((t: any) => ({ value: String(t.id), label: t.name }))} />
            </Field>
            <Field label="Môn học" max="max-w-[16rem]" hint="Chọn một hoặc nhiều môn. Thiết bị dùng cho mọi môn thì để Dùng chung.">
              <SubjectsPick value={subjectIds} onChange={setSubjectIds} common={common}
                items={(subjects?.data ?? []).map((x: any) => ({ value: String(x.id), label: x.name }))} />
            </Field>
          </Group>

          {/* Ba ô một hàng, "Cách quản lý" đứng ngay sau "Phân loại kế toán": theo lô chỉ mở khi phân loại là vật tư /
              hoá chất, hai ô liền nhau thì thấy ngay ô này theo ô kia. */}
          <Group title="Đếm và quản lý" cols={3}>
            <Field label="Phân loại kế toán" required error={shown("category")}>
              <Pick value={category} onChange={setCategory} placeholder="Vui lòng chọn phân loại"
                items={Object.entries(ASSET_CATEGORY_LABELS).map(([value, label]) => ({ value, label }))} />
            </Field>
            <Field label="Cách quản lý" required hint={trackingHint}>
              <Pick value={tracking} onChange={setTracking} placeholder="Vui lòng chọn cách quản lý"
                items={Object.entries(TRACKING_TYPE_LABELS).map(([value, label]) => ({
                  value, label, disabled: value === "bulk" && !BULK_OK.has(category),
                }))} />
            </Field>
            <Field label="Đơn vị tính" required error={shown("unit")}>
              <Pick value={unitId} onChange={setUnitId} placeholder="Vui lòng chọn đơn vị tính"
                items={(units?.data ?? []).map((u: any) => ({ value: String(u.id), label: u.name }))} />
            </Field>
            <Field label="Ghi chú" wide max="max-w-[28rem]" error={shown("note", !!note.trim())}>
              <Input value={note} onChange={(e) => setNote(e.target.value)} onBlur={touch("note")} maxLength={maxLengthOf("NOTE")} placeholder="VD: Tổ Sinh tự làm năm học 2025-2026" />
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
          <Button type="button" disabled={busy} onClick={() => void submit()}>
            {busy ? "Đang lưu…" : editing ? "Lưu thay đổi" : "Lưu và chọn"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
