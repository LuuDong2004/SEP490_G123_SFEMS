# Ma trận truy vết 46 UC — SFEMS

Cập nhật 20/11/2026 theo nhánh `refactor` (nền mới). Ngày 22/11/2026 thêm HT-07, HT-08, TC-03, TC-04 và bỏ danh mục học kỳ (changelog 285). Nguồn: `docs/SFEMS_Danh-sach-UC-pham-vi-do-an.xlsx` (sheet 1),
controller ở `backend/.../module`, route ở `frontend/src/app/router` và `features/catalogs/registry.ts`, bảng cổng
`PortalRoutes.java`, test ở `backend/src/test` và `frontend/e2e/audit` (bộ e2e theo vai; mã như A4, K2, E3 là mã kiểm tra trong bộ đó).

Quy ước:

- **Màn hình**: đường dẫn trên giao diện. "Phân hệ X › Tab" là tab trong `/modules/<x>`; "Tổng quan trường › Tab" là
  tab của `/school-explorer`.
- **API**: tiền tố cổng (`/api/admin|so|school`) do `PortalRoutes` thêm, ở đây viết đường dẫn gốc `/api/...`.
- **Quyền**: mã `resource:action`. Controller kế thừa khung danh mục / phiếu kiểm theo tài nguyên của nó
  (`<resource>:read|write|delete|approve|export`).
- **Test**: ✅ có test chạm đúng UC · ◐ chỉ có test gián tiếp (luật chung, cổng, phạm vi dòng) hoặc thiếu nhánh chính · ❌ chưa có. Bộ `smoke` (mở mọi màn của mọi vai, không lỗi JS/API) không tính là test của UC.

## Hệ thống, tài khoản và phân quyền (HT)

| UC | Tên | Người | Màn hình | API | Quyền | Test |
|---|---|---|---|---|---|---|
| HT-01 | Đăng nhập | DongLV | `/login`, `/forgot-password`, `/reset-password` | `POST /api/auth/login`, `/refresh`, `/forgot-password`, `/api/auth/mfa/*`, `GET /api/auth/schools` | công khai | ✅ `AdminPortalTest`, `AdminPortalMfaOffTest`, `RequestThrottleTest`; e2e `security` (S6, S9, S10), `validation` (V4) |
| HT-02 | Đăng xuất | DongLV | menu tài khoản | `POST /api/auth/logout`, `DELETE /api/auth/sessions/{id}` | đã đăng nhập | ✅ e2e `security` S6 (token và refresh token sau đăng xuất bị từ chối) |
| HT-03 | Đổi mật khẩu cá nhân | DongLV | `/profile` | `POST /api/auth/change-password` | đã đăng nhập | ◐ e2e `validation` V4 (mật khẩu yếu, nhập lại không khớp, sai mật khẩu hiện tại) — chưa có ca đổi thành công |
| HT-04 | Quản lý tài khoản người dùng | DongLV | `/users` (+ `create`, `edit/:id`, `show/:id`) | `/api/users` (CRUD, `/{id}/password`, `/{id}/sessions`) | `users:read/write/delete` | ✅ `UserSubtypeTest`; e2e `validation` V2, `security` S5 |
| HT-05 | Quản lý vai trò và quyền chức năng | DongLV | `/roles`, `/permissions` | `/api/roles`, `/api/permissions`, `/api/row_level_policies` | `roles:*`, `permissions:read`, `row_level_policies:*` | ✅ `RoleTypeTest`, `PolicyCompilerTest`, `ScopeAlgebraTest`, `AuthorityCacheRlsTest`, `CompilerAgreementTest`; e2e `security` S2, S5 |
| HT-06 | Nhận và quản lý thông báo | QuangTD | `/notifications`, chuông trên đầu trang | `/api/notifications` (`/recent`, `/unread-count`, `/{id}/read`, `/read-all`) | đã đăng nhập | ◐ e2e `flow-procurement` A2/A3, `flow-inventory` K2, `flow-exceptions` E1 (nhận thông báo đúng người) — chưa test đánh dấu đã đọc |
| HT-07 | Cấp tài khoản cho nhân sự trường | DongLV | `/school-users`, Tổng quan trường › Nhân sự › Cấp tài khoản | `/api/staff/{id}/account`, `/api/school_users` | `staff_accounts:write`, `school_users:*` | ❌ |
| HT-08 | Cấu hình luồng phê duyệt | DongLV | `/approval-flows` | `/api/approval_flows` | `approval_flows:read/write` | ◐ `RoleTypeTest` (chỉ quản trị viên có `approval_flows:write`) — chưa test luồng không có bước, ngưỡng tiền |

