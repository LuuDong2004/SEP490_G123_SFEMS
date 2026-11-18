# Kịch bản test E2E — Trường mới được cấp tài khoản, tự nhập dữ liệu đầu vào

**Bối cảnh:** Trường **THCS Thanh Bình** (mã `THCSTHANHBINH`) đã có trong danh sách trường của Sở nhưng **chưa có gì**:
không tài khoản, không cơ sở, không khối nhà, phòng, cán bộ, lớp, thiết bị. Trường được cấp tài khoản rồi dùng
**Nhập dữ liệu đầu vào** (`/data-imports`) để đưa toàn bộ CSVC lên hệ thống.

**Mục tiêu:** đi trọn một vòng — cấp tài khoản → tải mẫu → nhập tệp → bộ kiểm bắt lỗi → sửa → ghi → dữ liệu hiện
đúng ở các màn → phân quyền theo cơ sở hoạt động → hoàn tác được.

## Tệp trong thư mục này

| Tệp | Dùng khi |
|---|---|
| `THCS-Thanh-Binh_1-co-loi.xlsx` | Luồng chính. Cài sẵn 8 lỗi để test bước kiểm tra và sửa. |
| `THCS-Thanh-Binh_2-sach.xlsx` | Cùng dữ liệu, không lỗi. Dùng khi chỉ cần đi nhanh tới bước ghi. |

Cả hai làm từ đúng tệp mẫu hệ thống phát ra (`GET /data_imports/template`), đã chạy thử trên máy ngày 18/11/2026.

**Nội dung dữ liệu** (giống nhau ở hai tệp):

| Trang | Số dòng | Ghi chú |
|---|---|---|
| Cơ sở | 2 | `CS1` Cơ sở chính, `CS2` Điểm trường Ấp 3 |
| Cán bộ – giáo viên | 14 | 6 cán bộ (HT, PHT, 2 CB thiết bị, thư viện, kế toán) + 8 giáo viên, 4 tổ |
| Khối nhà | 4 | `KA` 3 tầng, `KB` 2 tầng, `NDN` (CS1); `KC` 2 tầng (CS2) |
| Phòng | 18 | 6 phòng học + 3 PHBM + thư viện, kho TB, HT, VP, nhà đa năng, sân (CS1); 2 phòng học + kho TB (CS2) |
| Lớp học | 8 | Năm học 2026-2027; 6 lớp ở CS1, `6A3` và `7A3` ở CS2 |
| Thiết bị | 22 | Có thiết bị từng cái kèm serial, khai gộp số lượng, hoá chất theo gam, 1 thiết bị ngoài danh mục, 1 ở trong kho |

## Tài khoản dùng trong kịch bản

| Vai | Tài khoản | Ghi chú |
|---|---|---|
| Quản trị | `admin` | Tạo tài khoản đầu tiên cho trường |
| Lãnh đạo trường | `thanhbinh.hieutruong` | Tạo ở bước 1 |
| Cán bộ thiết bị | `thanhbinh.canbo` | Tạo ở bước 1, phạm vi **Cả trường** (trường chưa có cơ sở nào để chọn) |
| Cán bộ CS2 | `thanhbinh.ap3` | Lãnh đạo trường cấp ở bước 6, phạm vi **Điểm trường Ấp 3** |

Tiền tố `thanhbinh.` là bắt buộc: ô chọn trường ở màn đăng nhập nhận ra trường theo tiền tố tên đăng nhập.

---

## Bước 0 — Kiểm tra trạng thái ban đầu

1. Đăng nhập `so.chuyenvien` → Trường học → tìm "Thanh Bình" → mở **THCS Thanh Bình**.
2. **Mong đợi:**
   - Tab Cơ sở vật chất và Nhân sự đều `0`.
   - Khối "Cơ sở, điểm trường" và "Số liệu chung CSVC" hiện **"Chưa có"**, không quay "Đang tải…" mãi (lỗi 500 đã sửa ở `FacilityInfoController`).

## Bước 1 — Cấp tài khoản cho trường (Quản trị)

