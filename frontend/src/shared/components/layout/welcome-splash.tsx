import { useGetIdentity } from "@refinedev/core";
import { useIsFetching } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { cn } from "@/shared/lib/utils";

const KEY = "sfems.welcomed";
/** Đủ lâu để đọc trọn lời chào, kể cả khi dữ liệu về rất nhanh. */
const MIN_MS = 2300;
/** Máy chủ chậm cũng không giữ người dùng ở màn chào quá lâu. */
const MAX_MS = 5500;
const EXIT_MS = 650;

function firstVisit() {
  try {
    return window.sessionStorage.getItem(KEY) !== "1";
  } catch {
    return false;
  }
}

/**
 * Màn chào lúc vừa vào app (kiểu "hello" khi bật máy Apple): "Xin chào" hiện dần từng chữ, rồi tên người dùng —
 * trong lúc đó màn Tổng hợp tải dữ liệu phía sau. Có dữ liệu (không còn truy vấn nào đang chạy) và đã đủ thời gian
 * đọc thì màn chào mờ đi, lộ ra màn đã dựng xong, thay vì vài giây nhìn các ô "Đang tải…".
 *
 * Một lần mỗi phiên (sessionStorage — đăng xuất xoá nó, nên lần đăng nhập sau lại chào).
 */
export function WelcomeSplash() {
  const [phase, setPhase] = useState<"in" | "out" | "gone">(() => (firstVisit() ? "in" : "gone"));
  const [ready, setReady] = useState(false);
  const fetching = useIsFetching();
  const { data: user } = useGetIdentity<{ fullName?: string; username?: string }>();
  const name = (user?.fullName || user?.username || "").replace(/\s*\(demo\)\s*$/i, "");

  useEffect(() => {
    if (phase === "gone") return;
    try {
      window.sessionStorage.setItem(KEY, "1");
    } catch {
      /* không lưu được thì lần sau chào lại — không sao */
    }
    const min = setTimeout(() => setReady(true), MIN_MS);
    const max = setTimeout(() => setPhase((p) => (p === "in" ? "out" : p)), MAX_MS);
    return () => {
      clearTimeout(min);
      clearTimeout(max);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase === "in" && ready && fetching === 0) setPhase("out");
  }, [phase, ready, fetching]);

  useEffect(() => {
    if (phase !== "out") return;
    const t = setTimeout(() => setPhase("gone"), EXIT_MS);
    return () => clearTimeout(t);
  }, [phase]);

  if (phase === "gone") return null;
  const words = ["Xin", "chào"];
  return (
    <div role="status" aria-live="polite" aria-label={`Xin chào ${name}`}
      className={cn(
        "bg-background fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 px-6 pb-[12vh] text-center",
        "transition-[opacity,filter,scale] duration-[650ms] ease-[cubic-bezier(.4,0,.2,1)]",
        phase === "out" && "pointer-events-none scale-[1.04] opacity-0 blur-sm",
      )}>
      {/* Quầng màu chính mờ phía sau. */}
      <div aria-hidden className="bg-brand-gradient pointer-events-none absolute top-1/2 left-1/2 size-[48rem] -translate-1/2 rounded-full opacity-[0.13] blur-[140px]" />

      {/* Logo Sở GD&ĐT TP.HCM — hiện trước, chữ chào theo sau. */}
      <div className="animate-hello-logo relative mb-4 flex flex-col items-center gap-5">
        <div className="relative">
          {/* Vòng sáng lan nhẹ quanh logo. */}
          <span aria-hidden className="bg-primary/25 absolute -inset-3 rounded-full blur-xl" />
          <span aria-hidden className="ring-primary/15 absolute -inset-2.5 rounded-full ring-1" />
          <img src="/logo-so-gddt-hcm.png" alt="Sở GD&ĐT TP.HCM"
            className="relative size-32 rounded-full bg-white object-contain p-1.5 shadow-[0_18px_40px_-12px_color-mix(in_srgb,var(--primary)_45%,transparent)] sm:size-40" />
        </div>
        <div className="flex items-center gap-3">
          <span aria-hidden className="to-primary/50 h-px w-10 bg-gradient-to-r from-transparent sm:w-16" />
          <span className="text-primary text-sm font-semibold tracking-[0.2em] uppercase sm:text-base">
            Sở Giáo dục và Đào tạo TP. Hồ Chí Minh
          </span>
          <span aria-hidden className="to-primary/50 h-px w-10 bg-gradient-to-l from-transparent sm:w-16" />
        </div>
      </div>

      <h1 className="relative text-7xl leading-none font-bold tracking-tight sm:text-[8.5rem]">
        {words.map((w, wi) => (
          <span key={w} className="inline-block whitespace-nowrap">
            {[...w].map((ch, ci) => (
              <span key={ci}
                className="bg-brand-gradient animate-hello-in inline-block bg-clip-text pb-[0.14em] text-transparent"
                style={{ animationDelay: `${300 + (wi * 3 + ci) * 70}ms` }}>
                {ch}
              </span>
            ))}
            {wi < words.length - 1 ? " " : null}
          </span>
        ))}
      </h1>
      <p className={cn("text-foreground/80 animate-hello-sub relative text-2xl font-semibold sm:text-3xl", !name && "invisible")}>
        {name || " "}
      </p>
    </div>
  );
}
