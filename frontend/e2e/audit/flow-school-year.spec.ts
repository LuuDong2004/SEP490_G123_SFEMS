import { expect, test, type Page } from "@playwright/test";

import { apiLogin, call, Recorder, shot, uiLogin, watch, type Role } from "./lib";

/**
 * Dữ liệu theo năm học (docs/du-lieu-theo-nam-hoc.md): hồ sơ năm học theo điểm trường, phân công giáo viên, chuẩn tối
 * thiểu theo năm học (theo thông tư / theo điều chỉnh), tiến độ của Sở, điều chỉnh cho phép trên dòng danh mục. Chỉ đọc —
 * không xác nhận, chốt hay khởi tạo năm để không đổi dữ liệu demo.
 */
test.describe.configure({ mode: "serial" });
const rec = new Recorder("flow-school-year");
test.afterAll(() => rec.flush());

async function open(page: Page, role: Role, path: string, id: string, title: string) {
  const w = watch(page);
  await page.goto(path);
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  await page.getByText(/Đang tải/).first().waitFor({ state: "hidden", timeout: 15_000 }).catch(() => {});
  w.stop();
  const errors = [...w.js, ...w.api];
  const file = await shot(page, `Y-${id.replace(/:/g, "-")}`);
  rec.add({ id, area: "Năm học", title, ok: errors.length === 0, severity: "high", expected: "không lỗi JS / API",
    actual: errors.join(" | ") || "ok", role, evidence: file });
  expect(errors, `${title}: ${errors.join(" | ")}`).toEqual([]);
}

test("Y1 cán bộ thiết bị: hồ sơ năm học, chuẩn theo năm học, phân công", async ({ page, request }) => {
  await uiLogin(page, "canbo");
  await open(page, "canbo", "/school-year-profile", "Y1:profile", "Cán bộ mở Hồ sơ năm học");
  await expect(page.getByText(/Đang khai|Đã xác nhận|Đã chốt/).first()).toBeVisible();
  await open(page, "canbo", "/equipment-minimum", "Y1:standard", "Cán bộ mở chuẩn tối thiểu theo năm học");
  await expect(page.getByText(/Đáp ứng theo TT/).first()).toBeVisible();
  await open(page, "canbo", "/staff-assignments", "Y1:assign", "Cán bộ mở Phân công giáo viên");

  const s = await apiLogin(request, "canbo");
  const years = await call(request, s, "GET", "year_standards");
  rec.add({ id: "Y1:api", area: "Năm học", title: "GET /year_standards năm hiện tại", ok: years.status === 200,
    severity: "high", expected: "200", actual: String(years.status), role: "canbo" });
  expect(years.status).toBe(200);
  const body = years.body;
  expect(Array.isArray(body.rows ?? body.campusRows ?? [])).toBe(true);
});

test("Y2 hiệu trưởng: thấy nút xác nhận điểm trường, không mở lại được", async ({ page, request }) => {
  await uiLogin(page, "hieutruong");
  await open(page, "hieutruong", "/school-year-profile", "Y2:profile", "Hiệu trưởng mở Hồ sơ năm học");
  await expect(page.getByRole("button", { name: /Xác nhận|Bỏ xác nhận|Chốt năm học/ }).first()).toBeVisible();
  const s = await apiLogin(request, "hieutruong");
  const lock = await call(request, s, "GET", "school_year_profiles/lock");
  expect(lock.status).toBe(200);
  const reopen = await call(request, s, "POST", "school_year_profiles/reopen", { schoolId: s.user?.schoolId ?? 0, schoolYearId: 0, reason: "thử" });
  rec.add({ id: "Y2:reopen", area: "Năm học", title: "Trường không tự mở lại năm học", ok: reopen.status >= 400,
    severity: "high", expected: "4xx", actual: String(reopen.status), role: "hieutruong" });
  expect(reopen.status).toBeGreaterThanOrEqual(400);
});

test("Y3 Sở: năm học trên header, chuẩn theo năm học các trường, điều chỉnh trên dòng danh mục", async ({ page, request }) => {
  await uiLogin(page, "soChuyenVien");
  await open(page, "soChuyenVien", "/school-explorer", "Y3:explorer", "Sở mở Trường học (khởi tạo năm học)");
  // Năm học đang làm việc chọn trên header — không còn màn Tiến độ hồ sơ năm học riêng.
  await expect(page.locator("[data-slot=app-header]").getByText(/\d{4}–\d{4}/).first()).toBeVisible();
  await open(page, "soChuyenVien", "/equipment-minimum", "Y3:standard", "Sở mở chuẩn tối thiểu theo năm học");
  await open(page, "soChuyenVien", "/equipment-standards", "Y3:catalog", "Sở mở Danh mục thiết bị tối thiểu");

  const s = await apiLogin(request, "soChuyenVien");
  const progress = await call(request, s, "GET", "school_year_profiles/progress");
  expect(progress.status).toBe(200);
  const norms = await call(request, s, "GET", "equipment_norms?page=1&size=5");
  expect(norms.status).toBe(200);
  const first = Array.isArray(norms.body) ? norms.body[0] : norms.body?.content?.[0];
  rec.add({ id: "Y3:adjust", area: "Danh mục tối thiểu", title: "Dòng danh mục có khối điều chỉnh cho phép", ok: !!first?.adjustment,
    severity: "medium", expected: "adjustment.kind", actual: JSON.stringify(first?.adjustment ?? null).slice(0, 120), role: "soChuyenVien" });
  expect(first?.adjustment?.kind).toBeTruthy();
});
