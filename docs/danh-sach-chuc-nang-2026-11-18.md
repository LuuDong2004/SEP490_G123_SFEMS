# Danh sách và đánh giá chức năng SFEMS — 18/11/2026

Nguồn để viết lại tài liệu từ đầu. Quét theo **code đang có** (nhánh `refactor`, commit `3fd273c`), không theo tài liệu cũ:
menu và route ở `frontend/src/app/resources`, `features/catalogs/registry.ts`; 72 controller ở `backend/.../module`;
bảng cổng `PortalRoutes.java`; test ở `backend/src/test`, `frontend/e2e`. Đối chiếu 42 UC
(`SFEMS_Danh-sach-UC-pham-vi-do-an.xlsx`), ma trận `ma-tran-truy-vet-uc.md` và mục "Ngoài phạm vi" của `AGENTS.md`.

## Cách đọc

| Ký hiệu | Nghĩa |
|---|---|
| **Đạt** | Có màn hình + API, đã chạy thử trên giao diện ngày 18/11 hoặc có test đúng chức năng |
| **Có** | Có màn hình + API, chưa có bằng chứng chạy đúng (chưa test, chưa chạy thử) |
| **Một phần** | Thiếu màn hình, hoặc chỉ là phần phụ của chức năng khác |
| **Lệch** | Code có nhưng tài liệu ghi ngoài phạm vi, hoặc chưa có UC nào nhận |

Cột **UC**: mã trong 42 UC; `—` = chưa UC nào nhận.

---

## 1. Tài khoản, đăng nhập, phân quyền

| # | Chức năng | Màn hình | API | UC | Đánh giá | Ghi chú |
|---|---|---|---|---|---|---|
| 1.1 | Đăng nhập (một màn cho mọi loại tài khoản, tự vào đúng cổng) | `/login` | `/api/auth/login`, `/refresh` | HT-01 | **Đạt** | Chạy thử 18/11; test `AdminPortalTest` |
| 1.2 | Chọn trường ở màn đăng nhập (gõ không dấu) | `/login` | `GET /api/auth/schools` | HT-01 | **Đạt** | Nhận trường theo tiền tố tên đăng nhập |
| 1.3 | Quên mật khẩu, đặt lại qua link email | `/forgot-password`, `/reset-password` | `/api/auth/forgot-password`, `/reset-password` | HT-01 | **Đạt** | Link một lần, hạn 30 phút |
| 1.4 | Đăng xuất, đăng xuất phiên khác | menu tài khoản | `/api/auth/logout`, `/sessions/{id}` | HT-02 | **Có** | Chưa test |
| 1.5 | Đổi mật khẩu cá nhân, hồ sơ cá nhân | `/profile` | `/api/auth/change-password` | HT-03 | **Có** | Chưa test |
| 1.6 | Quản lý người dùng (thêm, sửa, khoá, đặt lại mật khẩu, xem phiên) | `/users` | `/api/users` | HT-04 | **Đạt** | Chạy thử 18/11; test `UserSubtypeTest` |
| 1.7 | **Thư mời tự đặt mật khẩu** khi tạo tài khoản (để trống mật khẩu) | `/users/create`, `/reset-password?invite=1` | `POST /api/users` | HT-04 | **Đạt** | Mới 18/11. Cần khai `spring.mail.*` để gửi thật |
| 1.8 | Quản lý vai trò, gán quyền chức năng | `/roles`, `/permissions` | `/api/roles`, `/api/permissions` | HT-05 | **Đạt** | Test `RoleTypeTest` |
| 1.9 | Phạm vi dữ liệu theo vai trò (row-level) | (ẩn) | `/api/row_level_policies` | HT-05 | **Lệch** | AGENTS: "phạm vi dữ liệu của vai trò" ngoài phạm vi; nhưng là nền của phân quyền theo trường |
| 1.10 | Xác thực hai lớp (ứng dụng / email) | màn bật 2 lớp hiện thay mọi màn khi quản trị viên chưa bật; mục 2 lớp ở `/profile` | `/api/auth/mfa/*` | — | **Lệch** | AGENTS: ngoài phạm vi. Code còn, cổng Admin dùng khi bật |
| 1.11 | Tài khoản của trường (lãnh đạo trường cấp tài khoản cấp dưới) | `/school-users` | `/api/school_users` | — | **Lệch** | AGENTS: ngoài phạm vi. Đang dùng thật (cấp tài khoản cán bộ) |
| 1.12 | Cấp tài khoản cho cán bộ từ danh sách nhân sự | Tổng quan trường › Nhân sự | `/api/staff/{id}/account` | — | **Lệch** | Chạy thử 18/11 (có thư mời). Chưa UC nào nhận |
| 1.13 | Phạm vi theo cơ sở (tài khoản chỉ thấy một cơ sở) | ô Phạm vi khi cấp tài khoản | `user_schools.campus_id` | — | **Lệch** | Chạy thử 18/11 đúng. AGENTS: "cơ sở – điểm trường" ngoài phạm vi |

