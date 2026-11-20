import type { ReactNode } from "react";
import type { Control } from "react-hook-form";
import { Sparkles } from "lucide-react";

import { Input } from "@/shared/ui/input";
import { SwitchRow } from "@/shared/components/form/switch-row";
import { Textarea } from "@/shared/ui/textarea";
import { FormHint } from "@/shared/components/form/help-hint";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/ui/form";
import { FormSection } from "@/shared/components/form/form-section";
import { maxLengthOf, mergeRules, textRules } from "@/shared/lib/field-rules";
import { lowerLabel } from "@/shared/lib/label";
import type { CatalogConfig } from "@/shared/components/catalog/types";

/** Payload tạo/sửa — `CatalogRequest` / `CatalogPatchRequest` ở backend. */
export type CatalogFormValues = {
  code: string;
  name: string;
  sortOrder: number | null;
  active: boolean;
  note: string;
};

export const DEFAULT_VALUES: CatalogFormValues = {
  code: "",
  name: "",
  sortOrder: null,
  active: true,
  note: "",
};

/**
 * Form của một mục danh mục, dùng chung cho màn thêm, màn sửa và hộp thoại — cùng một khuôn với
 * màn xem (`CatalogDetailSections`): mở xem rồi bấm Sửa thì mọi ô nằm nguyên chỗ.
 *
 * <p>Ba nhóm, tiêu đề nằm TRÊN ô nhập, lưới 4 cột: Thông tin cơ bản (mã · tên · trạng thái — công
 * tắc ngay trong hàng, không có khối "Hiển thị" riêng), phần riêng của danh mục (`extra`, nếu có),
 * Ghi chú. Không có ô Radix `Select` nào ở đây, nên màn sửa dựng form ngay mà không phải gác chờ
 * bản ghi.
 */
export function CatalogFields({
  control,
  config,
  suggestedCode,
  extra,
  creating,
}: {
  /** Đang thêm mới: không hiện Trạng thái — bản ghi mới lúc nào cũng đang hoạt động, ô đó không có nghĩa. */
  creating?: boolean;
  control: Control<CatalogFormValues>;
  config: CatalogConfig;
  /** Giữ để không vỡ chỗ gọi cũ — khuôn giờ luôn là kiểu gọn (tiêu đề nằm trên). */
  compact?: boolean;
  /** Mã gợi ý của quy tắc sinh mã — chỉ có ở màn thêm mới. */
  suggestedCode?: string | null;
  /** `inline`: một, hai ô ngắn — đứng luôn trong khối cơ bản, trước Trạng thái, không thành nhóm riêng. */
  extra?: { title: string; content: ReactNode; inline?: boolean };
}) {
  // Lưới theo bề rộng của CHÍNH khung chứa (container query), không theo màn hình: trong hộp thoại
  // hẹp là 2 cột, trên trang rộng là 4 — cùng một khuôn mà không để trống nửa hộp thoại.
  return (
    <div className="catalog-form @container max-w-5xl space-y-6">
      <FormSection title="Thông tin cơ bản" compact>
        <div className="form-flow">
          {config.hideCode ? null : <CatalogCodeField control={control} config={config} suggestedCode={suggestedCode} />}

          {config.hideName ? null : <CatalogNameField control={control} config={config} className="@3xl:col-span-2" />}

          {extra?.inline ? extra.content : null}

          {/* Không có ô Thứ tự: máy chủ xếp mục mới cuối danh sách (CatalogService.create). */}
          {config.extra?.hideActive || creating ? null : <CatalogActiveField control={control} className="@3xl:col-span-2" />}
        </div>
      </FormSection>

      {extra && !extra.inline ? (
        <FormSection title={extra.title} compact>
          {extra.content}
        </FormSection>
      ) : null}

      <FormSection title="Ghi chú" compact>
        <div className="form-flow">
          <CatalogNoteField control={control} />
        </div>
      </FormSection>
    </div>
  );
}


/**
 * Ô mã của danh mục — tách riêng để form có bố cục riêng (`FormBody`, vd. lớp học) dùng lại đúng luật mã.
 * `fill`: lấp đủ ô lưới, bỏ bề rộng hẹp `codeWidth` (chỉ hợp với hàng `form-flow`).
 */