## Danh mục dùng chung (DM)

| UC | Tên | Người | Màn hình | API | Quyền | Test |
|---|---|---|---|---|---|---|
| DM-01 | Quản lý danh mục dùng chung | TuTN | `/catalogs` → `/units`, `/grades`, `/subjects`, `/subject-groups`, `/school-years`, `/room-types`, `/facility-groups`, `/origin-sources`, `/acquisition-methods`, `/movement-reasons`, `/education-levels`, `/wards` | `/api/<danh mục>` (khung `CatalogController`) | `<danh mục>:read/write/delete` | ◐ `FieldRuleTest`, `FieldRulesExportTest` |
| DM-02 | Quản lý danh mục thiết bị | TuTN | `/equipment-catalogs`, `/equipment-types`, `/equipment-configs` | `/api/equipment_catalogs` (+ `/school-items`, `/school-items/name-check`), `/api/equipment_types`, `/api/equipment_configs` | `equipment_catalogs:*` | ✅ `CatalogNamesTest` |
| DM-03 | Quản lý danh mục thiết bị dạy học tối thiểu và định mức | TuTN | `/equipment-standards`, `/equipment-minimum`, `/norm-matrix`, `/equipment-norms` | `/api/equipment_standards` (`/revise`, `/{id}/apply`, `/{id}/changes`), `/api/equipment_norms` (`/import`, `/export.xlsx`, `/batch`, `/adjustment-suggestion`, `/adjust-groups`) | `equipment_standards:*`, `equipment_norms:*` | ◐ `AppendixParserTest` (đọc phụ lục thông tư), `NormAdjustmentsTest`, `NormAuditTest` (điều chỉnh cho phép trên dòng, ngừng áp dụng từ ngày đầu năm học), `NormChangeTest` (Sở đổi dòng thì điều chỉnh của trường hết hiệu lực); e2e `flow-school-year` Y3 — chưa test form thêm / sửa dòng |
| DM-04 | Quản lý quy tắc sinh mã | TuTN | `/code-rules`, `/school-code-rules` | `/api/code_rules` (`/next`), `/api/school_code_rules` | `code_rules:*`, `school_code_rules:*` | ❌ |

## Tổ chức và cơ sở vật chất (TC)

| UC | Tên | Người | Màn hình | API | Quyền | Test |
|---|---|---|---|---|---|---|
| TC-01 | Quản lý trường học | HoangPND | `/schools`, `/school-explorer` › Hồ sơ trường | `/api/schools`, `/api/schools/{id}/logo`, `/api/school_overview`, `/api/school_profile` | `schools:*` | ✅ `SchoolShortCodesTest`, `SchoolImportNameKeyTest` |
| TC-02 | Quản lý phòng | HoangPND | Tổng quan trường › Cơ sở vật chất | `/api/rooms` (+ `/custom-types`), `/api/buildings`, `/api/campuses`, `/api/facility_info` | `rooms:*` | ◐ e2e `security` S3 (lọc phòng của trường khác bị chặn) |
| TC-03 | Quản lý nhân sự trường | HoangPND | Tổng quan trường › Nhân sự (cán bộ, giáo viên, tổ chuyên môn) | `/api/staff`, `/api/subject_teams` | `staff:*`, `subject_teams:*` | ❌ |
| TC-04 | Đánh giá cơ sở vật chất theo chuẩn | HoangPND | Tổng quan trường › Đánh giá CSVC theo chuẩn, `/reports/facility-standard` | `GET /api/facility-standard/schools/{id}` (+ `/export`) | `rooms:read` hoặc `reports:read` | ◐ e2e `security` S3 (đánh giá của trường khác bị chặn) |

