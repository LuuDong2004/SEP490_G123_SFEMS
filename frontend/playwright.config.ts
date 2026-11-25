import { defineConfig } from "@playwright/test";

/**
 * Kiểm thử đầu – cuối (E2E) trên bản chạy local: `npm run dev` (5555) + `./gradlew bootRun` (8888) phải đang chạy.
 * Dùng Chrome đã cài trên máy (`channel: "chrome"`), không tải trình duyệt riêng.
 *
 *   npm run e2e          — chạy hết (smoke + danh sách + quy trình; quy trình GHI dữ liệu mẫu)
 *   npm run e2e:smoke    — chỉ đi qua mọi màn của từng vai, không ghi gì
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "e2e-report" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5555",
    channel: "chrome",
    viewport: { width: 1600, height: 900 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    locale: "vi-VN",
  },
  outputDir: "e2e-results",
});
