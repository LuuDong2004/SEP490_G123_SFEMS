/* eslint-disable @typescript-eslint/no-explicit-any -- phản hồi API trong kiểm thử là JSON tuỳ ý */
import { test } from "@playwright/test";

import { API, ACCOUNTS, Recorder, apiLogin, auth, call, type Session } from "./lib";

/**
 * Bảo mật ở mức API (không ghi dữ liệu nghiệp vụ, trừ một phiếu nháp thử rồi xoá). Khoá thử tài khoản
 * `thcs.canbo2` (cán bộ cơ sở phụ) 15 phút ở bước cuối — các bộ khác không dùng tài khoản đó.
 */
test.describe.configure({ mode: "serial" });
const rec = new Recorder("security");
const S: Record<string, Session> = {};

test.beforeAll(async ({ request }) => {
  for (const r of ["admin", "soLanhDao", "soChuyenVien", "canbo", "hieutruong", "thptCanbo"] as const) S[r] = await apiLogin(request, r);
});
test.afterAll(() => rec.flush());

test("S1 chưa đăng nhập không đọc được dữ liệu", async ({ request }) => {
  for (const p of ["school/equipment", "so/schools", "admin/users", "school/equipment_intakes", "so/reports/dashboard"]) {
    const r = await request.get(`${API}/api/${p}`, { failOnStatusCode: false });
    rec.check(`S1:${p}`, "Xác thực", `GET /api/${p} khi chưa đăng nhập`, r.status() === 401, "critical", "401", String(r.status()));
  }
});

test("S2 tách cổng theo loại tài khoản", async ({ request }) => {
  const cases: [string, string, string][] = [
    ["canbo", "admin", "users"], ["canbo", "so", "inventory_campaigns"], ["canbo", "so", "schools"],
    ["hieutruong", "admin", "roles"], ["soChuyenVien", "admin", "users"], ["soChuyenVien", "school", "equipment"],
    ["admin", "school", "equipment"], ["admin", "so", "schools"],
  ];
  for (const [role, portal, res] of cases) {
    const r = await call(request, S[role], "GET", res, undefined, portal);
    rec.check(`S2:${role}->${portal}/${res}`, "Phân quyền theo cổng", `${ACCOUNTS[role as keyof typeof ACCOUNTS].label} gọi cổng ${portal} (/api/${portal}/${res})`,
      r.status === 403 || r.status === 404, "critical", "403 hoặc 404", String(r.status), { role });
  }
  // Đường cũ không qua cổng.
  const old = await request.get(`${API}/api/equipment`, { headers: auth(S.canbo), failOnStatusCode: false });
  rec.check("S2:old-path", "Phân quyền theo cổng", "Đường cũ /api/equipment (không tiền tố cổng)", [403, 404].includes(old.status()), "high", "403/404", String(old.status()));
});

