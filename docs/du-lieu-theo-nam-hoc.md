# Dữ liệu theo năm học và chuẩn tối thiểu theo năm học (20/11/2026)

Chuẩn tối thiểu (DM-03), mức đáp ứng (NC-01), đề xuất và kế hoạch mua sắm (NC-02..06) cần trả lời được "năm học X trường có
gì, thiếu gì", kể cả khi năm đó đã qua và dữ liệu hiện tại đã đổi. Tài liệu này ghi cách hệ thống tổ chức dữ liệu theo trục
năm học và luồng chuẩn tối thiểu bước 0–9.

## 1. Ba loại dữ liệu

| Loại | Gồm | Cách lưu |
|---|---|---|
| **A. Khai mỗi năm học** | Lớp + sĩ số; phân công giáo viên dạy môn; điều chỉnh chuẩn của trường | Gắn `school_year_id` |
| **B. Liên tục, có lịch sử** | Thiết bị; phòng, khối nhà, cơ sở; hồ sơ cán bộ | Không khai lại mỗi năm. Thiết bị dựng lại trạng thái tại một ngày từ `equipment_history` |
| **C. Ảnh chụp khi chốt** | Số đầu vào và kết quả chuẩn tối thiểu của năm học | Bản chốt, không sửa được |

## 2. Hồ sơ năm học theo điểm trường

Mỗi trường × năm học × điểm trường (cơ sở): **Đang khai → Đã xác nhận → Đã chốt**.

| Trạng thái | Ai | Làm gì | Khoá gì |
|---|---|---|---|
| Đang khai | Cán bộ thiết bị, lãnh đạo trường | Khai lớp, phân công GV, phòng, thiết bị | — |
| Đã xác nhận | Lãnh đạo trường | Xác nhận dữ liệu điểm trường đầy đủ (danh sách việc còn thiếu phải trống) | Sửa dữ liệu A thì điểm đó tự về "Đang khai" |
| Đã chốt | Lãnh đạo trường | Chốt cả trường khi mọi điểm đã xác nhận → lưu bản chốt | Khoá lớp, phân công, điều chỉnh của năm đó; báo cáo năm đó đọc bản chốt |
| Mở lại | Sở (cơ quan quản lý của trường) | Mở khoá, bắt buộc lý do, lưu vết | Trường sửa rồi chốt lại; bản chốt cũ giữ làm lịch sử |

Việc còn thiếu để xác nhận một điểm: chưa có lớp hoặc lớp chưa nhập sĩ số, giáo viên chưa phân công môn chính, chưa khai
phòng, thiết bị chưa xếp phòng, điều chỉnh chép từ năm trước chưa xác nhận lại.

**Khởi tạo năm học mới** (lãnh đạo trường; Sở chạy cho nhiều trường ở màn Tiến độ): lớp lên lớp tự động (khối cuối cấp ra
trường) / chép nguyên / để trống; chép phân công năm trước (bỏ người đã nghỉ); điều chỉnh chép sang ở trạng thái "chờ xác
nhận lại" (vẫn được tính, phải xác nhận hết mới chốt được); dòng danh mục đã đổi / ngừng thì không chép.

## 3. Luồng chuẩn tối thiểu bước 0–9

0. **Sở khai danh mục**: mỗi dòng có văn bản căn cứ và điều chỉnh cho phép — Không được phép / Giảm / Thay thế / Dùng chung
   / Chọn trong nhóm, kèm câu căn cứ trong thông tư. Ngừng áp dụng từ đúng ngày bắt đầu một năm học.
1. **Trường khai dữ liệu theo điểm trường**, lãnh đạo trường xác nhận từng điểm.
2. **Tính**: phải có theo thông tư = dòng danh mục đang hiệu lực × dữ liệu từng điểm trường của năm học. Đang có = thiết bị
   đã ghi tăng xong và còn trên sổ tại ngày cắt, kể cả hỏng / mất (tách cột); thiết bị đang trên đề nghị ghi giảm không
   đếm (cột "chờ ghi giảm"). Tổng trường = cộng các điểm (thừa điểm này không bù thiếu điểm kia).
3. **Trường áp dụng điều chỉnh** theo điểm trường × năm học, có lý do, lưu lịch sử, có hiệu lực ngay (không qua Sở duyệt):
   Giảm → tính với mức Sở cho; Thay thế → bằng thiết bị của danh mục thì máy chủ kiểm có trên sổ, bằng hình thức khác
   thì trường tích "đã có"; Dùng chung → kiểm có thiết bị dùng chung trên sổ; Chọn trong nhóm → dòng không chọn về 0;
   Không được phép → chỉ nhập "nhu cầu ngoài thông tư" + lý do, tách cột riêng.
