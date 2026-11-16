"use client";

import { useState } from "react";
import { Link } from "react-router";

import { useLogin, useRefineOptions, useTranslate } from "@refinedev/core";
import {
  ArrowRight,
  FlaskConical,
  LockKeyhole,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/shared/ui/sheet";
import { InputPassword } from "@/shared/components/form/input-password";
import { cn } from "@/shared/lib/utils";
import {
  rememberedSchool,
  SignInSchoolPicker,
  type SignInSchool,
} from "@/shared/components/form/sign-in-school";

/**
 * The sign-in screen.
 *
 * Username *or* email, because the API accepts either and nobody should have to
 * remember which one this system keyed on.
 *
 * There is no self-registration and no password-reset link: accounts are
 * created by an administrator on the Users screen, and a forgotten password is
 * reset there too. Offering either link would send people to a page that cannot
 * help them.
 *
 * Một thẻ ở giữa trên nền toàn màn: gradient của bộ màu đang chọn, cảnh trường học vẽ
 * bằng SVG (hoặc ảnh thật ở `public/login-bg.jpg`) — màn duy nhất người dùng thấy trước
 * khi vào bên trong, nên nó phải tự nói hệ thống của ai. Khung vào nhanh theo vai nằm
 * trong một ngăn bên, mở bằng nút dưới thẻ, để thẻ chỉ còn việc đăng nhập.
 */
/**
 * ĐĂNG NHẬP NHANH THEO VAI TRÒ — phần dành cho môi trường thử nghiệm.
 *
 * <p>Chỉ có khi chạy dev hoặc bản build mang `VITE_DEMO_LOGIN=true` (dev server,
 * UAT, và qltb_main khi còn thử nghiệm — `DEMO_LOGIN` trong `deploy/docker-compose.yml`, ảnh mặc định tắt). Cờ được
 * thay thẳng lúc build, nên ở bản production `DEMO_LOGIN` là `false` hằng và các
 * chuỗi mật khẩu dưới đây bị loại khỏi bundle — giữ chúng NẰM TRONG nhánh
 * `DEMO_LOGIN ? … : …`, đưa ra ngoài là chúng quay lại bundle. Ngày chạy thật, máy chủ
 * qltb_main còn tự khoá các tài khoản này (`DemoAccountGuard`, `LOCK_DEMO_ACCOUNTS=true`).
 *
 * <p>Tài khoản: `admin` từ `005-seed-security.sql`, phần còn lại từ
 * `056-seed-demo-operations.sql` (mật khẩu chung `Demo@123`). Mỗi cấp đều có
 * đủ CẶP lãnh đạo — chuyên viên, vì đó là điều kiện để bước duyệt có nghĩa:
 * người lập phiếu và người duyệt phiếu không bao giờ là một.
 */
const DEMO_LOGIN =
  import.meta.env.DEV || import.meta.env.VITE_DEMO_LOGIN === "true";

type DemoAccount = {
  username: string;
  password: string;
  /** Việc người này làm, không phải mã vai trò — người kiểm thử nghĩ theo việc. */
  role: string;
};

/**
 * Một hàng của khung: nhãn bên trái (tên trường), các vai của nó bên phải.
 * Cấp Sở và UBND chỉ có một hàng không nhãn.
 */
type DemoRow = { where?: string; accounts: DemoAccount[] };

const DEMO_TIERS: {
  tier: string;
  hint: string;
  tone: string;
  dot: string;
  rows: DemoRow[];
}[] = !DEMO_LOGIN
  ? []
  : [
      {
        // Cùng bảng màu với màn Tổng quan (`explorer/body-grid.tsx`): Sở đỏ, UBND
        // xanh, trường vàng. Màu đã mang nghĩa ở nơi khác thì ở đây phải mang đúng
        // nghĩa đó, nếu không nó chỉ là trang trí.
        tier: "Sở GD&ĐT",
        hint: "đọc toàn thành phố",
        tone: "text-destructive",
        dot: "bg-destructive",
        rows: [
          {
            accounts: [
              {
                username: "so.lanhdao",
                password: "Demo@123",
                role: "Lãnh đạo",
              },
              {
                username: "so.chuyenvien",
                password: "Demo@123",
                role: "Chuyên viên",
              },
            ],
          },
        ],
      },
      {
        // Xếp theo TRƯỜNG chứ không theo vai: đổi vai trong cùng một trường là thao
        // tác lặp nhiều nhất khi thử luồng duyệt, nên hai nút của một trường phải
        // nằm cạnh nhau trên một hàng.
        tier: "Trường",
        hint: "cán bộ lập · lãnh đạo duyệt",
        tone: "text-gold-600",
        dot: "bg-gold-500",
        rows: [
          {
            where: "THCS Bình An",
            accounts: [
              { username: "thcs.canbo", password: "Demo@123", role: "Cán bộ" },
              {
                username: "thcs.hieutruong",
                password: "Demo@123",
                role: "Hiệu trưởng",
              },
            ],
          },
          {
            where: "THCS Đặng Tấn Tài",
            accounts: [
              { username: "thcs2.canbo", password: "Demo@123", role: "Cán bộ" },
              {
                username: "thcs2.hieutruong",
                password: "Demo@123",
                role: "Hiệu trưởng",
              },
            ],
          },
          {
            where: "THPT An Lạc",
            accounts: [
              { username: "thpt.canbo", password: "Demo@123", role: "Cán bộ" },
              {
                username: "thpt.hieutruong",
                password: "Demo@123",
                role: "Hiệu trưởng",
              },
            ],
          },
        ],
      },
    ];

/** Quản trị đứng riêng, cuối khung: nó không thuộc cây Sở — UBND — trường. */
const DEMO_ADMIN: DemoAccount | null = DEMO_LOGIN
  ? { username: "admin", password: "Admin@123", role: "Quản trị viên hệ thống" }
  : null;

// Điền sẵn tài khoản dùng nhiều nhất khi thử nghiệp vụ: cán bộ thiết bị THCS Bình An (vai A8).
const DEV_CREDENTIALS = DEMO_LOGIN
  ? { username: "thcs.canbo", password: "Demo@123" }
  : { username: "", password: "" };

/**
 * Một màn đăng nhập chung cho mọi loại tài khoản (Sở / UBND / trường / quản trị — docs/kien-truc/02): đăng nhập xong
 * giao diện tự vào cổng của loại. Quản trị viên vẫn qua kiểm IP và 2 lớp ở máy chủ.
 */
export const SignInForm = () => {
  const initial = DEV_CREDENTIALS;
  const [username, setUsername] = useState(initial.username);
  // Người trong trường: chọn trường, chỉ gõ phần sau của tài khoản (`<mã trường>.<mã cán bộ>`).
  const [school, setSchool] = useState<SignInSchool | null>(() => rememberedSchool());
  const [password, setPassword] = useState(initial.password);
  const [code, setCode] = useState("");
  const [needCode, setNeedCode] = useState(false);
  // Câu máy chủ trả khi cần mã: mã ứng dụng hay mã vừa gửi tới email nào.
  const [codeHint, setCodeHint] = useState<string | null>(null);

  const { title } = useRefineOptions();
  const { mutate: login, isPending } = useLogin();
  const t = useTranslate();

  const handleSignIn = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Đã chọn trường: ghép tiền tố — trừ khi người dùng gõ đủ tên (có dấu chấm) hoặc email.
    const typed = username.trim();
    const full =
      school && !typed.includes(".") && !typed.includes("@")
        ? `${school.prefix}.${typed}`
        : typed;
    login(
      { username: full, password, code: needCode ? code : undefined },
      {
        onSuccess: (data) => {
          if (!data.success && data.error?.name === "MfaRequired") {
            setNeedCode(true);
            setCodeHint(data.error.message ?? null);
          }
        },
      }
    );
  };

  /** Gửi lại mã qua email: đăng nhập lại KHÔNG kèm mã — máy chủ gửi mã mới (cách nhau tối thiểu 60 giây). */
  const resendCode = () => {
    const typed = username.trim();
    const full =
      school && !typed.includes(".") && !typed.includes("@")
        ? `${school.prefix}.${typed}`
        : typed;
    setCode("");
    login(
      { username: full, password },
      {
        onSuccess: (data) => {
          if (!data.success && data.error?.name === "MfaRequired")
            setCodeHint(data.error.message ?? null);
        },
      }
    );
  };

  /**
   * Bấm một vai là vào luôn, không phải bấm thêm "Đăng nhập" — đổi vai để xem
   * bước duyệt là việc lặp lại hàng chục lần trong một buổi thử.
   *
   * <p>Gửi thẳng giá trị của tài khoản thay vì đọc state: `setUsername` chưa có
   * hiệu lực trong chính lần render này, nên đọc state sẽ đăng nhập bằng vai
   * TRƯỚC ĐÓ. Hai lời gọi `set*` chỉ để ô nhập hiện đúng người vừa chọn.
   */
  const signInAs = (account: DemoAccount) => {
    setUsername(account.username);
    setPassword(account.password);
    setCode("");
    setNeedCode(false);
    setCodeHint(null);
    login({ username: account.username, password: account.password });
  };

  return (
    <div
      className="relative isolate flex min-h-svh flex-col overflow-hidden text-white"
      style={{
        backgroundImage: "var(--gradient-sidebar)",
        backgroundColor: "var(--sidebar)",
      }}
    >
      {/* Nền trơn theo bộ màu — không cảnh vẽ, quầng sáng hay lưới chấm (theo trưởng nhóm). */}
      <header className="flex items-center gap-3 px-5 py-5 sm:px-10 sm:py-7 lg:hidden">
        {title.icon ? (
          <div className="shadow-e2 flex size-11 items-center justify-center overflow-hidden rounded-xl bg-white p-1 [&>img]:size-full">
            {title.icon}
          </div>
        ) : null}
        <div className="leading-tight">
          <p className="text-sm font-semibold sm:text-[0.9375rem]">
            Sở Giáo dục và Đào tạo
          </p>
          <p className="text-xs text-white/70">Thành phố Hồ Chí Minh</p>
        </div>
      </header>

      {/* Màn rộng: hai nửa — trái là đơn vị và tên hệ thống (không câu giới thiệu, theo trưởng nhóm), phải là khung
          đăng nhập; trải gần hết bề ngang để không thừa hai dải trống. Màn hẹp: chỉ khung đăng nhập dưới đầu trang. */}
      <main className="grid w-full flex-1 items-center gap-12 px-4 pb-10 lg:grid-cols-[minmax(0,1fr)_28rem] lg:gap-16 lg:px-[7vw] lg:py-12">
        <section className="hidden space-y-12 lg:block lg:-mt-24">
          <div className="flex items-center gap-5">
            {title.icon ? (
              <div className="flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white p-1.5 shadow-[0_12px_30px_-10px_rgb(0_0_0/.5)] ring-4 ring-white/15 [&>img]:size-full">
                {title.icon}
              </div>
            ) : null}
            <div className="leading-tight">
              <p className="text-2xl font-semibold xl:text-3xl">Sở Giáo dục và Đào tạo</p>
              <p className="mt-1 text-lg text-white/70 xl:text-xl">Thành phố Hồ Chí Minh</p>
            </div>
          </div>
          <h2 className="max-w-[16ch] text-5xl leading-[1.08] font-bold tracking-tight xl:text-7xl">
            Hệ thống quản lý cơ sở vật chất và thiết bị trường học
          </h2>
        </section>

        <div className="mx-auto w-full max-w-[28rem]">
          {/* Thẻ gọn, căn trái, góc vừa: tên hệ thống một lần dưới tiêu đề, không dòng nhãn nhỏ + câu nhắc thừa. */}
          <div className="bg-card text-card-foreground space-y-6 rounded-3xl p-7 shadow-[0_30px_70px_-20px_rgb(0_0_0/.55)] sm:p-9">
            <div className="space-y-1">
              <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                Đăng nhập
              </h1>
              <p className="text-muted-foreground text-sm">{title.text}</p>
            </div>

            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label>Đơn vị</Label>
                <SignInSchoolPicker value={school} onChange={setSchool} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">
                  {school
                    ? "Tài khoản"
                    : t(
                        "pages.login.fields.usernameOrEmail",
                        "Username or email"
                      )}
                </Label>
                <div className="relative flex">
                  {/* Tiền tố của trường đã chọn đứng sẵn trước ô — người dùng chỉ gõ mã của mình (vd. cb0001). */}
                  {school ? (
                    <span
                      className="bg-muted text-muted-foreground flex h-11 max-w-[55%] shrink-0 items-center truncate rounded-s-full border border-e-0 ps-4 pe-2 text-sm"
                      title={`${school.prefix}.`}
                    >
                      {school.prefix}.
                    </span>
                  ) : null}
                  <UserRound
                    className={cn(
                      "text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 z-10 size-4 -translate-y-1/2",
                      school && "hidden"
                    )}
                  />
                  <Input
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    autoFocus
                    required
                    className={cn("h-11 rounded-full", school ? "rounded-s-none" : "pl-10")}
                    placeholder={school ? "Mã cán bộ, vd. cb0001" : undefined}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">
                  {t("pages.login.fields.password", "Password")}
                </Label>
                <div className="relative">
                  <LockKeyhole className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 z-10 size-4 -translate-y-1/2" />
                  <InputPassword
                    id="password"
                    name="password"
                    autoComplete="current-password"
                    required
                    className="h-11 rounded-full pl-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div className="flex justify-end">
                  <Link to="/forgot-password" className="text-primary text-xs font-medium hover:underline">
                    Quên mật khẩu?
                  </Link>
                </div>
              </div>

              {needCode ? (
                <div className="space-y-2">
                  <Label htmlFor="code">Mã xác thực (6 số)</Label>
                  <Input
                    id="code"
                    name="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    maxLength={6}
                    required
                    className="h-11 rounded-full text-center text-lg tracking-[0.5em]"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  />
                  <p className="text-muted-foreground text-xs">
                    {codeHint ??
                      "Mở ứng dụng xác thực trên điện thoại và nhập mã đang hiện."}
                  </p>
                  {codeHint?.includes("email") || codeHint?.includes("@") ? (
                    <button
                      type="button"
                      onClick={resendCode}
                      disabled={isPending}
                      className="text-primary text-xs font-medium hover:underline"
                    >
                      Gửi lại mã
                    </button>
                  ) : null}
                </div>
              ) : null}

              <Button
                type="submit"
                size="lg"
                className="mt-2 h-11 w-full text-sm font-semibold"
                disabled={isPending}
              >
                {isPending
                  ? t("pages.login.signingIn", "Signing in…")
                  : t("pages.login.buttons.submit", "Sign in")}
                {!isPending ? <ArrowRight /> : null}
              </Button>
            </form>

            <p className="text-muted-foreground border-t pt-4 text-xs text-pretty">
              {t(
                "pages.login.noAccount",
                "Accounts are created by an administrator. Contact yours if you cannot sign in."
              )}
            </p>
          </div>

          {/* ------------------------------------------------------------------
              ĐĂNG NHẬP NHANH THEO VAI TRÒ — chỉ khi DEMO_LOGIN. Xem ghi chú ở đầu file.
             ------------------------------------------------------------------ */}
          {DEMO_LOGIN ? (
            <Sheet>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className="mx-auto mt-5 flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-medium text-white/90 ring-1 ring-white/25 backdrop-blur transition-colors hover:bg-white/20"
                >
                  <FlaskConical className="size-3.5" />
                  Vào bằng môi trường thử nghiệm
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full gap-0 sm:max-w-md" aria-describedby={undefined}>
                <SheetHeader className="border-b">
                  <SheetTitle className="flex items-center gap-2">
                    <FlaskConical className="text-warning-text size-4" />
                    Vào bằng môi trường thử nghiệm
                  </SheetTitle>
                </SheetHeader>

                <div className="flex-1 space-y-6 overflow-y-auto p-4">
                  {/* Trường đứng đầu: đổi vai trong một trường là thao tác lặp nhiều nhất khi thử luồng duyệt. */}
                  {[...DEMO_TIERS].reverse().map((group) => (
                    <section key={group.tier} className="space-y-2.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                        <p
                          className={cn(
                            "flex items-center gap-2 text-sm font-semibold",
                            group.tone
                          )}
                        >
                          <span
                            className={cn("size-2 rounded-full", group.dot)}
                          />
                          {group.tier}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {group.hint}
                        </p>
                      </div>
                      {group.rows.map((row) => (
                        <div
                          key={row.where ?? group.tier}
                          className="flex items-center gap-2"
                        >
                          {row.where ? (
                            <span
                              className="w-36 shrink-0 truncate text-sm"
                              title={row.where}
                            >
                              {row.where}
                            </span>
                          ) : null}
                          <div className="flex flex-1 gap-2">
                            {row.accounts.map((a) => (
                              <Button
                                key={a.username}
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={isPending}
                                onClick={() => signInAs(a)}
                                className="h-9 flex-1 px-2 text-xs"
                                title={`${a.username} / ${a.password}`}
                              >
                                {a.role}
                              </Button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </section>
                  ))}

                  {DEMO_ADMIN ? (
                    // Quản trị là một nhóm ngay dưới các nhóm trên (theo trưởng nhóm), không dồn xuống đáy bảng.
                    <section className="space-y-2.5">
                      <p className="text-muted-foreground flex items-center gap-2 text-sm font-semibold">
                        <span className="bg-muted-foreground size-2 rounded-full" />
                        Hệ thống
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        onClick={() => signInAs(DEMO_ADMIN)}
                        className="h-9 w-full text-xs"
                        title={`${DEMO_ADMIN.username} / ${DEMO_ADMIN.password}`}
                      >
                        <ShieldCheck />
                        {DEMO_ADMIN.role}
                      </Button>
                    </section>
                  ) : null}
                </div>
              </SheetContent>
            </Sheet>
          ) : null}
        </div>
      </main>

      <footer className="px-5 pb-5 text-center text-xs text-white/55 sm:px-10">
        © {new Date().getFullYear()} Sở Giáo dục và Đào tạo Thành phố Hồ Chí
        Minh
      </footer>
    </div>
  );
};

SignInForm.displayName = "SignInForm";