## 2. Danh mục dùng chung

| # | Chức năng | Màn hình | UC | Đánh giá | Ghi chú |
|---|---|---|---|---|---|
| 2.1 | Danh mục tổ chức và CSVC: Phường/Xã, Khối CSVC, Loại CSVC | `/wards`, `/facility-groups`, `/room-types` | DM-01 | **Có** | Test gián tiếp `FieldRuleTest` |
| 2.2 | Năm học và môn học: Năm học, Học kỳ, Khối lớp, Tổ chuyên môn, Môn học, Cấp học | `/school-years`, `/semesters`, `/grades`, `/subject-groups`, `/subjects`, `/education-levels` | DM-01 | **Có** | |
| 2.3 | Tài chính: Nguồn hình thành, Hình thức mua sắm, Lý do biến động | `/origin-sources`, `/acquisition-methods`, `/movement-reasons` | DM-01 | **Có** | |
| 2.4 | Danh mục cố định (chỉ đọc): Loại tài sản, Mục đích sử dụng, Nguồn kinh phí, Chức vụ cán bộ… | `/asset-categories`, `/usage-purposes`, `/funding-sources`, `/staff-positions`… | DM-01 | **Có** | Phần lớn chỉ là lựa chọn trong ô chọn |
| 2.5 | Danh mục thiết bị, Loại thiết bị, Đơn vị tính, Bộ thông số kỹ thuật | `/equipment-catalogs`, `/equipment-types`, `/units`, `/equipment-configs` | DM-02 | **Đạt** | Test `CatalogNamesTest`; ~1.700 mục, 3 cấp học |
| 2.6 | Danh mục thiết bị dạy học tối thiểu (theo ngày hiệu lực) | `/equipment-standards`, `/equipment-norms` | DM-03 | **Có** | Test gián tiếp `AppendixParserTest` (đọc phụ lục thông tư) |
| 2.7 | Văn bản căn cứ (thông tư, quyết định) | `/legal-documents` | DM-03 | **Một phần** | Mới trên `refactor`; phụ trợ cho DM-03 |
| 2.8 | Chuẩn CSVC (quy tắc đánh giá phòng, diện tích) | `/facility-standard-rules` | — | **Lệch** | Chưa UC nào nhận |
| 2.9 | Quy tắc sinh mã: danh mục chung, của trường (phòng, khối nhà, cơ sở, cán bộ) | `/code-rules`, `/school-code-rules` | DM-04 | **Có** | Chưa test. Đã sửa lỗi form sửa ghi đè mã (18/11) |

## 3. Trường học và cơ sở vật chất