## Hồ sơ thiết bị và mã thiết bị (TS)

| UC | Tên | Người | Màn hình | API | Quyền | Test |
|---|---|---|---|---|---|---|
| TS-01 | Quản lý hồ sơ thiết bị | NghiaNV | Phân hệ Thiết bị › Danh sách thiết bị | `/api/equipment` (+ `/summary`, `/summary.xlsx`), `/api/equipment_items` | `equipment:read/write/delete` | ◐ `OpeningBalanceTest` (khai tay chỉ khi chưa chốt số dư, không vào chỗ đang kiểm kê, hồ sơ khai nhầm xoá được); e2e `security` S3, `flow-procurement` A7, `flow-exceptions` E8 — chưa test màn sửa hồ sơ |
| TS-02 | Tra cứu thiết bị theo mã thiết bị | NghiaNV | `/equipment-lookup` | `GET /api/equipment` (lọc theo mã thiết bị, mã cũ) | `equipment:read` | ✅ e2e `flow-exceptions` E7 (tra theo mã cũ qua API và màn tra cứu) |
| TS-03 | Đính kèm tài liệu, hình ảnh thiết bị | NghiaNV | Hồ sơ thiết bị › Tệp, ảnh | `/api/attachments` (+ `/{id}/content`, `/{id}/cover`) | quyền của bản ghi gắn tệp | ◐ e2e `flow-procurement` A6 (đính kèm phiếu, tệp giả bị từ chối) — chưa test tệp trên hồ sơ thiết bị |
| TS-04 | Xem lịch sử thay đổi thiết bị | NghiaNV | Hồ sơ thiết bị › Lịch sử | `GET /api/equipment/{id}/history` | `equipment:read` | ✅ `OpeningBalanceTest`; e2e `flow-exceptions` E7 (dòng vào sổ, dòng đổi sang mã chuẩn), `security` S3 |
| TS-05 | Cấp mã chuẩn cho thiết bị mang mã cũ | NghiaNV | Hồ sơ thiết bị › nút Cấp mã chuẩn | `GET /api/equipment/{id}/standard`, `POST /api/equipment/{id}/standard-code` | `equipment:write` | ✅ `OpeningBalanceTest`; e2e `flow-exceptions` E7 (mã cũ giữ làm mã hiện hành, bấm Cấp mã chuẩn, chặn cấp lần hai) |
| TS-06 | Sinh mã thiết bị | NghiaNV | (gọi qua ghi tăng, cấp mã chuẩn) | `GET /api/equipment/next-code`; service sinh mã khi duyệt phiếu | — | ✅ e2e `flow-procurement` A7, `flow-exceptions` E7 (mã đúng mẫu TT.TR.MH.LT.ST.NC) |
| TS-07 | Nhập dữ liệu thiết bị ban đầu từ tệp | NghiaNV | `/data-imports`, `/data-imports/:id` | `/api/data_imports` (`/template`, `/sheets`, `/{id}/choices`…), `/api/data_transfer` | `data_imports:*`, `data_transfer:*` | ✅ `OnboardingParsingTest`, `OnboardingValidatorTest`, `OnboardingQuickFixTest`, `OnboardingAiServiceTest`, `SpreadsheetReaderTest` |

## Nhu cầu và kế hoạch mua sắm (NC)