export function CatalogCodeField({ control, config, suggestedCode, fill }: {
  control: Control<CatalogFormValues>;
  config: CatalogConfig;
  suggestedCode?: string | null;
  fill?: boolean;
}) {
  return (
    <FormField
      control={control}
      name="code"
      rules={mergeRules(
        // Mã theo khuôn riêng của danh mục (tên lớp mầm non "Chồi A"…) giữ khuôn đó, chỉ thêm trần độ dài.
        config.codePattern ? undefined : textRules("CODE", config.codeLabel ?? "Mã", { max: config.codeMax }),
        {
          required: config.codeReadOnly
            ? "Chưa cấp được mã, xem gợi ý bên dưới"
            : config.codeAuto
              ? "Chọn đủ thông tin để được cấp mã"
              : `Vui lòng nhập ${lowerLabel(config.codeLabel ?? "Mã")}`,
          // Chỉ gõ dấu cách cũng là trống — báo ngay, không đợi máy chủ trả 422.
          validate: { blank: (v: unknown) => String(v ?? "").trim() !== "" || `Vui lòng nhập ${lowerLabel(config.codeLabel ?? "Mã")}` },
          ...(config.codePattern
            ? {
                maxLength: { value: 64, message: `${config.codeLabel ?? "Mã"} tối đa 64 ký tự` },
                pattern: config.codePattern,
              }
            : {}),
        },
      )}
      render={({ field }) => (
        <FormItem style={config.codeWidth && !fill ? { width: config.codeWidth } : undefined}>
          <FormLabel>{config.codeLabel ?? "Mã"}</FormLabel>
          {config.codeAuto && !config.codeReadOnly ? (
            <FormHint>Mã được điền sẵn, bạn vẫn sửa được. Không được trùng mã đã có.</FormHint>
          ) : null}
          <FormControl>
            <Input
              {...field}
              value={field.value ?? ""}
              placeholder={config.codeExample}
              maxLength={maxLengthOf("CODE", config.codeMax)}
              readOnly={!!config.codeReadOnly}
              tabIndex={config.codeReadOnly ? -1 : undefined}
              className={config.codeReadOnly ? "bg-muted/60 font-mono text-sm" : undefined}
            />
          </FormControl>
          {config.codeReadOnly ? (
            <FormHint>{config.codeReadOnly}</FormHint>
          ) : suggestedCode && !config.codeAuto ? (
            <FormDescription className="flex items-center gap-1">
              <Sparkles className="size-3 shrink-0" />
              Mã tự động, bạn vẫn sửa được.
            </FormDescription>
          ) : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/** Ô tên của danh mục — tách riêng như ô mã, cho form có bố cục riêng. */
export function CatalogNameField({ control, config, className }: {
  control: Control<CatalogFormValues>;
  config: CatalogConfig;
  className?: string;
}) {
  return (
    <FormField
      control={control}
      name="name"
      rules={mergeRules(textRules(config.nameRule ?? "NAME", config.nameLabel ?? "Tên", { max: config.nameMax }), {
        required: `Vui lòng nhập ${lowerLabel(config.nameLabel ?? "Tên")}`,
        validate: { blank: (v: unknown) => String(v ?? "").trim() !== "" || `Vui lòng nhập ${lowerLabel(config.nameLabel ?? "Tên")}` },
      })}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{config.nameLabel ?? "Tên"}</FormLabel>
          <FormControl>
            <Input {...field} value={field.value ?? ""} placeholder={config.nameExample} maxLength={maxLengthOf(config.nameRule ?? "NAME", config.nameMax)} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/** Công tắc "Đang hoạt động" — chỉ có ở màn sửa. */
export function CatalogActiveField({ control, className }: { control: Control<CatalogFormValues>; className?: string }) {
  return (
    <FormField
      control={control}
      name="active"
      render={({ field }) => (
        <FormItem className={className}>
          <SwitchRow checked={field.value ?? true} onCheckedChange={field.onChange} title="Đang hoạt động"
            description="Tắt thì không chọn được mục này nữa. Dữ liệu đã dùng nó vẫn giữ nguyên." />
        </FormItem>
      )}
    />
  );
}

/** Ô Ghi chú — nhãn do nhóm bọc ngoài nói, ô chỉ mang nhãn cho trình đọc màn hình. */
export function CatalogNoteField({ control, max }: { control: Control<CatalogFormValues>; /** Trần riêng (`CatalogConfig.noteMax`). */ max?: number }) {
  return (
    <FormField
      control={control}
      name="note"
      rules={textRules("NOTE", "Ghi chú", { max })}
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <Textarea {...field} value={field.value ?? ""} rows={1} className="min-h-9" placeholder="Không bắt buộc" aria-label="Ghi chú" maxLength={maxLengthOf("NOTE", max)} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
