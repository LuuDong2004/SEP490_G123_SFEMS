"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { useLiquid } from "@/shared/hooks/use-liquid";
import { TAB_IDLE, TAB_ITEM, TAB_STRIP } from "@/shared/lib/tab-style";
import { cn } from "@/shared/lib/utils";

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  );
}

/**
 * Dải tab cùng kiểu thanh tab phân hệ và nút chọn chế độ xem: khung nhạt bo mềm, tab đang chọn là MỘT viên màu chính bo
 * tròn trượt kiểu chất lỏng sang tab mới (`useLiquid`). Radix tự đổi `data-state` của tab — dải tab theo dõi thuộc
 * tính đó để biết lúc nào cho viên màu chạy.
 */
function TabsList({
  className,
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  const [tick, setTick] = React.useState(0);
  const [boxRef, indRef] = useLiquid<HTMLDivElement>(tick, { selector: '[role="tab"][data-state="active"]' });
  React.useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const mo = new MutationObserver(() => setTick((t) => t + 1));
    mo.observe(box, { subtree: true, attributes: true, attributeFilter: ["data-state"] });
    return () => mo.disconnect();
  }, [boxRef]);
  return (
    <TabsPrimitive.List
      ref={boxRef}
      data-slot="tabs-list"
      className={cn(
        TAB_STRIP, "text-muted-foreground overflow-x-auto [scrollbar-width:none]",
        className
      )}
      {...props}
    >
      <span ref={indRef} aria-hidden
        className="pill-on pointer-events-none absolute rounded-full opacity-0" />
      {children}
    </TabsPrimitive.List>
  );
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "group", TAB_ITEM, TAB_IDLE,
        // Chữ sáng lên trễ một nhịp, sau khi viên màu trượt tới.
        "data-[state=active]:pill-on-text data-[state=active]:delay-75 data-[state=active]:hover:bg-transparent",
        "disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
