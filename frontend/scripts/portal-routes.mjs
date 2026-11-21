// Sinh / kiểm `src/domains/portal/types.ts` từ bảng phân cổng của máy chủ (PortalRoutes.java) — docs/kien-truc/11.
//   node scripts/portal-routes.mjs        → ghi lại bảng
//   node scripts/portal-routes.mjs --check → báo lệch (exit 1), không ghi
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));
const javaFile = path.resolve(root, "../../backend/src/main/java/com/g123/sfems/shared/web/portal/PortalRoutes.java");
const tsFile = path.resolve(root, "../src/domains/portal/types.ts");

const java = readFileSync(javaFile, "utf8");
const body = java.slice(java.indexOf("static {"), java.indexOf("private PortalRoutes()"));
const SETS = { ADMIN_ONLY: ["admin"], ALL: ["admin", "so", "school"], BUSINESS: ["so", "school"], NONE: [] };
const parse = (expr) => {
  expr = expr.trim();
  if (SETS[expr]) return SETS[expr];
  const m = /EnumSet\.of\(([^)]*)\)/.exec(expr);
  return m[1].split(",").map((x) => x.trim().toLowerCase());
};
const SET = String.raw`(ADMIN_ONLY|ALL|BUSINESS|NONE|EnumSet\.of\([^)]*\))`;
const re = new RegExp(String.raw`(put|own)\(${SET},\s*${SET},\s*((?:"[^"]+"\s*,?\s*)+)\)`, "gs");
// Dữ liệu nghiệp vụ (PortalRoutes.BUSINESS_DATA): cổng Admin chỉ đọc, không được thêm vào cổng ghi.
const businessDecl = /BUSINESS_DATA\s*=\s*Set\.of\(([^;]*)\);/s.exec(java);
const BUSINESS_DATA = new Set(businessDecl ? [...businessDecl[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]) : []);
const rows = [];
for (const m of body.matchAll(re)) {
  // Như PortalRoutes.put: cổng Admin luôn đọc được, và ghi được mọi thứ có cổng ghi TRỪ dữ liệu nghiệp vụ.
  // `own(...)` thì không thêm Admin (tài nguyên gắn với đơn vị của người gọi).
  const own = m[1] === "own";
  const withAdmin = (xs) => (own || xs.includes("admin") ? xs : ["admin", ...xs]);
  const read = withAdmin(parse(m[2]));
  for (const [, seg] of m[4].matchAll(/"([^"]+)"/g)) {
    const w = parse(m[3]);
    const write = w.length ? (BUSINESS_DATA.has(seg) ? w : withAdmin(w)) : [];
    rows.push([seg, read, write]);
  }
}
const list = (xs) => xs.map((x) => `"${x}"`).join(", ");
const table = rows.map(([seg, r, w]) => `  "${seg}": { read: [${list(r)}], write: [${list(w)}] },`).join("\n");

// Bản checkout trên Windows (core.autocrlf) có CRLF: chuẩn về LF trước khi tìm "{\n" và so khớp.
const current = readFileSync(tsFile, "utf8").replace(/\r\n/g, "\n");
const start = current.indexOf("export const PORTAL_ROUTES");
const open = current.indexOf("{\n", start) + 2;
const close = current.indexOf("\n};", open);
const next = current.slice(0, open) + table + current.slice(close);

if (process.argv.includes("--check")) {
  if (next !== current) {
    console.error("domains/portal/types.ts lệch với PortalRoutes.java — chạy: npm run gen:portal");
    process.exit(1);
  }
  console.log(`verify:portal — ${rows.length} tài nguyên, khớp máy chủ.`);
} else {
  writeFileSync(tsFile, next);
  console.log(`gen:portal — ghi ${rows.length} tài nguyên.`);
}