1. Đăng nhập `admin` → Quản trị → Tài khoản → **Thêm**.
2. Tạo `thanhbinh.hieutruong`: loại Trường, trường THCS Thanh Bình, chức vụ Lãnh đạo, vai trò **Lãnh đạo trường**.
3. Tạo `thanhbinh.canbo`: cùng trường, chức vụ Cán bộ, vai trò **Cán bộ thiết bị - CSVC trường**.
4. **Mong đợi:**
   - Ở màn đăng nhập, gõ "thanh binh" (không dấu) vào ô chọn trường → hiện THCS Thanh Bình.
   - Hai tài khoản đăng nhập được.

## Bước 2 — Tải tệp mẫu (Cán bộ trường)

1. Đăng nhập `thanhbinh.canbo` → **Nhập dữ liệu đầu vào** → tải tệp mẫu.
2. **Mong đợi:**
   - Tệp có 6 trang theo đúng thứ tự: Cơ sở → Cán bộ – giáo viên → Khối nhà → Phòng → Lớp học → Thiết bị.
   - Cột bắt buộc có `(*)`; dòng ngay dưới tiêu đề là hướng dẫn.

## Bước 3 — Nhập tệp có lỗi

1. Tải lên `THCS-Thanh-Binh_1-co-loi.xlsx`.
2. **Mong đợi:** lô ở trạng thái **Nháp**, báo **10 lỗi** và 5 cảnh báo. Lô chưa sửa hết lỗi thì không ghi được.

| Trang | Dòng | Lỗi cài sẵn | Hệ thống báo | Cách sửa |
|---|---|---|---|---|
| Cán bộ | 9, 10 | `CB0005` gõ nhầm thành `CB0004` | Mã "CB0004" lặp lại ở các dòng 9, 10 | Dòng 10 (Võ Thị Mai) đổi lại `CB0005` |
| Khối nhà | 8 | Năm `219` | Năm đưa vào sử dụng phải từ 1800 đến 2100 | `2019` |
| Phòng | 10 | `A.301` tầng 5, khối A có 3 tầng | Tầng 5 vượt số tầng của khối nhà (3) | Tầng `3` |
| Phòng | 11 | Loại "Phòng học thường" | Không có loại phòng "Phòng học thường" | Chọn **Phòng học** |
| Phòng | 15 | *(lỗi kéo theo — xem dưới)* | Không có cán bộ mã "CB0005"… | Tự hết sau khi sửa dòng 10 trang Cán bộ |
| Lớp học | 11 | `9A1` ở phòng `A.999` | Không có phòng mã "A.999"… | `A.302` |
| Thiết bị | 8 | Tivi số lượng 4 nhưng có serial | Số serial chỉ ghi khi số lượng là 1 | Xoá serial |
| Thiết bị | 15 | Nhiệt kế lỏng `TS-0022` số lượng `0` | Số lượng phải lớn hơn 0… | `12` (không bấm Sửa nhanh cho dòng này: nó bỏ dòng) |
| Thiết bị | 22 | Phòng viết `a101` | Không có phòng mã "a101"… | Dùng **Sửa nhanh** → `A.101` |

**Lỗi kéo theo:** thư viện `B.201` do `CB0005` phụ trách, mà `CB0005` đã bị gõ nhầm thành `CB0004`. Đây là chỗ để
test việc sửa trang trước thì trang sau tự kiểm lại.

**5 cảnh báo** (không chặn ghi, chỉ cần đọc hiểu):
- Cán bộ dòng 6, 7: chức vụ Hiệu trưởng / Phó hiệu trưởng sẽ để trống vì cán bộ thiết bị không có quyền đặt. Lãnh đạo trường đặt lại ở bước 6.
- Thiết bị dòng 18, 19: số lượng hiểu theo đơn vị của danh mục (Cái, Quả).
- Thiết bị dòng 24: máy lọc nước không có trong danh mục, sẽ thành thiết bị ngoài danh mục của trường.

## Bước 4 — Sửa lỗi trên màn hình

1. Sửa từng ô theo cột "Cách sửa" ở bảng trên. Thử cả hai cách: sửa tay và **Sửa nhanh**.
2. **Mong đợi:**
   - Mỗi lần sửa, bộ đếm lỗi giảm.
   - Sửa dòng 10 trang Cán bộ thì lỗi dòng 15 trang Phòng tự hết.
   - Tab **Lịch sử** ghi lại từng ô đã sửa.
   - Còn 0 lỗi thì nút **Ghi vào hệ thống** bấm được.
