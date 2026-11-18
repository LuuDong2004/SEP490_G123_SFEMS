# Ma trận truy vết 42 UC — SFEMS

Cập nhật 16/11/2026 theo nhánh `refactor` (nền mới). Nguồn: `docs/SFEMS_Danh-sach-UC-pham-vi-do-an.xlsx` (sheet 1),
controller ở `backend/.../module`, route ở `frontend/src/app/router` và `features/catalogs/registry.ts`, bảng cổng
`PortalRoutes.java`, test ở `backend/src/test` và `frontend/e2e`.

Quy ước:

- **Màn hình**: đường dẫn trên giao diện. "Phân hệ X › Tab" là tab trong `/modules/<x>`; "Tổng quan trường › Tab" là
  tab của `/school-explorer`.
- **API**: tiền tố cổng (`/api/admin|so|school`) do `PortalRoutes` thêm, ở đây viết đường dẫn gốc `/api/...`.
- **Quyền**: mã `resource:action`. Controller kế thừa khung danh mục / phiếu kiểm theo tài nguyên của nó
  (`<resource>:read|write|delete|approve|export`).
- **Test**: ✅ có test chạm đúng UC · ◐ chỉ có test gián tiếp (luật chung, cổng, phạm vi dòng) · ❌ chưa có.

## Hệ thống, tài khoản và phân quyền (HT)

| UC | Tên | Người | Màn hình | API | Quyền | Test |
|---|---|---|---|---|---|---|
| HT-01 | Đăng nhập | DongLV | `/login`, `/forgot-password`, `/reset-password` | `POST /api/auth/login`, `/refresh`, `/forgot-password`, `/api/auth/mfa/*`, `GET /api/auth/schools` | công khai | ◐ `AdminPortalTest`, `AdminPortalMfaOffTest`, `RequestThrottleTest`; e2e `smoke` |
| HT-02 | Đăng xuất | DongLV | menu tài khoản | `POST /api/auth/logout`, `DELETE /api/auth/sessions/{id}` | đã đăng nhập | ❌ |
| HT-03 | Đổi mật khẩu cá nhân | DongLV | `/profile` | `POST /api/auth/change-password` | đã đăng nhập | ❌ |
| HT-04 | Quản lý tài khoản người dùng | DongLV | `/users` (+ `create`, `edit/:id`, `show/:id`) | `/api/users` (CRUD, `/{id}/password`, `/{id}/sessions`) | `users:read/write/delete` | ✅ `UserSubtypeTest` |
| HT-05 | Quản lý vai trò và quyền chức năng | DongLV | `/roles`, `/permissions` | `/api/roles`, `/api/permissions`, `/api/row_level_policies` | `roles:*`, `permissions:read`, `row_level_policies:*` | ✅ `RoleTypeTest`, `PolicyCompilerTest`, `ScopeAlgebraTest`, `AuthorityCacheRlsTest`, `CompilerAgreementTest` |
| HT-06 | Nhận và quản lý thông báo | QuangTD | `/notifications`, chuông trên đầu trang | `/api/notifications` (`/recent`, `/unread-count`, `/{id}/read`, `/read-all`) | đã đăng nhập | ❌ |

## Danh mục dùng chung (DM)

| UC | Tên | Người | Màn hình | API | Quyền | Test |
|---|---|---|---|---|---|---|
| DM-01 | Quản lý danh mục dùng chung | TuTN | `/catalogs` → `/units`, `/grades`, `/subjects`, `/subject-groups`, `/school-years`, `/semesters`, `/room-types`, `/facility-groups`, `/origin-sources`, `/acquisition-methods`, `/movement-reasons`, `/education-levels`, `/wards` | `/api/<danh mục>` (khung `CatalogController`) | `<danh mục>:read/write/delete` | ◐ `FieldRuleTest`, `FieldRulesExportTest` |
| DM-02 | Quản lý danh mục thiết bị | TuTN | `/equipment-catalogs`, `/equipment-types`, `/equipment-configs` | `/api/equipment_catalogs` (+ `/school-items`, `/school-items/name-check`), `/api/equipment_types`, `/api/equipment_configs` | `equipment_catalogs:*` | ✅ `CatalogNamesTest` |
| DM-03 | Quản lý danh mục TBDH tối thiểu và định mức | TuTN | `/equipment-standards`, `/equipment-minimum`, `/norm-matrix`, `/equipment-norms` | `/api/equipment_standards` (`/revise`, `/{id}/apply`, `/{id}/changes`), `/api/equipment_norms` (`/import`, `/export.xlsx`, `/batch`) | `equipment_standards:*`, `equipment_norms:*` | ◐ `AppendixParserTest` (đọc phụ lục thông tư) |
| DM-04 | Quản lý quy tắc sinh mã | TuTN | `/code-rules`, `/school-code-rules` | `/api/code_rules` (`/next`), `/api/school_code_rules` | `code_rules:*`, `school_code_rules:*` | ❌ |

