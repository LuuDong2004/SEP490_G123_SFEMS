import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { execSync } from "child_process";
import { readFileSync } from "fs";
import path from "path";
import { defineConfig, loadEnv } from "vite";

/** Mã commit ngắn của bản đang chạy; ngoài git (vd. build từ tệp nén) thì để trống. */
function gitCommit(): string {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
}

const pkg = JSON.parse(readFileSync(path.resolve(__dirname, "package.json"), "utf-8")) as { version: string };
const built = new Date();
const pad = (n: number) => String(n).padStart(2, "0");

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  // Phiên bản hiện ở chân thanh bên.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_COMMIT__: JSON.stringify(gitCommit()),
    __APP_BUILT__: JSON.stringify(`${pad(built.getDate())}/${pad(built.getMonth() + 1)}/${built.getFullYear()}`),
  },
  // Prefer 5555, but keep the dev server usable when another local instance
  // already owns it. Vite will select the next free port (for example 5556).
  // The backend accepts localhost development-origin patterns accordingly.
  server: {
    // Máy nào trùng cổng thì đặt VITE_PORT trong .env.local, không sửa ở đây.
    port: Number(loadEnv(mode, process.cwd(), "").VITE_PORT) || 5555,
    // Buộc nghe trên IPv4. Mặc định Vite nghe `localhost`, và từ Node 17 thì
    // `localhost` phân giải về `::1` TRƯỚC — nên dev server chỉ mở trên IPv6.
    // Chrome trên Windows lại thử `127.0.0.1` đầu tiên, và trượt: trang báo lỗi
    // kết nối trong khi `curl localhost` vẫn 200, nên trông như lỗi trình duyệt.
    host: "127.0.0.1",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