| # | Chức năng | Màn hình | API | UC | Đánh giá | Ghi chú |
|---|---|---|---|---|---|---|
| 3.1 | Danh sách trường, cơ quan quản lý (Sở) | `/schools`, `/departments-of-education` | `/api/schools`, `/api/departments_of_education` | TC-01 | **Đạt** | Test `SchoolShortCodesTest` |
| 3.2 | Tổng quan trường › Hồ sơ trường (thông tin, ảnh, ban giám hiệu, cơ sở, số liệu chung CSVC) | `/school-explorer` | `/api/school_overview`, `/api/school_profile`, `/api/facility_info` | TC-01 | **Đạt** | Chạy thử 18/11. Đã sửa lỗi 500 khi trường chưa có lớp. AGENTS ghi "tổng quan một trường" ngoài phạm vi — **mâu thuẫn**, cần chốt |
| 3.3 | Phòng, khối nhà, cơ sở – điểm trường | Tổng quan trường › Cơ sở vật chất | `/api/rooms`, `/api/buildings`, `/api/campuses` | TC-02 | **Đạt** | Chạy thử 18/11; chưa có test tự động. AGENTS: khối nhà, cơ sở là "dữ liệu nền, không có màn quản lý" — nhưng đã có màn |
| 3.4 | Lớp học (sĩ số, GVCN, phòng học) | trong Tổng quan trường | `/api/school_classes` | — | **Lệch** | Dữ liệu nền cho số liệu CSVC |
| 3.5 | Nhân sự: cán bộ, giáo viên, tổ bộ môn, chức vụ | Tổng quan trường › Nhân sự | `/api/staff`, `/api/subject_teams` | — | **Lệch** | Chạy thử 18/11. AGENTS: "quản lý cán bộ" ngoài phạm vi |
| 3.6 | Đánh giá CSVC theo chuẩn | Tổng quan trường › Đánh giá CSVC | `/api/facility-standard` | — | **Lệch** | Ma trận đề xuất thành UC mới (TC-03) |
| 3.7 | Việc cần làm của trường (thiếu thông tin) | Tổng quan trường | `/api/facility_todo` | — | **Một phần** | Phụ trợ |

## 4. Thiết bị

| # | Chức năng | Màn hình | API | UC | Đánh giá | Ghi chú |
|---|---|---|---|---|---|---|
| 4.1 | Hồ sơ thiết bị (danh sách, xem, sửa, tổng hợp, xuất Excel) | Thiết bị › Danh sách thiết bị | `/api/equipment`, `/api/equipment_items` | TS-01 | **Có** | Chưa test |
| 4.2 | Tra cứu thiết bị theo mã tài sản, mã cũ | `/equipment-lookup` (ẩn menu, mở từ nút) | `GET /api/equipment` | TS-02 | **Có** | Màn này cũng là đích của tem QR — AGENTS: "QR / in tem" ngoài phạm vi |
| 4.3 | Đính kèm tệp, ảnh (ảnh bìa, cắt ảnh) | Hồ sơ thiết bị › Tệp, ảnh | `/api/attachments` | TS-03 | **Có** | Cần MinIO; máy dev chưa chạy MinIO |
| 4.4 | Lịch sử thay đổi thiết bị | Hồ sơ thiết bị › Lịch sử | `/api/equipment/{id}/history` | TS-04 | **Có** | |
| 4.5 | Cấp mã chuẩn cho thiết bị mang mã cũ | nút Cấp mã chuẩn | `/api/equipment/{id}/standard-code` | TS-05 | **Có** | |
| 4.6 | Sinh mã tài sản | (gọi khi ghi tăng, cấp mã chuẩn) | `/api/equipment/next-code` | TS-06 | **Có** | Mã dạng `79.7S.00.TB.001.22` — chạy đúng khi nhập 18/11 |
| 4.7 | **Nhập dữ liệu đầu vào từ tệp** (6 trang: cơ sở, cán bộ, khối nhà, phòng, lớp, thiết bị; vùng chờ, sửa trên lưới, Sửa nhanh, AI gợi ý, ghi, hoàn tác) | `/data-imports` | `/api/data_imports` | TS-07 | **Đạt** | E2E trọn luồng 9/9 (18/11); 5 test backend. Đã sửa: nhập lại tạo trùng thiết bị, ô chọn xoá trắng |
| 4.8 | Nhập danh mục (trường, phường xã) từ tệp | `/data-imports` (tab danh mục) | `/api/data_imports?kind=` | TS-07 | **Có** | Việc của Sở / quản trị |
| 4.9 | Chuẩn tối thiểu của từng trường (đối chiếu thiết bị đang có) | Thiết bị › Chuẩn tối thiểu, `/equipment-minimum` | `/api/purchase_proposals/adequacy-catalog` | NC-01 | **Có** | |