| UC | Tên | Người | Màn hình | API | Quyền | Test |
|---|---|---|---|---|---|---|
| NC-01 | Xem mức đáp ứng danh mục tối thiểu | HoangPND | `/equipment-adequacy`, `/equipment-minimum` (theo năm học, điểm trường), `/school-year-profile`, trang trường trong `/school-explorer` (trạng thái năm, mở lại, khởi tạo) | `GET /api/purchase_proposals/adequacy`, `/adequacy-summary`, `/adequacy-catalog`, `*.xlsx`; `GET /api/year_standards` (`/overview`, `/suggestions`), `/api/school_norm_adjustments`, `/api/school_year_profiles`, `/api/staff_assignments` | `purchase_proposals:read`, `school_norm_adjustments:*`, `school_year_profiles:*`, `staff_assignments:*` | ✅ `YearAdequacyTest`, `SchoolNormAdjustmentTest`, `SchoolYearProfileTest`, `SchoolYearInitTest`, `StaffAssignmentTest`; e2e `flow-procurement` A1, `flow-school-year` Y1–Y3 |
| NC-02 | Lập và trình đề xuất mua sắm | HoangPND | `/purchase-proposals` (+ `create`, `edit/:id`) | `/api/purchase_proposals` (CRUD, `/{id}/submit`, `/overlaps`); `POST /api/year_standards/proposal` (đưa dòng thiếu vào đề xuất), `GET /api/year_standards/traces` | `purchase_proposals:write` | ✅ `ReachedStepTest`, `YearGapTest` (đúng số thiếu, chỉ trình khi năm học đã chốt); e2e `flow-procurement` A1, `validation` V1, `flow-exceptions` E1 (trả lại, trình lại) |
| NC-03 | Duyệt đề xuất mua sắm cấp trường | HoangPND | `/purchase-proposals/show/:id` | `POST /api/purchase_proposals/{id}/approve`, `/reject`, `/return` | `purchase_proposals:approve` | ✅ `ReachedStepTest`; e2e `flow-procurement` A2, `flow-exceptions` E1 (trả lại) |
| NC-04 | Duyệt đề xuất mua sắm cấp Sở | HoangPND | như NC-03, tài khoản Sở | như NC-03 (bước 2 của luồng duyệt) | `purchase_proposals:approve` | ✅ `ReachedStepTest`; e2e `flow-procurement` A3, `flow-exceptions` E2 (từ chối) |
| NC-05 | Lập kế hoạch mua sắm | HoangPND | `/procurement-plans` (+ `create`, `edit/:id`) | `/api/procurement_plans` (CRUD, `/candidates`, `/{id}/submit`) | `procurement_plans:write` | ✅ e2e `flow-procurement` A4, `flow-exceptions` E3 (đề xuất bị từ chối không vào kế hoạch) |
| NC-06 | Duyệt kế hoạch mua sắm | HoangPND | `/procurement-plans/show/:id` | `POST /api/procurement_plans/{id}/approve`, `/return` (kế hoạch không có từ chối, chỉ trả lại) | `procurement_plans:approve` | ✅ e2e `flow-procurement` A5, `flow-exceptions` E3 (trả lại kế hoạch) |
| NC-07 | Lập phiếu ghi tăng từ đề xuất đã hoàn tất | HoangPND | đề xuất đã duyệt › Hàng về, lập phiếu ghi tăng | `GET /api/purchase_proposals/{id}/intake-lines` → `POST /api/equipment_intakes` | `equipment_intakes:write` | ✅ e2e `flow-procurement` A6 |

## Ghi tăng thiết bị (PN)

