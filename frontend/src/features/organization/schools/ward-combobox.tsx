import { useCan, useList } from "@refinedev/core";
import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";

import { Button } from "@/shared/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shared/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { cn } from "@/shared/lib/utils";

/**
 * Chọn phường/xã từ danh mục (168 phường/xã TP.HCM theo địa giới 2025), có ô
 * gõ để lọc.
 *
 * <p>Giá trị lưu là **id**, không còn là tên. Trước đây lưu tên, và đó là thứ
 * làm hỏng đúng yêu cầu 3.5.2 và 3.5.8 — tổng hợp số liệu theo địa bàn: hai
 * cách gõ cùng một phường thành hai nhóm khi gộp, nên báo cáo vẫn ra số mà ra
 * nhầm. Id cũng là thứ phân quyền so sánh được khi UBND chỉ được thấy trường
 * trên địa bàn mình.
 *
 * <p>`fallbackLabel` là chữ người dùng từng gõ tay trước khi có danh mục
 * (`wardText`). Hiện nó trên nút khi chưa ghép được, để mở form sửa không làm
 * người dùng tưởng dữ liệu đã mất.
 */
export function WardCombobox({
  value,
  onChange,
  fallbackLabel,
}: {
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  fallbackLabel?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const mayRead = useCan({ resource: "wards", action: "list" }).data?.can ?? false;
  const { result } = useList<{ id: number; code: string; name: string }>({
    resource: "wards",
    pagination: { pageSize: 500 },
    sorters: [{ field: "name", order: "asc" }],
    queryOptions: { enabled: mayRead },
  });
  const wards = result?.data ?? [];
  const selected = wards.find((w) => w.id === value);
  // Nhãn hiện tại: tên trong danh mục nếu ghép được, không thì chữ gõ tay cũ.
  // Danh mục về sau lần đọc đầu, nên trong lúc chờ vẫn phải có gì đó để hiện.
  const label = selected?.name ?? (value == null ? fallbackLabel : null);

  return (
    // `modal`: nằm trong hộp thoại, popover phải tự giữ cuộn — không thì lớp
    // khoá cuộn của hộp thoại nuốt mất bánh xe chuột trên danh sách.
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", !label && "text-muted-foreground")}
        >
          <span className="truncate">
            {label ?? "Chọn phường/xã"}
            {value == null && fallbackLabel ? (
              <span className="text-warning-text ms-1 text-xs">(chưa chuẩn hoá)</span>
            ) : null}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Gõ tên phường/xã..." />
          <CommandList className="max-h-72">
            <CommandEmpty>Không tìm thấy phường/xã.</CommandEmpty>
            {wards.map((w) => (
              <CommandItem
                key={w.id}
                value={w.name}
                onSelect={() => {
                  onChange(w.id);
                  setOpen(false);
                }}
              >
                <Check className={cn("size-4", value === w.id ? "opacity-100" : "opacity-0")} />
                {w.name}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