3. Phụ (tuỳ chọn): tải **tệp kết quả kiểm tra** (Excel) trước khi sửa. Tệp phải đánh dấu đúng các ô lỗi, để trường sửa offline rồi nộp lại.

## Bước 5 — Ghi vào hệ thống và đối chiếu

1. Bấm **Ghi vào hệ thống**. Lô chuyển sang **Đã ghi**.
2. Mở Tổng quan trường → kiểm tra theo bảng:

| Chỗ xem | Mong đợi |
|---|---|
| Hồ sơ trường → Cơ sở, điểm trường | 2 cơ sở; `CS1` là cơ sở chính |
| Hồ sơ trường → Số liệu chung CSVC | Có số lớp, học sinh (8 lớp, 301 HS), phòng, diện tích |
| Tab Cơ sở vật chất | 4 khối nhà, 18 phòng; phòng đúng khối, đúng tầng |
| Tab Nhân sự | 14 người, 4 tổ bộ môn tự tạo (Toán – Tin, KHTN, Ngữ văn – Ngoại ngữ, Năng khiếu) |
| Thiết bị | Thiết bị từng cái khai gộp tách mỗi cái một hồ sơ (vd 20 máy tính phòng Tin → 20 hồ sơ); hoá chất là một hồ sơ mang số lượng; mã chuẩn do hệ thống cấp, **Mã cũ** giữ `TS-…`/`HC-…`; "Thước dây 30m" ở trong kho |
| Đánh giá CSVC | Tính được, không lỗi (đối chiếu chuẩn tối thiểu với phòng, thiết bị vừa nhập) |

3. Đăng nhập `so.chuyenvien` → mở THCS Thanh Bình → thấy cùng số liệu (Sở đọc được dữ liệu trường).

## Bước 6 — Lãnh đạo trường hoàn thiện và test phạm vi cơ sở

1. Đăng nhập `thanhbinh.hieutruong`:
   - Đặt chức vụ Hiệu trưởng cho `CB0001`, Phó hiệu trưởng cho `CB0002`. Ban giám hiệu ở Hồ sơ trường hiện đúng tên.
   - Cấp tài khoản `thanhbinh.ap3` cho cán bộ `CB0004` (Lê Thị Hồng), phạm vi **Điểm trường Ấp 3**.
2. Đăng nhập `thanhbinh.ap3`. **Mong đợi:**
   - Chỉ thấy cơ sở CS2: khối `KC`, phòng `C.101`, `C.102`, `C.201`, lớp `6A3`, `7A3`.
   - Chỉ thấy thiết bị đặt ở CS2: 3 dòng trong tệp, thành 4 hồ sơ vì máy tính xách tay số lượng 2.
   - Không thấy gì của CS1.
3. Đăng nhập `thanhbinh.canbo` (Cả trường) → thấy đủ cả hai cơ sở.

## Bước 7 — Nhập lại và hoàn tác

1. Tải lên lại `THCS-Thanh-Binh_2-sach.xlsx`.
   - **Mong đợi:** mọi trang báo "N dòng · N đã có". Thiết bị nhận ra bằng **Mã cũ** (`TS-…`, `HC-…`) đã lưu lúc ghi lần
     trước, nên không tạo trùng. Thiết bị chưa từng ghi (vd dòng bị bỏ ở bước 4) thì hiện là dòng mới.
   - **Đã sửa 18/11:** trước đó thiết bị không có serial bị coi là mới, ghi lại sẽ tạo trùng (thêm 20 máy tính). Còn
     thiết bị có serial thì báo nhầm lỗi "serial đã có".
2. Mở lô ở bước 5 → **Hoàn tác**.
   - Nếu đã làm bước 6 (cấp tài khoản cho cán bộ của lô): máy chủ chặn với thông báo "Cán bộ của lô đã được cấp tài khoản — không hoàn tác được", lô vẫn "Đã ghi". Đây là đúng thiết kế.
   - Nếu chưa làm bước 6: lô về Nháp và dữ liệu của trường về 0. Đã chạy thử qua API: ghi xong, hoàn tác thì 6 bảng về 0.