## Tổ chức và cơ sở vật chất (TC)

| UC | Tên | Người | Màn hình | API | Quyền | Test |
|---|---|---|---|---|---|---|
| TC-01 | Quản lý trường học | HoangPND | `/schools`, `/school-explorer` › Hồ sơ trường | `/api/schools`, `/api/schools/{id}/logo`, `/api/school_overview`, `/api/school_profile` | `schools:*` | ✅ `SchoolShortCodesTest`, `SchoolImportNameKeyTest` |
| TC-02 | Quản lý phòng | HoangPND | Tổng quan trường › Cơ sở vật chất | `/api/rooms` (+ `/custom-types`), `/api/buildings`, `/api/campuses`, `/api/facility_info` | `rooms:*` | ❌ |

## Hồ sơ thiết bị và mã tài sản (TS)

| UC | Tên | Người | Màn hình | API | Quyền | Test |
|---|---|---|---|---|---|---|
| TS-01 | Quản lý hồ sơ thiết bị | NghiaNV | Phân hệ Thiết bị › Danh sách thiết bị | `/api/equipment` (+ `/summary`, `/summary.xlsx`), `/api/equipment_items` | `equipment:read/write/delete` | ❌ |
| TS-02 | Tra cứu thiết bị theo mã tài sản | NghiaNV | `/equipment-lookup` | `GET /api/equipment` (lọc theo mã tài sản, mã cũ) | `equipment:read` | ❌ |
| TS-03 | Đính kèm tài liệu, hình ảnh thiết bị | NghiaNV | Hồ sơ thiết bị › Tệp, ảnh | `/api/attachments` (+ `/{id}/content`, `/{id}/cover`) | quyền của bản ghi gắn tệp | ❌ |
| TS-04 | Xem lịch sử thay đổi thiết bị | NghiaNV | Hồ sơ thiết bị › Lịch sử | `GET /api/equipment/{id}/history` | `equipment:read` | ❌ |
| TS-05 | Cấp mã chuẩn cho thiết bị mang mã cũ | NghiaNV | Hồ sơ thiết bị › nút Cấp mã chuẩn | `GET /api/equipment/{id}/standard`, `POST /api/equipment/{id}/standard-code` | `equipment:write` | ❌ |
| TS-06 | Sinh mã tài sản thiết bị | NghiaNV | (gọi qua ghi tăng, cấp mã chuẩn) | `GET /api/equipment/next-code`; service sinh mã khi duyệt phiếu | — | ❌ |
| TS-07 | Nhập dữ liệu thiết bị ban đầu từ tệp | NghiaNV | `/data-imports`, `/data-imports/:id` | `/api/data_imports` (`/template`, `/sheets`, `/{id}/choices`…), `/api/data_transfer` | `data_imports:*`, `data_transfer:*` | ✅ `OnboardingParsingTest`, `OnboardingValidatorTest`, `OnboardingQuickFixTest`, `OnboardingAiServiceTest`, `SpreadsheetReaderTest` |

## Nhu cầu và kế hoạch mua sắm (NC)

