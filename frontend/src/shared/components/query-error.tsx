import { useEffect, useState } from "react";
import { AlertCircle, RotateCw } from "lucide-react";

import { errorMessage } from "@/shared/lib/api-error";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";

/**
 * Chỗ một truy vấn lỗi hiện ra, thay cho khung xương.
 *
 * Màn chờ `data` để vẽ mà không đọc `isError` thì khi máy chủ trả 500 / 403 /
 * hết thời gian, `data` mãi là `undefined` và khung xương nhấp nháy vô thời hạn.
 * Truy vấn gọi thẳng `kyInstance` qua `useQuery` cũng không qua bộ báo lỗi của
 * Refine, nên không có toast nào nói chuyện gì đã xảy ra.
 */
export function QueryError({
  error,
  onRetry,
  retrying,
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}) {
  const [message, setMessage] = useState<string>();
  useEffect(() => {
    let alive = true;
    void errorMessage(error).then((m) => alive && setMessage(m));
    return () => {
      alive = false;
    };
  }, [error]);

  return (
    <div role="alert" className={cn("flex flex-col items-center gap-3 rounded-lg border px-4 py-10 text-center text-sm", className)}>
      <AlertCircle className="text-destructive size-8" />
      <div className="space-y-1">
        <p className="font-medium">Không tải được dữ liệu</p>
        {message ? <p className="text-muted-foreground">{message}</p> : null}
      </div>
      {onRetry ? (
        <Button type="button" variant="outline" size="sm" disabled={retrying} onClick={onRetry}>
          <RotateCw className={cn(retrying && "animate-spin")} />
          Thử lại
        </Button>
      ) : null}
    </div>
  );
}
