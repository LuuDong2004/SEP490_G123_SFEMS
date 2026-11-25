--liquibase formatted sql

--changeset qltb:077-demo-projector-subject
--comment DỮ LIỆU DEMO. Vá chỗ 076 bỏ sót: 076 gắn môn theo mã và coi 'NTB-MCH' là máy chiếu, 'TB-MAYCHIEU' là bản trùng để xoá. Ở DB nào 'TB-MAYCHIEU' đã có tài sản thì lệnh xoá tự bỏ qua (đúng — không mất dữ liệu), nhưng mặt hàng ấy cũng không được gắn môn nào: màn Tổng hợp hiện Môn "—" và cột Lọc nhanh dồn nó vào "Chưa gắn môn". Máy chiếu là thiết bị dùng chung như ti vi, loa, bảng tương tác trong 076. DB đã xoá 'TB-MAYCHIEU' thì câu này không chạm dòng nào.
UPDATE equipment_catalogs c SET subject_id = s.id, updated_at = now()
FROM subjects s
WHERE s.code = 'CHUNG' AND c.code = 'TB-MAYCHIEU' AND c.subject_id IS NULL;
--rollback UPDATE equipment_catalogs SET subject_id = NULL WHERE code = 'TB-MAYCHIEU';
