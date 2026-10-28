import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Prefer 5555, but keep the dev server usable when another local instance
  // already owns it. Vite will select the next free port (for example 5556).
  // The backend accepts localhost development-origin patterns accordingly.
  server: {
    port: 5555,
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
});
