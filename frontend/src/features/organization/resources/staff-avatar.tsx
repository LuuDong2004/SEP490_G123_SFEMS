import { useCan, useNotification } from "@refinedev/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Crop, ImagePlus, Trash2, UserRound } from "lucide-react";
import { useRef, useState } from "react";

import { kyInstance } from "@/shared/api/data";
import { ConfirmContent } from "@/shared/components/confirm/confirm-content";
import { errorMessage } from "@/shared/lib/api-error";
import { cn } from "@/shared/lib/utils";
import { AlertDialog } from "@/shared/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu";
import type { AttachmentInfo } from "@/domains/voucher/types";
import { PhotoPickerDialog, cropStyle, parseCrop, useImageUrl } from "@/features/organization/resources/equipment-photo";

/**
 * Luật ảnh đại diện — cùng số với máy chủ (`StaffAttachmentAccess`): JPG / PNG / WebP, tối đa 2 MB. Thêm ở đây
 * (máy chủ không giải mã ảnh): cạnh ngắn ít nhất 128 px cho ảnh khỏi vỡ, cạnh dài tối đa 8000 px.
 */
const AVATAR_TYPES: Record<string, string> = { "image/jpeg": "JPG", "image/png": "PNG", "image/webp": "WebP" };
const AVATAR_EXT = /\.(jpe?g|png|webp)$/i;
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_MIN_SIDE = 128;
const AVATAR_MAX_SIDE = 8000;

/** Lỗi của tệp ảnh đại diện, `null` khi hợp lệ. Đọc kích thước thật bằng cách giải mã ảnh trong trình duyệt. */
async function avatarError(file: File): Promise<string | null> {
  if (!AVATAR_TYPES[file.type] || !AVATAR_EXT.test(file.name)) return "Chỉ nhận ảnh JPG, PNG hoặc WebP";
  if (file.size === 0) return "Tệp rỗng";
  if (file.size > AVATAR_MAX_BYTES) return `Ảnh tối đa 2 MB (tệp này ${(file.size / 1024 / 1024).toFixed(1)} MB)`;
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    bitmap.close();
    if (Math.min(width, height) < AVATAR_MIN_SIDE) return `Ảnh quá nhỏ (${width}×${height}) — cần ít nhất ${AVATAR_MIN_SIDE}×${AVATAR_MIN_SIDE} px`;
    if (Math.max(width, height) > AVATAR_MAX_SIDE) return `Ảnh quá lớn (${width}×${height}) — tối đa ${AVATAR_MAX_SIDE} px mỗi cạnh`;
  } catch {
    return "Không đọc được ảnh — tệp có thể bị hỏng hoặc đổi đuôi";
  }
  return null;
}

/** Hai chữ đầu của hai tiếng cuối họ tên — "Đỗ Quốc Tâm" → "QT". */
export function initialsOf(name?: string | null) {
  const words = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  return words.slice(-2).map((w) => w[0]).join("").toUpperCase();
}

/**
 * Ảnh đại diện TRÒN của cán bộ (trưởng nhóm 13/11/2026: to, nổi bật, tải được ảnh — kiểu trang cá nhân). Ảnh là tệp
 * đính kèm dạng ảnh của hồ sơ, đánh dấu đại diện + vùng cắt vuông, như ảnh thiết bị. Chưa có ảnh thì hiện chữ viết
 * tắt tên. Người sửa được hồ sơ thấy nút máy ảnh: tải ảnh mới (kiểm loại, dung lượng, kích thước trước khi gửi),
 * căn lại khung, gỡ ảnh.
 */