| UC | Tên | Người | Màn hình | API | Quyền | Test |
|---|---|---|---|---|---|---|
| NC-01 | Xem mức đáp ứng danh mục tối thiểu | HoangPND | `/equipment-adequacy` | `GET /api/purchase_proposals/adequacy`, `/adequacy-summary`, `/adequacy-catalog`, `*.xlsx` | `purchase_proposals:read` | ❌ |
| NC-02 | Lập và trình đề xuất mua sắm | HoangPND | `/purchase-proposals` (+ `create`, `edit/:id`) | `/api/purchase_proposals` (CRUD, `/{id}/submit`, `/overlaps`) | `purchase_proposals:write` | ◐ `ReachedStepTest` (bước duyệt chung) |
| NC-03 | Duyệt đề xuất cấp trường | HoangPND | `/purchase-proposals/show/:id` | `POST /api/purchase_proposals/{id}/approve`, `/reject`, `/return` | `purchase_proposals:approve` | ◐ `ReachedStepTest` |
| NC-04 | Duyệt đề xuất cấp Sở | HoangPND | như NC-03, tài khoản Sở | như NC-03 (bước 2 của luồng duyệt) | `purchase_proposals:approve` | ◐ `ReachedStepTest` |
| NC-05 | Lập kế hoạch mua sắm | HoangPND | `/procurement-plans` (+ `create`, `edit/:id`) | `/api/procurement_plans` (CRUD, `/candidates`, `/{id}/submit`) | `procurement_plans:write` | ❌ |
| NC-06 | Duyệt kế hoạch mua sắm | HoangPND | `/procurement-plans/show/:id` | `POST /api/procurement_plans/{id}/approve`, `/reject` | `procurement_plans:approve` | ❌ |
| NC-07 | Lập phiếu nhập từ đề xuất đã hoàn tất | HoangPND | đề xuất đã duyệt › Lập phiếu nhập | `GET /api/purchase_proposals/{id}/intake-lines` → `POST /api/equipment_intakes` | `equipment_intakes:write` | ❌ |

## Nhập thiết bị – ghi tăng tài sản (PN)

| UC | Tên | Người | Màn hình | API | Quyền | Test |
|---|---|---|---|---|---|---|
| PN-01 | Lập phiếu nhập thiết bị | DongLV | `/equipment-intakes` (+ `create`, `edit/:id`) | `/api/equipment_intakes` (CRUD, `/catalog-history`, `/duplicate`), `/api/attachments` | `equipment_intakes:write` | ✅ `IntakeFormRulesTest`, `IntakeLinesExcelTest`, `VoucherFormsOtherTest` |
| PN-02 | Trình phiếu nhập | DongLV | `/equipment-intakes/show/:id` | `POST /api/equipment_intakes/{id}/submit` | `equipment_intakes:write` | ◐ `IntakeFormRulesTest` (luật trình), `ReachedStepTest` |
| PN-03 | Duyệt phiếu nhập và ghi tăng tài sản | DongLV | `/equipment-intakes/show/:id` | `POST /api/equipment_intakes/{id}/approve`, `/reject`, `/return` | `equipment_intakes:approve` | ❌ (chưa có test sinh tài sản khi duyệt) |

## Kiểm kê (KK)

| UC | Tên | Người | Màn hình | API | Quyền | Test |
|---|---|---|---|---|---|---|
| KK-01 | Phát động đợt kiểm kê | TuTN | `/inventory-campaigns` (+ `create`) | `/api/inventory_campaigns` | `inventory_campaigns:write` | ❌ |
| KK-02 | Theo dõi tiến độ kiểm kê | TuTN | `/inventory-campaigns/show/:id` | `GET /api/inventory_campaigns/{id}/progress`, `/{id}/discrepancies` | `inventory_campaigns:read` | ❌ |
| KK-03 | Lập phiếu kiểm kê | TuTN | `/inventory-sessions` (+ `create`) | `/api/inventory_sessions`, `GET /active` | `inventory_sessions:write` | ◐ `InventoryFreezeTest` (khoá số liệu) |
| KK-04 | Ghi kết quả kiểm đếm | TuTN | `/inventory-sessions/edit/:id` | `POST /api/inventory_sessions/{id}/count`, `/{id}/facility-lines/*` | `inventory_sessions:write` | ❌ |
| KK-05 | Trình biên bản kiểm kê | TuTN | `/inventory-sessions/show/:id` | `POST /api/inventory_sessions/{id}/submit` | `inventory_sessions:write` | ◐ `InventoryFreezeTest` |
| KK-06 | Duyệt biên bản kiểm kê | TuTN | `/inventory-sessions/show/:id` | `POST /api/inventory_sessions/{id}/approve`, `/{id}/follow-ups` | `inventory_sessions:approve` | ❌ |
| KK-07 | Xuất biên bản kiểm kê | TuTN | `/inventory-sessions/show/:id` › In / xuất | `GET /api/voucher_forms/inventory_sessions`, `GET /api/inventory_sessions/{id}/breakdown` | `inventory_sessions:export` | ◐ `VoucherFormsOtherTest` |

## Báo cáo và bảng điều khiển (BC)