test("S3 không xem được dữ liệu của trường khác (IDOR)", async ({ request }) => {
  const other = await call(request, S.thptCanbo, "GET", "equipment_intakes?_start=0&_end=1");
  const otherIntake = Array.isArray(other.body) ? other.body[0] : null;
  if (otherIntake) {
    const r = await call(request, S.canbo, "GET", `equipment_intakes/${otherIntake.id}`);
    rec.check("S3:intake", "Phạm vi dữ liệu", `Cán bộ THCS Bình An mở phiếu ghi tăng #${otherIntake.id} của THPT An Lạc`, [403, 404].includes(r.status), "critical", "403/404", String(r.status));
  }
  const eq = await call(request, S.thptCanbo, "GET", "equipment?_start=0&_end=1");
  const otherEq = Array.isArray(eq.body) ? eq.body[0] : null;
  if (otherEq) {
    const r = await call(request, S.canbo, "GET", `equipment/${otherEq.id}`);
    rec.check("S3:equipment", "Phạm vi dữ liệu", `Cán bộ THCS Bình An mở hồ sơ thiết bị #${otherEq.id} của THPT An Lạc`, [403, 404].includes(r.status), "critical", "403/404", String(r.status));
    const h = await call(request, S.canbo, "GET", `equipment/${otherEq.id}/history`);
    rec.check("S3:history", "Phạm vi dữ liệu", "… và lịch sử thiết bị đó", [403, 404].includes(h.status) || (Array.isArray(h.body) && h.body.length === 0), "high", "403/404 hoặc rỗng", `${h.status} (${Array.isArray(h.body) ? h.body.length + " dòng" : ""})`);
  }
  // Danh sách: lọc schoolId của trường khác thì không được trả dữ liệu trường đó.
  const schoolId = otherIntake?.school?.id;
  if (schoolId) {
    const r = await call(request, S.canbo, "GET", `equipment_intakes?schoolId=${schoolId}&_start=0&_end=5`);
    const leaked = Array.isArray(r.body) ? r.body.filter((x: any) => x.school?.id === schoolId).length : 0;
    rec.check("S3:list-filter", "Phạm vi dữ liệu", "Lọc danh sách phiếu theo schoolId của trường khác", leaked === 0, "critical", "0 phiếu của trường khác", `${leaked} phiếu`);
    const rooms = await call(request, S.canbo, "GET", `rooms?schoolId=${schoolId}&_start=0&_end=5`);
    const leakedRooms = Array.isArray(rooms.body) ? rooms.body.filter((x: any) => (x.school?.id ?? x.schoolId) === schoolId).length : 0;
    rec.check("S3:rooms-filter", "Phạm vi dữ liệu", "Lọc danh sách phòng theo schoolId của trường khác", leakedRooms === 0, "high", "0", `${leakedRooms} phòng`);
    const fs = await call(request, S.canbo, "GET", `facility-standard/schools/${schoolId}`);
    rec.check("S3:facility-standard", "Phạm vi dữ liệu", "Đánh giá CSVC theo chuẩn của trường khác", [403, 404].includes(fs.status), "high", "403/404", String(fs.status));
  }
  // Sở xem được toàn ngành (đúng thiết kế).
  const so = await call(request, S.soChuyenVien, "GET", "equipment_intakes?_start=0&_end=1");
  rec.check("S3:so-reads", "Phạm vi dữ liệu", "Chuyên viên Sở xem phiếu ghi tăng toàn ngành (đúng thiết kế)", so.status === 200, "medium", "200", String(so.status));
});

test("S4 ghi hộ trường khác bằng cách gửi schoolId (mass assignment)", async ({ request }) => {
  const other = await call(request, S.thptCanbo, "GET", "equipment_intakes?_start=0&_end=1");
  const otherSchool = Array.isArray(other.body) ? other.body[0]?.school?.id : null;
  const mine = S.canbo.user;
  const r = await call(request, S.canbo, "POST", "purchase_proposals", {
    schoolId: otherSchool, school: { id: otherSchool }, title: "E2E-AUDIT thử schoolId", reason: "E2E-AUDIT", lines: [],
  });
  let createdFor: any = null;
  if (r.status < 300 && r.body?.id) {
    createdFor = r.body.school?.id;
    await call(request, S.canbo, "DELETE", `purchase_proposals/${r.body.id}`);
  }
  rec.check("S4:proposal-school", "Phạm vi dữ liệu", "Cán bộ THCS gửi đề xuất mua sắm kèm schoolId của THPT", createdFor === null || createdFor !== otherSchool, "critical",
    "bị từ chối hoặc vẫn gắn trường của người gọi", r.status < 300 ? `tạo được, gắn trường #${createdFor} (người gọi: ${mine?.username})` : `từ chối ${r.status}`);
});