## Chạy tự động

Bài test Playwright `frontend/e2e/onboarding-school.spec.ts` chạy 9 bước (1, 1b thư mời, 2–3, 4, 5, 6, 6b, 7a, 7b):

```
cd frontend
E2E_BASE_URL=http://localhost:5575 E2E_BACKEND_LOG=<đường dẫn log backend> npx playwright test onboarding-school --headed
```

- Trường thử phải đang trống. Đổi trường bằng biến môi trường để khỏi dọn trường cũ:
  - `E2E_SCHOOL="TH - THCS Hồng Ngọc"`, `E2E_SCHOOL_SEARCH="Hồng Ngọc"`, `E2E_PREFIX=hongngoc`;
  - sinh tệp với email riêng: `python -I gen_data.py <mẫu.xlsx> <thư mục> hongngoc.edu.vn`, rồi `E2E_DATA_DIR=<thư mục>`.
    Email cán bộ là duy nhất toàn hệ thống: dùng chung tệp cho 2 trường thì cấp tài khoản báo "Email … đã được dùng".
- `E2E_BACKEND_LOG`: máy dev chưa khai `spring.mail.*` nên thư mời ghi ra log, test lấy link đặt mật khẩu từ đó.
- Ảnh chụp từng bước lưu ở `frontend/e2e-onboarding/` (Vite đã được cấu hình bỏ qua thư mục này và `e2e-results/`,
  nếu không Vite tải lại trang giữa lúc test chạy).
- Lưới nhập liệu vẽ bằng canvas: test sửa ô bằng bàn phím (lọc còn một dòng → ô "Dòng" → mũi tên sang cột → gõ).

## Kết quả chạy 18/11/2026

Lần chạy cuối (TH - THCS Hồng Ngọc, một lượt, có cửa sổ): **9/9 đạt, 1,9 phút**.

| Bước | Kết quả |
|---|---|
| 1. Cấp tài khoản | Đạt |
| 2–3. Tải mẫu, nhập tệp lỗi | Đạt. 10 lỗi, đúng bảng ở bước 3 |
| 4. Sửa lỗi | Đạt sau khi sửa lỗi **ô chọn**: gõ từ tìm rồi Enter làm ô trống |
| 5. Ghi, đối chiếu | Đạt. 2 cơ sở, 14 cán bộ, 4 tổ, 4 khối nhà, 18 phòng, 8 lớp / 301 HS, 73 hồ sơ thiết bị |
| 6. Chức vụ, tài khoản CS2 | Đạt sau khi sửa lỗi **form sửa cán bộ**: mã CB0001 bị thay bằng CB0007. Tài khoản CS2 chỉ thấy 2 lớp, 3 phòng, 4 thiết bị (cả trường thấy 73) |
| 7. Nhập lại, hoàn tác | Nhập lại: đạt sau khi sửa lỗi **trùng thiết bị** (21/22 dòng "đã có"; dòng còn lại là dòng đã bỏ ở bước 4). Hoàn tác: bị chặn đúng thiết kế |

**Thư mời tài khoản (thêm 18/11):** tạo người dùng mà để trống mật khẩu, hoặc cấp tài khoản cho cán bộ có email, thì
hệ thống gửi thư gồm tên đăng nhập và link tự đặt mật khẩu (dùng 1 lần, hạn 3 ngày). Máy dev chưa khai `spring.mail.*`
nên thư được ghi ra log backend; link trong log dùng được. Đã thử: đặt mật khẩu qua link, đăng nhập được, dùng lại
link thì bị từ chối.

## Dọn dẹp để chạy lại từ đầu

- Hoàn tác lô (bước 7), rồi xoá lô.
- Xoá ba tài khoản `thanhbinh.*` ở Quản trị → Tài khoản.
- Sinh lại hai tệp Excel (đổi dữ liệu hoặc lỗi cài sẵn thì sửa script): tải mẫu từ hệ thống rồi chạy
  `python -I gen_data.py <mẫu.xlsx> <thư mục ra>`. Script để ở cùng thư mục này.
