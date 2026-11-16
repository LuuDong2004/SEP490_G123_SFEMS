import { GridCellKind, type ProvideEditorComponent, type TextCell } from "@glideapps/glide-data-grid";
import { useRef, useState } from "react";

import { fold } from "@/shared/components/data-table/icon-filter";
import { cn } from "@/shared/lib/utils";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/shared/ui/command";

const EMPTY = "__empty__";

/**
 * Ô chọn trong lưới nhập dữ liệu: cột có danh mục (loại phòng, khối, đơn vị tính, tình trạng, nguồn…) hoặc mã
 * tham chiếu (cơ sở, khối nhà, phòng, cán bộ) mở danh sách có ô tìm thay cho gõ tự do. Gõ chữ khi ô đang chọn thì chữ đó
 * thành từ tìm. Enter / bấm chọn ghi giá trị; Esc thôi, giữ giá trị cũ.
 */
export function choiceEditor(options: string[]): ProvideEditorComponent<TextCell> {
  return function ChoiceEditor({ value, initialValue, onFinishedEditing, target }) {
    const [term, setTerm] = useState(initialValue ?? "");
    const rootRef = useRef<HTMLDivElement>(null);
    const current = value.data ?? "";
    const pick = (v: string) => onFinishedEditing({ ...value, kind: GridCellKind.Text, data: v, displayData: v });
    return (
      <Command
        ref={rootRef}
        className="bg-popover text-popover-foreground shadow-e3 rounded-lg border"
        style={{ width: Math.max(target.width, 240) }}
        // Mở ra đứng ở giá trị đang có, không ở mục đầu.
        defaultValue={term ? undefined : options.includes(current) ? current : undefined}
        filter={(item, search) => (item === EMPTY || fold(item).includes(fold(search.trim())) ? 1 : 0)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            onFinishedEditing(undefined);
          }
        }}
      >
        <CommandInput autoFocus value={term} onValueChange={setTerm} placeholder="Tìm…" />
        <CommandList className="max-h-72">
          <CommandEmpty>Không có trong danh mục.</CommandEmpty>
          {/* Mọi mục trong CommandGroup: Command sắp lại DOM khi tìm, gặp thẻ lạ là lỗi appendChild. */}
          <CommandGroup>
            {current ? (
              <CommandItem value={EMPTY} onSelect={() => pick("")}>
                <span className="text-muted-foreground">Để trống</span>
              </CommandItem>
            ) : null}
            {options.map((o) => (
              <CommandItem key={o} value={o} onSelect={() => pick(o)}>
                <span className={cn("min-w-0 truncate", o === current && "text-primary font-medium")} title={o}>{o}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    );
  };
}