## 5. Mua sắm

| # | Chức năng | Màn hình | API | UC | Đánh giá | Ghi chú |
|---|---|---|---|---|---|---|
| 5.1 | Định mức và nhu cầu (mức đáp ứng, loại còn thiếu, xuất Excel) | Mua sắm › Định mức & nhu cầu | `/api/purchase_proposals/adequacy*` | NC-01 | **Có** | Chưa test |
| 5.2 | Lập, trình đề xuất mua sắm (chi tiết thêm của dòng, kiểm trùng) | Mua sắm › Đề xuất mua sắm | `/api/purchase_proposals`, `/overlaps` | NC-02 | **Có** | Test gián tiếp `ReachedStepTest` |
| 5.3 | Duyệt đề xuất cấp trường | xem đề xuất | `/{id}/approve`, `/reject`, `/return` | NC-03 | **Có** | Luồng duyệt chung |
| 5.4 | Duyệt đề xuất cấp Sở | như trên, tài khoản Sở | như trên (bước 2) | NC-04 | **Có** | |
| 5.5 | Lập kế hoạch mua sắm (gom đề xuất, đơn giá dự toán) | Mua sắm › Kế hoạch mua sắm | `/api/procurement_plans`, `/candidates` | NC-05 | **Có** | Chưa test |
| 5.6 | Duyệt kế hoạch mua sắm | xem kế hoạch | `/{id}/approve`, `/return` | NC-06 | **Có** | Chưa test |
| 5.7 | Lập phiếu nhập từ đề xuất đã hoàn tất | đề xuất › Lập phiếu nhập | `/{id}/intake-lines`, `/{id}/intake` | NC-07 | **Có** | Chưa test |

## 6. Ghi tăng (phiếu nhập)

| # | Chức năng | Màn hình | UC | Đánh giá | Ghi chú |
|---|---|---|---|---|---|
| 6.1 | Lập phiếu nhập (dòng thiết bị, nhập dòng từ Excel, đính kèm, nhân bản, cách mua cho cả phiếu) | Thiết bị › Ghi tăng | PN-01 | **Đạt** | Test `IntakeFormRulesTest`, `IntakeLinesExcelTest` |
| 6.2 | Trình phiếu nhập | xem phiếu | PN-02 | **Có** | Test gián tiếp |
| 6.3 | Duyệt phiếu, ghi tăng tài sản (sinh hồ sơ, mã) | xem phiếu | PN-03 | **Có** | Chưa có test sinh tài sản khi duyệt |
| 6.4 | In phiếu theo mẫu | xem phiếu › In | PN-01 | **Có** | `/api/voucher_forms` |

## 7. Kiểm kê

| # | Chức năng | Màn hình | UC | Đánh giá | Ghi chú |
|---|---|---|---|---|---|
| 7.1 | Phát động đợt kiểm kê (Sở) | Thiết bị › Đợt kiểm kê | KK-01 | **Có** | Chưa test |
| 7.2 | Theo dõi tiến độ, chênh lệch | xem đợt | KK-02 | **Có** | Chưa test |
| 7.3 | Lập phiếu kiểm kê (theo trường / theo cơ sở) | Thiết bị › Kiểm kê | KK-03 | **Có** | Test `InventoryFreezeTest` (khoá số liệu khi đang kiểm) |
| 7.4 | Ghi kết quả kiểm đếm (thiết bị, CSVC) | sửa phiếu | KK-04 | **Có** | Chưa test |
| 7.5 | Trình biên bản | xem phiếu | KK-05 | **Có** | |
| 7.6 | Duyệt biên bản, việc cần làm sau kiểm kê | xem phiếu | KK-06 | **Có** | Chưa test |
| 7.7 | Xuất biên bản | In / xuất | KK-07 | **Có** | Test gián tiếp `VoucherFormsOtherTest` |

