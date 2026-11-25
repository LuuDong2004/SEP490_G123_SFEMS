--liquibase formatted sql

-- Cấp tài khoản đăng nhập cho cán bộ, giáo viên NGAY TỪ danh sách cán bộ của trường.
--
-- `users:write` cố ý chỉ quản trị viên có: bảng tài khoản không có phạm vi dòng, nên ai cầm mã đó
-- sửa được mọi tài khoản của mọi trường, kể cả tự gán ADMIN (CLAUDE.md, mục 072). Lối này hẹp hơn
-- hẳn và vì thế cấp được cho lãnh đạo trường: tài khoản tạo ra LUÔN thuộc trường của cán bộ (cán bộ
-- phải nằm trong phạm vi ghi của người gọi), và chỉ nhận một trong ba vai phía trường — Giáo viên,
-- Cán bộ thiết bị, Lãnh đạo trường — không bao giờ vai của Sở / UBND / quản trị.
--
-- staff.user_id: mỗi cán bộ tối đa một tài khoản, mỗi tài khoản gắn tối đa một cán bộ. Xoá tài
-- khoản thì cán bộ còn nguyên, chỉ mất liên kết.

--changeset qltb:091-staff-accounts
ALTER TABLE staff ADD COLUMN user_id BIGINT REFERENCES users (id) ON DELETE SET NULL;
ALTER TABLE staff ADD CONSTRAINT uq_staff_user UNIQUE (user_id);

INSERT INTO permissions (code, name, description, system_permission) VALUES
  ('staff_accounts:write', 'Cấp tài khoản cho cán bộ', 'Cấp, đặt lại mật khẩu, khoá / mở tài khoản đăng nhập của cán bộ, giáo viên trong trường', TRUE);

-- Ai xoá được cán bộ (lãnh đạo trường, quản trị viên) thì cấp được tài khoản cho cán bộ.
INSERT INTO role_permissions (role_id, permission_id)
SELECT DISTINCT rp.role_id, target.id
FROM role_permissions rp
JOIN permissions src ON src.id = rp.permission_id AND src.code = 'staff:delete'
JOIN permissions target ON target.code = 'staff_accounts:write';
--rollback DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE code = 'staff_accounts:write'); DELETE FROM permissions WHERE code = 'staff_accounts:write'; ALTER TABLE staff DROP CONSTRAINT uq_staff_user; ALTER TABLE staff DROP COLUMN user_id;