export function StaffAvatar({ recordId, name, className }: { recordId?: number; name?: string | null; className?: string }) {
  const { open: notify } = useNotification();
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const mayWrite = useCan({ resource: "staff", action: "edit" }).data?.can ?? false;
  const key = ["attachments", "staff", recordId];
  const { data } = useQuery({
    queryKey: key,
    enabled: recordId != null,
    queryFn: () => kyInstance.get("attachments", { searchParams: { resource: "staff", recordId: String(recordId) } }).json<AttachmentInfo[]>(),
  });
  const images = (Array.isArray(data) ? data : []).filter((f) => f.contentType?.startsWith("image/"));
  const cover = images.find((f) => f.cover) ?? images[0];
  const url = useImageUrl(cover?.id);
  const [picker, setPicker] = useState<File[] | null>(null);
  const [removing, setRemoving] = useState(false);
  const [busy, setBusy] = useState(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });
  const editable = mayWrite && recordId != null;
  const initials = initialsOf(name);

  const choose = async (file: File | undefined) => {
    if (!file) return;
    const problem = await avatarError(file);
    if (problem) {
      notify?.({ type: "error", message: problem, description: file.name });
      return;
    }
    setPicker([file]);
  };
  /** Sau khi đặt ảnh mới: gỡ các ảnh cũ — mỗi cán bộ một ảnh, không thành kho ảnh. */
  const dropOld = async () => {
    try {
      const fresh = await kyInstance.get("attachments", { searchParams: { resource: "staff", recordId: String(recordId) } }).json<AttachmentInfo[]>();
      for (const f of fresh) if (!f.cover && f.contentType?.startsWith("image/")) await kyInstance.delete(`attachments/${f.id}`);
    } catch {
      // Ảnh cũ còn sót không hại gì: ảnh hiện vẫn là ảnh đại diện mới.
    } finally {
      void refresh();
    }
  };
  const remove = async () => {
    setBusy(true);
    try {
      // Gỡ hẳn mọi ảnh của hồ sơ: cán bộ chỉ có ảnh đại diện, ảnh cũ không còn dùng vào đâu.
      for (const f of images) await kyInstance.delete(`attachments/${f.id}`);
      notify?.({ type: "success", message: "Đã gỡ ảnh đại diện" });
      setRemoving(false);
    } catch (error) {
      notify?.({ type: "error", message: await errorMessage(error), description: "Không gỡ được ảnh" });
    } finally {
      setBusy(false);
      void refresh();
    }
  };

  return (
    <div className={cn("relative shrink-0", className)}>
      <span className="bg-info-subtle text-info-text ring-background shadow-e2 flex size-24 items-center justify-center overflow-hidden rounded-full text-3xl font-semibold ring-4">
        {cover && url ? (
          <img src={url} alt={name ?? "Ảnh đại diện"} className="size-full" draggable={false}
            style={cover.cover ? cropStyle(parseCrop(cover.coverCrop)) : { objectFit: "cover" }} />
        ) : initials ? initials : <UserRound className="size-11" />}
      </span>
      {editable ? (
        <>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
            onChange={(e) => { void choose(e.target.files?.[0]); e.target.value = ""; }} />
          {cover ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label="Đổi ảnh đại diện" title="Đổi ảnh đại diện"
                  className="bg-muted hover:bg-accent text-foreground ring-background absolute right-0 bottom-0 flex size-8 items-center justify-center rounded-full ring-2 transition-colors">
                  <Camera className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onSelect={() => input.current?.click()}><ImagePlus />Tải ảnh mới</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setPicker([])}><Crop />Căn lại khung</DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onSelect={() => setRemoving(true)}><Trash2 />Gỡ ảnh</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <button type="button" aria-label="Tải ảnh đại diện" title="Tải ảnh đại diện (JPG, PNG, WebP — tối đa 2 MB)"
              onClick={() => input.current?.click()}
              className="bg-muted hover:bg-accent text-foreground ring-background absolute right-0 bottom-0 flex size-8 items-center justify-center rounded-full ring-2 transition-colors">
              <Camera className="size-4" />
            </button>
          )}
          {picker ? (
            // Ảnh mới: hộp chỉ có ảnh vừa chọn (không giữ đại diện cũ); căn lại: chỉ ảnh đang dùng.
            <PhotoPickerDialog open onOpenChange={(o) => !o && setPicker(null)} resource="staff" recordId={recordId!}
              existing={picker.length ? [] : cover ? [cover] : []} files={picker}
              onDone={() => void (picker.length ? dropOld() : refresh())} />
          ) : null}
          <AlertDialog open={removing} onOpenChange={(o) => !busy && setRemoving(o)}>
            {removing ? (
              <ConfirmContent tone="danger" title="Gỡ ảnh đại diện?" description="Hồ sơ sẽ hiện chữ viết tắt tên thay cho ảnh."
                cancelLabel="Giữ ảnh" confirmLabel="Gỡ ảnh" destructive busy={busy} keepOpen onConfirm={() => void remove()} />
            ) : null}
          </AlertDialog>
        </>
      ) : null}
    </div>
  );
}
