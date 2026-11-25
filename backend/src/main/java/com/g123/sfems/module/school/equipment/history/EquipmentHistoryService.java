package com.g123.sfems.module.school.equipment.history;

import com.g123.sfems.domain.school.equipment.Equipment;
import com.g123.sfems.domain.school.equipment.EquipmentHistory;
import com.g123.sfems.domain.school.equipment.EquipmentHistory.Action;
import com.g123.sfems.domain.school.voucher.SchoolVoucher;
import com.g123.sfems.shared.security.ActorNames;
import com.g123.sfems.shared.security.CurrentUser;
import java.sql.Timestamp;
import java.sql.Types;
import java.util.List;
import java.util.Objects;
import java.util.function.Function;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Ghi lịch sử thiết bị. Mọi phiếu gọi vào đây khi nó làm đổi một tài sản.
 *
 * <p>Không kiểm quyền: nó chỉ được gọi từ bên trong một thao tác đã được kiểm
 * (phiếu được duyệt, hồ sơ được sửa), và cùng giao dịch với thao tác đó — nên
 * thao tác cuộn lại thì dòng lịch sử cũng mất theo, không bao giờ có lịch sử
 * của một việc chưa xảy ra.
 */
@Service
public class EquipmentHistoryService {

    /** Phiếu làm ra thay đổi — {@code null} khi là sửa tay trên hồ sơ. */
    public record VoucherRef(String resource, Long id, String code) {

        public static VoucherRef of(String resource, SchoolVoucher voucher) {
            return new VoucherRef(resource, voucher.getId(), voucher.getCode());
        }
    }

    private static final int BATCH_SIZE = 200;

    private final EquipmentHistoryRepository repository;
    private final ActorNames actors;
    private final JdbcTemplate jdbc;

    public EquipmentHistoryService(EquipmentHistoryRepository repository, ActorNames actors, JdbcTemplate jdbc) {
        this.repository = repository;
        this.actors = actors;
        this.jdbc = jdbc;
    }

    /** Một sự kiện (ghi tăng, kiểm kê thấy đúng) không gắn với một trường dữ liệu cụ thể. */
    @Transactional
    public void event(Equipment equipment, Action action, VoucherRef voucher, String note) {
        save(equipment, action, null, null, null, voucher, note);
    }

    /** Một trường dữ liệu đổi giá trị. Không đổi thì không ghi gì. */
    @Transactional
    public void change(Equipment equipment, Action action, String field, String from, String to,
            VoucherRef voucher, String note) {
        if (Objects.equals(from, to)) {
            return;
        }
        save(equipment, action, field, from, to, voucher, note);
    }

    /**
     * Cùng một sự kiện (và, nếu {@code field} khác null, cùng một thay đổi trường dữ liệu) cho NHIỀU tài
     * sản, ghi bằng một lệnh JDBC gom lô. Bảng lịch sử dùng khoá IDENTITY nên Hibernate không gom được
     * các INSERT của nó — một phiếu nhập 500 tài sản là 500–1.000 lượt đi về chỉ cho lịch sử. Cùng giao
     * dịch với người gọi (JdbcTemplate dùng chính kết nối của giao dịch JPA), nên cuộn lại vẫn mất theo.
     *
     * @param to giá trị mới theo từng tài sản; {@code null} (hoặc bằng {@code from}) thì tài sản đó không có
     *           dòng thay đổi — như {@link #change}
     */
    @Transactional
    public void eventAll(List<Equipment> equipment, Action action, VoucherRef voucher, String note) {
        saveAll(equipment.stream()
                .map(e -> row(e, action, null, null, null, voucher, note))
                .toList());
    }

    /** {@link #change} cho nhiều tài sản cùng lúc, gom một lệnh — xem {@link #eventAll}. */
    @Transactional
    public void changeAll(List<Equipment> equipment, Action action, String field, String from,
            Function<Equipment, String> to, VoucherRef voucher, String note) {
        saveAll(equipment.stream()
                .filter(e -> !Objects.equals(from, to.apply(e)))
                .map(e -> row(e, action, field, from, to.apply(e), voucher, note))
                .toList());
    }

    private EquipmentHistory row(Equipment equipment, Action action, String field, String from, String to,
            VoucherRef voucher, String note) {
        Long actorId = CurrentUser.id().orElse(null);
        return new EquipmentHistory(equipment.getId(), action, field, from, to,
                voucher == null ? null : voucher.resource(),
                voucher == null ? null : voucher.id(),
                voucher == null ? null : voucher.code(),
                note, actorId, actors.of(actorId));
    }

    private void saveAll(List<EquipmentHistory> rows) {
        if (rows.isEmpty()) {
            return;
        }
        jdbc.batchUpdate("""
                INSERT INTO equipment_history (equipment_id, action, field, from_value, to_value, voucher_resource,
                                               voucher_id, voucher_code, note, actor_id, actor_name, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""", rows, BATCH_SIZE, (ps, h) -> {
            ps.setLong(1, h.getEquipmentId());
            ps.setString(2, h.getAction().name());
            ps.setString(3, h.getField());
            ps.setString(4, h.getFromValue());
            ps.setString(5, h.getToValue());
            ps.setString(6, h.getVoucherResource());
            ps.setObject(7, h.getVoucherId(), Types.BIGINT);
            ps.setString(8, h.getVoucherCode());
            ps.setString(9, h.getNote());
            ps.setObject(10, h.getActorId(), Types.BIGINT);
            ps.setString(11, h.getActorName());
            ps.setTimestamp(12, Timestamp.from(h.getCreatedAt()));
        });
    }

    public List<EquipmentHistory> of(Long equipmentId) {
        return repository.findByEquipmentIdOrderByCreatedAtDescIdDesc(equipmentId);
    }

    private void save(Equipment equipment, Action action, String field, String from, String to,
            VoucherRef voucher, String note) {
        Long actorId = CurrentUser.id().orElse(null);
        repository.save(new EquipmentHistory(equipment.getId(), action, field, from, to,
                voucher == null ? null : voucher.resource(),
                voucher == null ? null : voucher.id(),
                voucher == null ? null : voucher.code(),
                note, actorId, actors.of(actorId)));
    }
}