test("S5 phân quyền theo vai (dọc)", async ({ request }) => {
  const perms: Record<string, string[]> = {};
  for (const role of Object.keys(S)) {
    const r = await call(request, S[role], "GET", "auth/permissions", undefined, "");
    perms[role] = Array.isArray(r.body) ? r.body : (r.body?.permissions ?? []);
  }
  const has = (role: string, code: string) => perms[role].includes(code);
  const rules: [string, string, boolean, string][] = [
    ["canbo", "equipment_intakes:approve", false, "Cán bộ thiết bị không được duyệt phiếu ghi tăng"],
    ["canbo", "purchase_proposals:approve", false, "Cán bộ thiết bị không được duyệt đề xuất"],
    ["canbo", "users:write", false, "Cán bộ thiết bị không quản lý tài khoản"],
    ["hieutruong", "equipment_intakes:approve", true, "Hiệu trưởng duyệt phiếu ghi tăng (PN-03)"],
    ["hieutruong", "purchase_proposals:approve", true, "Hiệu trưởng duyệt đề xuất cấp trường (NC-03)"],
    ["soChuyenVien", "procurement_plans:write", true, "Chuyên viên Sở lập kế hoạch (NC-05)"],
    ["soChuyenVien", "procurement_plans:approve", false, "Chuyên viên Sở không tự duyệt kế hoạch (NC-06 là của lãnh đạo Sở)"],
    ["soLanhDao", "procurement_plans:approve", true, "Lãnh đạo Sở duyệt kế hoạch (NC-06)"],
    ["soChuyenVien", "inventory_campaigns:write", true, "Chuyên viên Sở phát động đợt kiểm kê (KK-01)"],
    ["admin", "users:write", true, "Quản trị viên quản lý tài khoản (HT-04)"],
    ["admin", "equipment_intakes:write", true, "Quản trị viên lập được phiếu ghi tăng (đi được toàn bộ luồng, 281)"],
    ["admin", "purchase_proposals:approve", true, "Quản trị viên duyệt được đề xuất (đi được toàn bộ luồng, 281)"],
  ];
  for (const [role, code, want, title] of rules) {
    const got = has(role, code);
    rec.check(`S5:${role}:${code}`, "Phân quyền theo vai", title, got === want, code.startsWith("users") || !want ? "high" : "medium", want ? "có quyền" : "không có quyền", got ? "có quyền" : "không có quyền", { role });
  }
  rec.add({ id: "S5:counts", area: "Phân quyền theo vai", title: "Số mã quyền của từng vai", ok: true, severity: "info", expected: "-", actual: Object.entries(perms).map(([k, v]) => `${k}=${v.length}`).join(", ") });
  // Admin gọi được nghiệp vụ qua cổng Admin?
  const a = await call(request, S.admin, "GET", "purchase_proposals?_start=0&_end=1");
  rec.check("S5:admin-business", "Phân quyền theo vai", "Quản trị viên đọc đề xuất mua sắm qua cổng Admin", a.status === 200, "medium", "200 (đi được toàn bộ luồng, 281)", String(a.status));
});