| UC | Tên | Người | Màn hình | API | Quyền | Test |
|---|---|---|---|---|---|---|
| PN-01 | Lập phiếu ghi tăng thiết bị | DongLV | `/equipment-intakes` (+ `create`, `edit/:id`) | `/api/equipment_intakes` (CRUD, `/catalog-history`, `/duplicate`), `/api/attachments` | `equipment_intakes:write` | ✅ `IntakeFormRulesTest`, `IntakeLinesExcelTest`, `VoucherFormsOtherTest`; e2e `flow-procurement` A6 |
| PN-02 | Trình phiếu ghi tăng | DongLV | `/equipment-intakes/show/:id` | `POST /api/equipment_intakes/{id}/submit` | `equipment_intakes:write` | ✅ `IntakeFormRulesTest`, `ReachedStepTest`; e2e `flow-procurement` A6 |
| PN-03 | Duyệt phiếu ghi tăng | DongLV | `/equipment-intakes/show/:id` | `POST /api/equipment_intakes/{id}/approve`, `/reject`, `/return` | `equipment_intakes:approve` | ✅ e2e `flow-procurement` A7 (sinh hồ sơ thiết bị), `flow-exceptions` E4 (trả lại, từ chối không sinh thiết bị) |

## Kiểm kê (KK)

| UC | Tên | Người | Màn hình | API | Quyền | Test |
|---|---|---|---|---|---|---|
| KK-01 | Phát động đợt kiểm kê | TuTN | `/inventory-campaigns` (+ `create`) | `/api/inventory_campaigns` | `inventory_campaigns:write` | ✅ e2e `flow-inventory` K1 |
| KK-02 | Theo dõi tiến độ kiểm kê | TuTN | `/inventory-campaigns/show/:id` | `GET /api/inventory_campaigns/{id}/progress`, `/{id}/discrepancies` | `inventory_campaigns:read` | ✅ e2e `flow-inventory` K3 |
| KK-03 | Lập phiếu kiểm kê | TuTN | `/inventory-sessions` (+ `create`) | `/api/inventory_sessions`, `GET /active` | `inventory_sessions:write` | ✅ `InventoryFreezeTest`; e2e `flow-inventory` K2 |
| KK-04 | Ghi kết quả kiểm đếm | TuTN | `/inventory-sessions/edit/:id` | `POST /api/inventory_sessions/{id}/count`, `/{id}/facility-lines/*` | `inventory_sessions:write` | ✅ e2e `flow-inventory` K2 |
| KK-05 | Trình biên bản kiểm kê | TuTN | `/inventory-sessions/show/:id` | `POST /api/inventory_sessions/{id}/submit` | `inventory_sessions:write` | ✅ `InventoryFreezeTest`; e2e `flow-inventory` K2 |
| KK-06 | Duyệt biên bản kiểm kê | TuTN | `/inventory-sessions/show/:id` | `POST /api/inventory_sessions/{id}/approve`, `/{id}/follow-ups` | `inventory_sessions:approve` | ✅ e2e `flow-inventory` K3 (thiếu → Mất), `flow-exceptions` E5 (trả lại) |
| KK-07 | Xuất biên bản kiểm kê | TuTN | `/inventory-sessions/show/:id` › In / xuất | `GET /api/voucher_forms/inventory_sessions`, `GET /api/inventory_sessions/{id}/breakdown` | `inventory_sessions:export` | ✅ `VoucherFormsOtherTest`; e2e `flow-exceptions` E5 (bảng theo phòng, in biên bản) |

## Báo cáo và bảng điều khiển (BC)