| UC | Tên | Người | Màn hình | API | Quyền | Test |
|---|---|---|---|---|---|---|
| BC-01 | Xem bảng điều khiển | QuangTD | `/dashboard` | `GET /api/reports/dashboard` | `reports:read` | ❌ |
| BC-02 | Báo cáo tài sản thiết bị | QuangTD | `/reports/equipment-by-school`, `-by-catalog`, `-by-status`, `-by-condition`, `/reports/equipment-list`, `/reports/equipment-ledger` | `GET /api/reports/{name}` | `reports:read` | ◐ `ReportFiltersTest` |
| BC-03 | Báo cáo mức đáp ứng danh mục tối thiểu | QuangTD | `/reports/adequacy` | `GET /api/reports/adequacy` | `reports:read` | ◐ `ReportFiltersTest` |
| BC-04 | Báo cáo nhu cầu và kế hoạch mua sắm | QuangTD | `/reports/purchase` | `GET /api/reports/purchase` | `reports:read` | ◐ `ReportFiltersTest` |
| BC-05 | Báo cáo kết quả kiểm kê | QuangTD | `/reports/inventory` | `GET /api/reports/inventory` | `reports:read` | ◐ `ReportFiltersTest` |
| BC-06 | Xuất dữ liệu danh sách và báo cáo | QuangTD | nút Xuất trên danh sách và báo cáo, `/report-snapshots/show/:id` | `GET /api/reports/{name}/export`, `/api/report_snapshots`, `POST /api/activity_logs/exports` | `reports:export`, `<resource>:export` | ❌ |

## Test dùng chung cho mọi UC

`PortalGateTest` (bảng cổng), `DbRowSecurityTest`, `DbRowSecurityEndpointsTest`, `SecuredRepositoryApiTest`,
`QuarantineTest` (phạm vi dòng), `RequestBodyValidatedTest`, `TriTest`, `SfemsApplicationTests` (khởi động).

## Khoảng trống cần xử lý

### 1. UC chưa có test (❌): 23 / 42

| Người | UC chưa có test |
|---|---|
| DongLV | HT-02, HT-03, PN-03 |
| QuangTD | HT-06, BC-01, BC-06 |
| TuTN | DM-04, KK-01, KK-02, KK-04, KK-06 |
| HoangPND | TC-02, NC-01, NC-05, NC-06, NC-07 |
| NghiaNV | TS-01, TS-02, TS-03, TS-04, TS-05, TS-06 |

Mỗi người viết ít nhất một test tích hợp cho luồng chính của từng UC mình phụ trách (gọi API qua cổng đúng loại tài
khoản, kiểm quyền và kết quả trong CSDL). UC có luồng duyệt (NC-03/04/06, PN-03, KK-06) cần thêm ca bị từ chối và
ca không đủ quyền.

### 2. Test e2e còn của chức năng đã bỏ

`frontend/e2e/flows.spec.ts` kiểm cấp phát và đề nghị ghi giảm của UBND; `lists.spec.ts` kiểm danh sách báo hỏng —
đều ngoài phạm vi, sẽ đỏ. Cần viết lại theo luồng của đồ án: đề xuất → duyệt trường → duyệt Sở → kế hoạch → ghi tăng →
kiểm kê.

### 3. Code ngoài 42 UC còn trong nhánh

| Phần | Ở đâu | Đề xuất |
|---|---|---|
| Đánh giá CSVC theo chuẩn, Nhân sự | Tổng quan trường, `/api/facility-standard`, `/api/staff` | Thêm UC (ví dụ TC-03, TC-04) vào SRS hoặc ẩn |
| Cơ sở, khối nhà, lớp học | `/api/campuses`, `/api/buildings`, `/api/school_classes` | Ghi là một phần của TC-02 trong SRS |
| Tài khoản của trường (`school_users`) | `/school-users` | HT-04 chỉ giao quản trị viên — chốt giữ hay bỏ |
| Luồng duyệt cấu hình được | `/approval-flows` | Ghi vào HT-05 hoặc ẩn |
| Nhật ký, trạng thái hệ thống, cài đặt AI, thay đổi dữ liệu | `/api/activity_logs`, `/api/system_status`, `/api/ai_settings`, `/api/data_changes` | Controller còn, menu đã ẩn — bỏ hẳn hoặc ghi là chức năng phụ trợ |

### 4. Quyền của quản trị viên

`PortalRoutes` mở cho cổng Admin mọi chức năng; tài liệu G123 giao quản trị viên HT-04, HT-05, DM-01..04, TC-01. Chốt
một cách rồi sửa cả code (mã quyền của vai `ADMIN`) lẫn SRS §4.4, §5.1.