test("S6 token giả mạo, hết hạn, đăng xuất", async ({ request }) => {
  const [h, p, sig] = S.canbo.token.split(".");
  const payload = JSON.parse(Buffer.from(p, "base64url").toString());
  const forged = [h, Buffer.from(JSON.stringify({ ...payload, userType: "SYSTEM", username: "admin", sub: "1" })).toString("base64url"), sig].join(".");
  const r1 = await request.get(`${API}/api/admin/users`, { headers: { Authorization: `Bearer ${forged}` }, failOnStatusCode: false });
  rec.check("S6:forged", "Xác thực", "Token sửa payload (giả làm quản trị) giữ chữ ký cũ", r1.status() === 401, "critical", "401", String(r1.status()));
  const none = [Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url"), Buffer.from(JSON.stringify({ ...payload, userType: "SYSTEM" })).toString("base64url"), ""].join(".");
  const r2 = await request.get(`${API}/api/admin/users`, { headers: { Authorization: `Bearer ${none}` }, failOnStatusCode: false });
  rec.check("S6:alg-none", "Xác thực", "Token alg=none", r2.status() === 401, "critical", "401", String(r2.status()));
  // Đăng xuất rồi dùng lại token cũ.
  const s = await apiLogin(request, "canbo");
  await request.post(`${API}/api/auth/logout`, { headers: auth(s), data: { refreshToken: s.refresh }, failOnStatusCode: false });
  const r3 = await request.get(`${API}/api/school/equipment?_start=0&_end=1`, { headers: auth(s), failOnStatusCode: false });
  rec.check("S6:after-logout", "Xác thực", "Dùng lại access token sau khi đăng xuất", r3.status() === 401, "medium", "401 (phiên bị thu hồi)", String(r3.status()));
  const r4 = await request.post(`${API}/api/auth/refresh`, { data: { refreshToken: s.refresh }, failOnStatusCode: false });
  rec.check("S6:refresh-after-logout", "Xác thực", "Dùng refresh token sau khi đăng xuất", r4.status() >= 400, "high", "4xx", String(r4.status()));
  rec.add({ id: "S6:ttl", area: "Xác thực", title: "Thời hạn access token", ok: S.canbo ? true : false, severity: "info", expected: "ngắn (≤ 15 phút)", actual: `${payload.exp - payload.iat} giây` });
});

test("S7 tiêm ký tự đặc biệt vào tìm kiếm, sắp xếp, phân trang", async ({ request }) => {
  const probes = [
    "equipment?q=' OR 1=1--&_start=0&_end=5",
    "equipment?_sort=id;DROP TABLE users&_order=asc&_start=0&_end=5",
    "equipment?_sort=name&_order=desc' OR '1'='1&_start=0&_end=5",
    "equipment?_start=-1&_end=999999",
    "equipment?_start=0&_end=100000",
    "equipment_intakes/abc",
    "equipment?status=NOT_A_STATUS",
  ];
  for (const p of probes) {
    const r = await call(request, S.canbo, "GET", p);
    const size = Array.isArray(r.body) ? r.body.length : null;
    rec.check(`S7:${p}`, "Đầu vào API", `GET ${p}`, r.status < 500 && !/SQL|syntax|PSQLException|Hibernate/i.test(r.text), "high",
      "không 5xx, không lộ lỗi SQL", `${r.status}${size !== null ? ` · ${size} dòng` : ""}${r.status >= 500 ? " · " + r.text.slice(0, 120) : ""}`);
  }
});

test("S8 header bảo mật, CORS, endpoint lộ ra ngoài", async ({ request }) => {
  const r = await request.get(`${API}/api/school/equipment?_start=0&_end=1`, { headers: auth(S.canbo) });
  const h = r.headers();
  rec.check("S8:nosniff", "Header", "X-Content-Type-Options: nosniff", h["x-content-type-options"] === "nosniff", "low", "nosniff", h["x-content-type-options"] ?? "(không có)");
  rec.check("S8:frame", "Header", "Chống nhúng iframe (X-Frame-Options / CSP frame-ancestors)", !!h["x-frame-options"] || /frame-ancestors/.test(h["content-security-policy"] ?? ""), "low", "có", h["x-frame-options"] ?? h["content-security-policy"] ?? "(không có)");
  rec.check("S8:cache", "Header", "Không cache phản hồi có dữ liệu", /no-store|no-cache/.test(h["cache-control"] ?? ""), "low", "no-store", h["cache-control"] ?? "(không có)");
  const evil = await request.fetch(`${API}/api/auth/login`, { method: "OPTIONS", headers: { Origin: "https://evil.example", "Access-Control-Request-Method": "POST" }, failOnStatusCode: false });
  const acao = evil.headers()["access-control-allow-origin"];
  rec.check("S8:cors", "Header", "CORS từ origin lạ (https://evil.example)", !acao || (acao !== "*" && !acao.includes("evil")), "high", "không cho phép", acao ?? "(không có ACAO)");
  for (const p of ["/swagger-ui.html", "/v3/api-docs", "/actuator", "/actuator/env", "/actuator/health"]) {
    const x = await request.get(`${API}${p}`, { failOnStatusCode: false, maxRedirects: 0 });
    const exposed = x.status() === 200 || x.status() === 302;
    const sev = p.includes("env") ? "critical" : p.includes("health") ? "info" : "low";
    rec.check(`S8:${p}`, "Lộ thông tin", `Truy cập ${p} không đăng nhập`, p.includes("health") ? true : !exposed, sev as any,
      p.includes("health") ? "200 (không lộ chi tiết)" : "đóng trên bản triển khai", `${x.status()}${p.includes("health") ? " · " + (await x.text()).slice(0, 60) : ""}`);
  }
});

test("S9 dữ liệu nhạy cảm trong phản hồi", async ({ request }) => {
  const u = await call(request, S.admin, "GET", "users?_start=0&_end=5");
  const txt = JSON.stringify(u.body);
  rec.check("S9:users-hash", "Lộ thông tin", "Danh sách tài khoản không trả mật khẩu băm / bí mật 2 lớp", !/password(Hash)?"\s*:\s*"\$2|mfaSecret|totpSecret/i.test(txt), "critical", "không có", /passwordHash|mfaSecret/i.test(txt) ? "CÓ trường nhạy cảm" : "không thấy");
  const me = await call(request, S.canbo, "GET", "auth/me", undefined, "");
  rec.check("S9:me", "Lộ thông tin", "/api/auth/me không trả mật khẩu băm", !/\$2[aby]\$/.test(JSON.stringify(me.body)), "critical", "không có", "đã kiểm");
  const login = await request.post(`${API}/api/auth/login`, { data: { username: "khong.ton.tai.e2e", password: "x" }, failOnStatusCode: false });
  const wrongPw = await request.post(`${API}/api/auth/login`, { data: { username: "thpt.hieutruong", password: "sai-mat-khau" }, failOnStatusCode: false });
  const a = await login.text(); const b = await wrongPw.text();
  const msg = (t: string) => { try { const j = JSON.parse(t); return j.message ?? j.detail ?? j.title ?? t; } catch { return t; } };
  rec.check("S9:enum", "Xác thực", "Thông báo lỗi như nhau giữa 'sai tên' và 'sai mật khẩu' (chống dò tài khoản)", msg(a) === msg(b) && login.status() === wrongPw.status(), "medium",
    "giống nhau", `tên lạ: ${login.status()} "${String(msg(a)).slice(0, 60)}" · sai MK: ${wrongPw.status()} "${String(msg(b)).slice(0, 60)}"`);
});

test("S10 khoá tạm sau 5 lần sai mật khẩu (dùng thcs.canbo2)", async ({ request }) => {
  let last = 0; let lastMsg = "";
  for (let i = 0; i < 6; i++) {
    const r = await request.post(`${API}/api/auth/login`, { data: { username: "thcs.canbo2", password: `sai-${i}` }, failOnStatusCode: false });
    last = r.status(); lastMsg = (await r.text()).slice(0, 160);
  }
  const right = await request.post(`${API}/api/auth/login`, { data: { username: "thcs.canbo2", password: ACCOUNTS.canbo2.password }, failOnStatusCode: false });
  rec.check("S10:lockout", "Xác thực", "Sai 5 lần liên tiếp thì khoá tạm, kể cả nhập đúng ngay sau đó", right.status() !== 200, "high", "đúng mật khẩu vẫn bị chặn 15 phút", `lần 6: ${last}; nhập đúng: ${right.status()} ${(await right.text()).slice(0, 100)}`, { evidence: lastMsg });
});