| UC | Tên | Người | Màn hình | API | Quyền | Test |
|---|---|---|---|---|---|---|
| BC-01 | Xem bảng điều khiển | QuangTD | `/dashboard` | `GET /api/reports/dashboard` | `reports:read` | ❌ |
| BC-02 | Xem báo cáo thiết bị | QuangTD | `/reports/equipment-by-school`, `-by-catalog`, `-by-status`, `-by-condition`, `/reports/equipment-list`, `/reports/equipment-ledger` | `GET /api/reports/{name}` | `reports:read` | ◐ `ReportFiltersTest` |
| BC-03 | Xem báo cáo mức đáp ứng danh mục thiết bị tối thiểu | QuangTD | `/reports/adequacy` | `GET /api/reports/adequacy` | `reports:read` | ◐ `ReportFiltersTest` |
| BC-04 | Xem báo cáo nhu cầu và kế hoạch mua sắm | QuangTD | `/reports/purchase` | `GET /api/reports/purchase` | `reports:read` | ◐ `ReportFiltersTest` |
| BC-05 | Xem báo cáo kết quả kiểm kê | QuangTD | `/reports/inventory` | `GET /api/reports/inventory` | `reports:read` | ◐ `ReportFiltersTest` |
| BC-06 | Xuất dữ liệu danh sách và báo cáo | QuangTD | nút Xuất trên danh sách và báo cáo, `/report-snapshots/show/:id` | `GET /api/reports/{name}/export`, `/api/report_snapshots`, `POST /api/activity_logs/exports` | `reports:export`, `<resource>:export` | ◐ e2e `flow-exceptions` E6 (xuất Excel 5 báo cáo qua API và nút Xuất) — chưa test xuất danh sách, bản lưu |

## Test dùng chung cho mọi UC

`PortalGateTest` (bảng cổng), `DbRowSecurityTest`, `DbRowSecurityEndpointsTest`, `SecuredRepositoryApiTest`,
`QuarantineTest` (phạm vi dòng), `RequestBodyValidatedTest`, `TriTest`, `SfemsApplicationTests` (khởi động).

## Khoảng trống cần xử lý

### 1. Độ phủ test: ✅ 28 · ◐ 14 · ❌ 4

| Người | UC chưa có test (❌) | UC mới phủ một phần (◐) |
|---|---|---|
| DongLV | HT-07 | HT-03, HT-08 |
| QuangTD | BC-01 | HT-06, BC-02, BC-03, BC-04, BC-05, BC-06 |
| TuTN | DM-04 | DM-01, DM-03 |
| HoangPND | TC-03 | TC-02, TC-04 |
| NghiaNV | — | TS-01, TS-03 |

Việc tiếp theo: CRUD danh mục và trùng mã (DM-01..04), CRUD phòng (TC-02), màn sửa hồ sơ thiết bị và tệp đính kèm
(TS-01, TS-03), đối chiếu số liệu dashboard và báo cáo với dữ liệu vừa tạo qua luồng (BC-01..05).

### 2. Chạy bộ e2e

`frontend/e2e/audit`: `security`, `validation`, `flow-procurement`, `flow-inventory`, `flow-exceptions`, `flow-school-year`,
`smoke`. Kết
quả ghi ra `frontend/e2e-audit/<bộ>.json`. Lệnh chạy và cổng mặc định ghi ở đầu `e2e/audit/lib.ts`.

### 2b. Số dư đầu kỳ và các luồng có duyệt (20/11/2026)

- Khai tay (TS-01) và nhập từ tệp (TS-07) là **số dư đầu kỳ**: chỉ làm được khi trường chưa chốt. Lãnh đạo trường bấm
  "Chốt số dư đầu kỳ" ở màn Thiết bị (quyền `equipment_intakes:approve`, bảng `school_opening_balances`, changelog
  275); chốt một lần, không mở lại. Sau đó thiết bị mới chỉ vào sổ qua phiếu ghi tăng có duyệt (PN-01..03).
- Khoá số liệu kiểm kê (KK-05) chặn cả khai tay / nhập từ tệp vào chỗ đang kiểm, không chỉ chặn phiếu.
- Mã gõ vào không theo mẫu chuẩn (tem cũ, sổ cũ, tệp nhập) giữ làm mã hiện hành; hồ sơ báo thiếu mã chuẩn và cán bộ
  bấm "Cấp mã chuẩn" (TS-05), mã cũ chuyển sang ô Mã cũ để tem cũ vẫn tra được (TS-02).