## 8. Báo cáo

| # | Chức năng | Màn hình | UC | Đánh giá | Ghi chú |
|---|---|---|---|---|---|
| 8.1 | Bảng điều khiển theo cấp người xem | `/dashboard` | BC-01 | **Có** | Chưa test |
| 8.2 | Báo cáo tài sản: theo trường, danh mục, trạng thái, tình trạng; danh sách; sổ tài sản | `/reports/equipment-*` | BC-02 | **Có** | Test gián tiếp `ReportFiltersTest` |
| 8.3 | Báo cáo mức đáp ứng danh mục tối thiểu | `/reports/adequacy` | BC-03 | **Có** | |
| 8.4 | Báo cáo nhu cầu và kế hoạch mua sắm | `/reports/purchase` | BC-04 | **Có** | |
| 8.5 | Báo cáo kết quả kiểm kê | `/reports/inventory` | BC-05 | **Có** | |
| 8.6 | Xuất dữ liệu danh sách và báo cáo, ảnh chụp báo cáo | nút Xuất, `/report-snapshots` | BC-06 | **Có** | Chưa test |
| 8.7 | Báo cáo chuẩn CSVC | `/reports/facility-standard` | — | **Lệch** | Đi cùng 3.6 |

## 9. Hệ thống và hạ tầng dùng chung

| # | Chức năng | Màn hình | UC | Đánh giá | Ghi chú |
|---|---|---|---|---|---|
| 9.1 | Thông báo (chuông, danh sách, đánh dấu đã đọc) | `/notifications` | HT-06 | **Có** | Chưa test |
| 9.2 | Cấu hình luồng phê duyệt theo loại phiếu | `/approval-flows` | — | **Lệch** | Ma trận đề xuất ghi vào HT-05 |
| 9.3 | Khung phiếu dùng chung: trình, duyệt, trả lại, giữ chỗ, liên kết phiếu, lịch sử phiếu | (trong từng phiếu) | NC, PN, KK | **Một phần** | Nền cho mọi luồng duyệt |
| 9.4 | Xuất toàn bộ dữ liệu | (Quản trị) | — | **Lệch** | `/api/data_transfer` |
| 9.5 | Nhật ký hoạt động, nhật ký xuất | (ẩn menu) | — | **Lệch** | AGENTS: ngoài phạm vi; controller còn |
| 9.6 | Trạng thái hệ thống, cài đặt AI, thay đổi dữ liệu | (ẩn menu) | — | **Lệch** | Ma trận đề xuất bỏ hẳn hoặc ghi phụ trợ |
| 9.7 | Trang "Quy trình" của phân hệ Thiết bị, Mua sắm (sơ đồ ai làm, ai duyệt) | tab Quy trình | — | **Một phần** | Hướng dẫn trên màn hình |
| 9.8 | Tài khoản dùng thử ở màn đăng nhập (bản dev) | `/login` | — | **Một phần** | Chỉ bản dev; bản chính thức tự khoá tài khoản demo |

---

## Tổng hợp

| Nhóm | Số chức năng | Đạt | Có | Một phần | Lệch |
|---|---|---|---|---|---|
| 1. Tài khoản, phân quyền | 13 | 6 | 2 | 0 | 5 |
| 2. Danh mục | 9 | 1 | 6 | 1 | 1 |
| 3. Trường, CSVC | 7 | 3 | 0 | 1 | 3 |
| 4. Thiết bị | 9 | 1 | 8 | 0 | 0 |
| 5. Mua sắm | 7 | 0 | 7 | 0 | 0 |
| 6. Ghi tăng | 4 | 1 | 3 | 0 | 0 |
| 7. Kiểm kê | 7 | 0 | 7 | 0 | 0 |
| 8. Báo cáo | 7 | 0 | 6 | 0 | 1 |
| 9. Hệ thống | 8 | 0 | 1 | 3 | 4 |
| **Cộng** | **71** | **12** | **40** | **5** | **14** |