4. **Xem, so sánh** (trường, Sở): hai cột theo thông tư / theo điều chỉnh, tỷ lệ đáp ứng hai số; Sở lọc trường có điều
   chỉnh, có dòng ngoài thông tư, chênh lệch lớn.
5. **Xử lý dòng thiếu**: đưa vào đề xuất mua sắm nháp đúng số thiếu (dòng ngoài thông tư gắn nhãn); lập lúc nào cũng
   được, chỉ trình khi năm học đã chốt. Menu dòng có "Điểm trường thừa" để trường biết điểm nào đang thừa và tự chuyển
   phòng trên hồ sơ thiết bị.
6. **Chốt năm học**: lưu bản chốt dạng dòng.
7. **Sở lập kế hoạch mua sắm**: mỗi dòng đề xuất truy ngược về điểm trường, chuẩn thông tư, điều chỉnh, căn cứ.
8. **Ghi tăng** hoàn tất → đang có tăng, lần tính sau thiếu tự giảm.
9. **Sở sửa / ngừng / xoá một dòng danh mục**: điều chỉnh của trường trên dòng đó (năm chưa chốt) hết hiệu lực, trường
   nhận thông báo chọn lại.

**Ngày cắt** = `end_date` + 1 của năm học (năm hiện tại: lúc này). Trạng thái thiết bị tại ngày cắt = `from_value` của
lần đổi trạng thái đầu tiên sau ngày cắt; trường tại ngày cắt = trường chuyển của lần điều chuyển đầu tiên sau ngày cắt.

## 4. Bảng, API, màn

| Phần | Changelog | Bảng / endpoint | Màn |
|---|---|---|---|
| Điều chỉnh cho phép trên dòng danh mục | 276 | cột `equipment_norms.adjust_*`, `equipment_norm_adjust_shared`; `/api/equipment_norms` | Danh mục thiết bị tối thiểu › form dòng |
| Phân công GV theo năm | 277 | `staff_assignments`, `staff_assignment_subjects`; `/api/staff_assignments` (`/candidates`, `/copy`), quyền `staff_assignments:*` (chép từ `staff:*`) | Tổng quan trường › Nhân sự › Phân công năm học; `/staff-assignments` |
| Hồ sơ năm học, bản chốt | 278 | `school_year_profiles`, `school_year_closings`, `school_year_closing_lines`, `school_year_closing_inputs`; `/api/school_year_profiles` (`/lock`, `/progress`, `/confirm`, `/unconfirm`, `/close`, `/reopen`, `/init`), quyền `school_year_profiles:read/write/confirm/reopen` | `/school-year-profile` (phân hệ Thiết bị), `/school-year-progress` (Sở) |
| Điều chỉnh của trường | 279 | `school_norm_adjustments`, `school_norm_adjustment_events`; `/api/school_norm_adjustments` (`/history`, `/{id}/reconfirm`), quyền `school_norm_adjustments:*` (đọc theo `purchase_proposals:read`, ghi theo `purchase_proposals:write` của vai trường) | Hộp điều chỉnh / lịch sử trên màn chuẩn theo năm học |
| So sánh theo năm học | — | `GET /api/year_standards`, `/overview` | `/equipment-minimum` |
| Dòng thiếu, truy ngược | 280 | `proposal_standard_traces`; `GET /api/year_standards/suggestions`, `POST /proposal`, `GET /traces?proposalId` hoặc `?planId` | Menu dòng, nút "Đưa N dòng vào đề xuất"; khối "Căn cứ chuẩn tối thiểu" ở đề xuất và kế hoạch |
| Bước 9 | — | sự kiện `EquipmentNormChanged` → `NormChangeListener` | Nhãn "Hết hiệu lực — chọn lại", thông báo cho trường |

## 5. Chỗ khác thiết kế gốc, có lý do

- Không có cấp UBND: Sở là cơ quan quản lý mọi trường, nên Sở mở lại năm học đã chốt.
- Không có phiếu cấp phát nội bộ: bước 5 không lập phiếu điều chuyển, chỉ gợi ý điểm trường thừa.
- Bốn tài nguyên mới là SQL thuần: phạm vi qua `VisibleSchools` + `CampusScope` + RLS PostgreSQL (`rls_school`).
- Điểm trường của thiết bị theo phòng hiện tại; danh mục của năm cũ = dòng có ngày hiệu lực giao năm học đó.
- Năm cũ: giáo viên = người có phân công năm đó (kể cả đã nghỉ); năm hiện tại chỉ người đang làm việc.
- Một thiết bị nhiều dòng danh mục: dòng đòi nhiều nhất thắng, trừ khi trường điều chỉnh một dòng của nó.
- Nhập dữ liệu đầu vào trang Cán bộ chưa có cột năm học: hồ sơ nhập vào thành phân công năm hiện tại (ghi kép).
