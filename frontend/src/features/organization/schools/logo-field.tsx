import { ImageUp, School, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/shared/ui/button";
import { kyInstance } from "@/shared/api/data";
import { LogoCropper } from "@/features/organization/schools/logo-cropper";

/**
 * Giá trị trong form: `undefined` = không đổi, `null` = xoá logo, chuỗi = data
 * URL của ảnh mới (đã thu nhỏ). Ảnh gửi riêng qua `/api/schools/{id}/logo` SAU
 * khi lưu trường — xem {@link saveSchoolLogo}.
 */
export type LogoValue = string | null | undefined;

/** Ghi logo sau khi trường đã lưu (cần id). Không đổi thì không gọi gì. */
export async function saveSchoolLogo(schoolId: number, logo: LogoValue) {
  if (logo === undefined) return;
  // Đường dẫn TƯƠNG ĐỐI: kyInstance đã gắn sẵn tiền tố API — ghép thêm API_URL là gọi /api/http://….
  const url = `schools/${schoolId}/logo`;
  if (logo === null) {
    await kyInstance.delete(url);
  } else {
    await kyInstance.put(url, { json: { dataUrl: logo } });
  }
}

export function LogoField({
  schoolId,
  value,
  onChange,
}: {
  schoolId?: number;
  value: LogoValue;
  onChange: (value: LogoValue) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [existing, setExisting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cropping, setCropping] = useState<File | null>(null);

  // Logo đang lưu (màn sửa): tải bằng ky để có kèm token, rồi hiện qua blob URL.
  useEffect(() => {
    if (!schoolId) return;
    let url: string | null = null;
    let cancelled = false;
    kyInstance
      .get(`schools/${schoolId}/logo`, { throwHttpErrors: false })
      .then(async (res) => {
        if (!res.ok || res.status === 204 || cancelled) return;
        url = URL.createObjectURL(await res.blob());
        setExisting(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [schoolId]);

  const shown = value === undefined ? existing : value;

  return (
    <div className="flex items-center gap-4">
      <div className="bg-muted/50 flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border">
        {shown ? (
          <img src={shown} alt="Logo trường" className="size-full object-cover" />
        ) : (
          <School className="text-muted-foreground size-8" />
        )}
      </div>
      <div className="space-y-2">
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()}>
            <ImageUp />
            {shown ? "Đổi ảnh" : "Chọn ảnh"}
          </Button>
          {shown ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => onChange(null)}
            >
              <Trash2 />
              Xoá
            </Button>
          ) : null}
        </div>
        <p className="text-muted-foreground text-xs">PNG, JPEG hoặc WebP.</p>
        {error ? <p className="text-destructive text-xs">{error}</p> : null}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
            setError("Chỉ nhận ảnh PNG, JPEG hoặc WebP");
            return;
          }
          setError(null);
          setCropping(file);
        }}
      />
      <LogoCropper
        file={cropping}
        onCancel={() => setCropping(null)}
        onDone={(dataUrl) => {
          setCropping(null);
          onChange(dataUrl);
        }}
      />
    </div>
  );
}