**Đối chiếu 42 UC:** cả 42 UC đều có màn hình và API. Có bằng chứng chạy đúng (Đạt) mới ở 8 UC: HT-01, HT-04,
HT-05, DM-02, TC-01, TC-02, TS-07, PN-01. Còn 34 UC ở mức "Có".

**Code vượt tài liệu:** 14 chức năng "Lệch" — phần lớn rơi vào danh sách *ngoài phạm vi* của `AGENTS.md` nhưng code
vẫn chạy và có cái đang được dùng thật (tài khoản của trường, cấp tài khoản cán bộ, phạm vi theo cơ sở, nhân sự,
đánh giá CSVC).

## 71 chức năng không phải 71 UC

71 là số **chức năng nhỏ**; một UC có thể ứng với vài dòng (HT-01 = 3 dòng, DM-01 = 4 dòng). Trong 71 dòng:

- **55 dòng** thuộc 42 UC cũ — chỉ là tách nhỏ, không thêm UC.
- **16 dòng** chưa UC nào nhận (cột UC ghi `—`). Gom lại chỉ thành khoảng **4–5 UC mới**, tổng khoảng 46–47 UC:

| UC có thể thêm | Gồm các dòng |
|---|---|
| Quản lý nhân sự trường (cán bộ, tổ bộ môn, chức vụ) | 3.5 |
| Tài khoản của trường (cấp tài khoản cán bộ, phạm vi theo cơ sở) | 1.11, 1.12, 1.13 |
| Đánh giá CSVC theo chuẩn (danh mục chuẩn, đánh giá, báo cáo) | 2.8, 3.6, 8.7 |
| Cấu hình luồng phê duyệt | 9.2 |
| Gộp vào TC-02, không thành UC riêng: lớp học, việc cần làm của trường | 3.4, 3.7 |
| Ghi là phụ trợ hoặc bỏ: hai lớp, nhật ký, trạng thái hệ thống, AI, xuất toàn bộ dữ liệu, trang Quy trình, tài khoản dùng thử | 1.10, 9.4–9.8 |

## Việc cần chốt khi viết lại tài liệu

1. **Nhóm "Lệch": đưa vào hay bỏ.** Gợi ý theo mức đang dùng:
   - Nên đưa vào UC: tổng quan trường (3.2), cơ sở – khối nhà – lớp như phần của TC-02 (3.3, 3.4), nhân sự (3.5),
     tài khoản của trường và cấp tài khoản cán bộ (1.11, 1.12), phạm vi theo cơ sở (1.13), luồng phê duyệt (9.2).
   - Có thể thêm UC mới: đánh giá CSVC theo chuẩn + báo cáo (2.8, 3.6, 8.7).
   - Nên ghi là phụ trợ hoặc ẩn: hai lớp (1.10), nhật ký, trạng thái hệ thống, AI, thay đổi dữ liệu (9.5, 9.6),
     xuất toàn bộ dữ liệu (9.4).
2. **Mâu thuẫn trong tài liệu hiện tại:** `AGENTS.md` ghi "tổng quan một trường", "cơ sở – điểm trường", "khối nhà"
   ngoài phạm vi và "không có màn quản lý", trong khi ma trận đặt TC-01, TC-02 trên chính màn Tổng quan trường.
3. **Quyền quản trị viên:** cổng Admin mở mọi chức năng; tài liệu cũ chỉ giao HT-04, HT-05, DM-01..04, TC-01.
4. **Kiểm chứng:** 23 UC chưa có test; `e2e/flows.spec.ts`, `lists.spec.ts` còn kiểm chức năng đã bỏ.
