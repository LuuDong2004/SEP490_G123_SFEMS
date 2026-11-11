import type { Control } from "react-hook-form";

import { FormControl, FormField, FormItem, FormLabel } from "@/shared/ui/form";
import { Switch } from "@/shared/ui/switch";
import { cn } from "@/shared/lib/utils";
import type { CatalogFormValues } from "@/features/catalogs/catalog-config";

/** Một ô bật/tắt có nhãn bên phải, cho các trường đúng/sai của danh mục (đang dùng, là kho…). */
export function SwitchField({
  control,
  name,
  label,
  description,
  className,
}: {
  control: Control<CatalogFormValues>;
  name: string;
  label: string;
  /** Dòng giải thích nhỏ dưới nhãn. */
  description?: string;
  className?: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={cn("flex items-center gap-3", className)}>
          <FormControl>
            <Switch checked={field.value === true} onCheckedChange={field.onChange} />
          </FormControl>
          <div className="grid gap-0.5">
            <FormLabel className="font-normal">{label}</FormLabel>
            {description ? <p className="text-muted-foreground text-xs leading-snug">{description}</p> : null}
          </div>
        </FormItem>
      )}
    />
  );
}