- Hồ sơ vào sổ có dòng lịch sử "Vào sổ: số dư đầu kỳ" (TS-04). Hồ sơ khai nhầm, chưa qua phiếu hay kiểm kê nào, xoá
  được khi trường chưa chốt số dư; thiết bị đang trên sổ chỉ xoá được khi kiểm kê xác nhận Mất.

### 2c. Chuẩn tối thiểu theo năm học (20/11/2026)

Thiết kế và các chỗ khác thiết kế gốc ở `docs/du-lieu-theo-nam-hoc.md`. Tóm tắt:

- Sở khai điều chỉnh cho phép trên từng dòng danh mục tối thiểu (DM-03, changelog 276): Không được phép / Giảm / Thay thế
  / Dùng chung / Chọn trong nhóm, kèm câu căn cứ của thông tư.
- Trường khai lớp, sĩ số, phân công giáo viên theo năm học (277) cho từng điểm trường; lãnh đạo trường xác nhận từng
  điểm rồi chốt năm học (278), Sở mở lại có lý do. Khởi tạo năm học mới chép lớp (lên lớp tự động), phân công, điều chỉnh.
- Mức đáp ứng (NC-01) tính theo năm học và điểm trường, hai cột theo thông tư / theo điều chỉnh; trường áp dụng điều
  chỉnh (279) có hiệu lực ngay, không qua duyệt.
- Dòng thiếu đưa vào đề xuất mua sắm nháp đúng số thiếu (NC-02, 280), mỗi dòng giữ căn cứ để kế hoạch (NC-05) truy
  ngược; đề xuất loại này chỉ trình được khi năm học đã chốt. Không có điều chuyển nội bộ (chưa có phiếu cấp phát).

### 3. Code ngoài 46 UC còn trong nhánh

| Phần | Ở đâu | Đề xuất |
|---|---|---|
| Cơ sở, khối nhà, lớp học | `/api/campuses`, `/api/buildings`, `/api/school_classes` | Ghi là một phần của TC-02 trong SRS |

Đã xử lý ngày 22/11/2026: nhân sự thành TC-03, đánh giá CSVC theo chuẩn thành TC-04, tài khoản của trường thành HT-07, luồng phê duyệt thành HT-08. Bảng của các chức năng ngoài phạm vi (cấp phát, điều chuyển, mượn – trả, báo hỏng, sửa chữa, bảo trì, thanh lý…) và danh mục học kỳ đã xoá ở changelog 285. Báo cáo ẩn ngoài phạm vi và `/api/voucher_holds` đã gỡ khỏi backend.
| Nhật ký, trạng thái hệ thống, cài đặt AI, thay đổi dữ liệu | `/api/activity_logs`, `/api/system_status`, `/api/ai_settings`, `/api/data_changes` | Controller còn, menu đã ẩn — bỏ hẳn hoặc ghi là chức năng phụ trợ |

### 4. Quyền của quản trị viên

Đã chốt lại (22/11/2026): quản trị viên chỉ cấu hình, hỗ trợ, quản trị hệ thống — HT-04, HT-05, HT-08, DM-01,
DM-04, TC-01 và các UC chung (tổng hợp, báo cáo, tra cứu thiết bị). Với dữ liệu nghiệp vụ của trường và Sở, vai
`ADMIN` chỉ giữ quyền xem, xuất (changelog 284, đảo 281); cổng Admin không có đường ghi tới chúng
(`PortalRoutes.BUSINESS_DATA`); `VoucherWorkflow` không coi quản trị viên thuộc cấp duyệt nào. Khác 272: vẫn giữ
quyền đọc nên menu Admin hiện mọi phân hệ để xem, không lỗi 403. Hồ sơ năm học: quản trị viên vẫn khởi tạo / mở
lại năm cho trường; xác nhận, chốt là của lãnh đạo trường. `RoleTypeTest`, `PortalGateTest` và e2e `security` S5
giữ phạm vi này.
