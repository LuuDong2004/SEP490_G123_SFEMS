package com.g123.sfems.module.school.inventory;

import com.g123.sfems.domain.catalog.equipmentcatalog.EquipmentCatalog;
import com.g123.sfems.domain.school.equipment.Equipment;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.AssetStatus;
import com.g123.sfems.domain.school.equipment.EquipmentEnums.EquipmentCondition;
import com.g123.sfems.domain.school.equipment.EquipmentHistory.Action;
import com.g123.sfems.domain.school.facility.Room;
import com.g123.sfems.domain.school.inventory.InventoryCampaign;
import com.g123.sfems.domain.school.inventory.InventoryLine;
import com.g123.sfems.domain.school.inventory.InventoryLine.Discrepancy;
import com.g123.sfems.domain.school.inventory.InventorySession;
import com.g123.sfems.domain.school.inventory.InventorySurplus;
import com.g123.sfems.domain.school.voucher.VoucherStatus;
import com.g123.sfems.module.catalog.base.dto.IdRef;
import com.g123.sfems.module.school.equipment.EquipmentLifecycle;
import com.g123.sfems.module.school.equipment.EquipmentLifecycle.VoucherRef;
import com.g123.sfems.module.school.voucher.VoucherService;
import com.g123.sfems.module.school.voucher.VoucherServiceDeps;
import com.g123.sfems.shared.exception.FieldValidationException;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.hibernate.Hibernate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Phiếu kiểm kê: chụp sổ → kiểm đếm → biên bản → lãnh đạo trường duyệt.
 *
 * <p>Lập phiếu (KK-03) là CHỤP sổ tài sản ngay lúc đó, cả trường hoặc một phòng: mỗi tài sản một dòng,
 * ghi sổ nói nó ở phòng nào, tình trạng gì. Tổ kiểm kê đi đếm và ghi cái thấy thật (KK-04), rồi trình
 * biên bản lên lãnh đạo trường (KK-05); duyệt xong thì kết quả vào lịch sử từng tài sản (KK-06).
 */
@Service
public class InventorySessionService
        extends VoucherService<InventorySession, InventorySessionApi.Request, InventorySessionApi.Patch> {

    /** Tài sản không còn trên sổ hoặc đã biết là mất (chờ ghi giảm): đếm lại chỉ sinh chênh lệch trùng. */
    private static final Set<AssetStatus> NOT_COUNTED =
            EnumSet.of(AssetStatus.LIQUIDATED, AssetStatus.LOST, AssetStatus.MISSING);

    /** Phiếu đã huỷ hoặc bị từ chối không còn giữ phạm vi kiểm kê: lập lại được. */
    private static final List<VoucherStatus> DEAD = List.of(VoucherStatus.CANCELLED, VoucherStatus.REJECTED);

    private static final String RESOURCE = "inventory_sessions";

    private final InventorySessionRepository sessions;
    private final InventoryCampaignService campaigns;
    private final EquipmentLifecycle lifecycle;
    private final NamedParameterJdbcTemplate jdbc;

    public InventorySessionService(VoucherServiceDeps deps, InventorySessionRepository repository,
            InventoryCampaignService campaigns, EquipmentLifecycle lifecycle, NamedParameterJdbcTemplate jdbc) {
        super(deps, repository, InventorySession.class, InventorySession::new);
        this.sessions = repository;
        this.campaigns = campaigns;
        this.lifecycle = lifecycle;
        this.jdbc = jdbc;
    }

    /** Lập phiếu = chụp sổ tài sản ngay lúc đó, cả trường hoặc một phòng. */
    @Override
    protected void applyCreate(InventorySession voucher, InventorySessionApi.Request request) {
        voucher.setTitle(request.title().trim());
        voucher.setInventoryDate(request.inventoryDate());
        voucher.setCouncil(requireCouncil(request.council()));
        voucher.setNote(trimToNull(request.note()));
        InventoryCampaign campaign = request.campaign() == null || request.campaign().id() == null
                ? null : campaigns.get(request.campaign().id());
        Room room = roomOf(voucher, request.room(), "room");
        if (campaign != null) {
            requireFitsCampaign(voucher, campaign, room);
        }
        requireNoOverlappingInventory(voucher, room);
        voucher.setCampaign(campaign);
        voucher.setRoom(room);

        List<InventoryLine> lines = new ArrayList<>();
        int lineNo = 1;
        for (Equipment item : onRegister(voucher.getSchool().getId(), room)) {
            InventoryLine line = new InventoryLine();
            line.setLineNo(lineNo++);
            line.setEquipment(item);
            line.setExpectedRoom(item.getRoom());
            line.setExpectedCondition(item.getCondition());
            lines.add(line);
        }
        voucher.replaceLines(lines);
    }

    @Override
    protected void applyUpdate(InventorySession voucher, InventorySessionApi.Patch request) {
        if (request.title() != null && !request.title().isBlank()) {
            voucher.setTitle(request.title().trim());
        }
        if (request.inventoryDate() != null) {
            voucher.setInventoryDate(request.inventoryDate());
        }
        if (request.council() != null) {
            voucher.setCouncil(requireCouncil(request.council()));
        }
        if (request.conclusion() != null) {
            voucher.setConclusion(trimToNull(request.conclusion()));
        }
        if (request.note() != null) {
            voucher.setNote(trimToNull(request.note()));
        }
        if (request.surplus() != null) {
            voucher.replaceSurplus(surplusOf(voucher, request.surplus()));
        }
    }

    /**
     * Ghi kết quả kiểm đếm (KK-04), một hay nhiều dòng một lần. Chỉ khi phiếu còn nháp: biên bản đã trình
     * thì kết quả đã chốt. Thấy mà không nói phòng, tình trạng thì lấy đúng như sổ.
     */
    @Transactional
    public InventorySession count(Long id, InventorySessionApi.Count request) {
        InventorySession voucher = writable(id);
        lockAndReread(voucher);
        requireDraft(voucher);
        Map<Long, InventoryLine> lines = voucher.getLines().stream()
                .collect(Collectors.toMap(InventoryLine::getId, Function.identity()));
        for (InventorySessionApi.CountLine input : request.lines()) {
            InventoryLine line = lines.get(input.lineId());
            if (line == null) {
                throw new FieldValidationException("lines", "Dòng không thuộc phiếu này");
            }
            line.setFound(input.found());
            if (Boolean.TRUE.equals(input.found())) {
                Room room = roomOf(voucher, input.foundRoom(), "lines");
                line.setFoundRoom(room == null ? line.getExpectedRoom() : room);
                line.setFoundCondition(input.foundCondition() == null
                        ? line.getExpectedCondition() : input.foundCondition());
            } else {
                line.setFoundRoom(null);
                line.setFoundCondition(null);
            }
            line.setNote(trimToNull(input.note()));
        }
        rowLevel.checkWritable(voucher);
        return initialize(repository.persist(voucher));
    }

    /**
     * Trình biên bản (KK-05): mọi dòng phải đã kiểm (có hay không thấy) và phải có tổ kiểm kê — biên bản không có
     * người ký thì không ai chịu trách nhiệm về số liệu. Trình xong, kết quả kiểm đếm được chốt.
     */
    @Override
    protected void validateSubmit(InventorySession voucher) {
        long unchecked = voucher.getLines().stream().filter(l -> l.getFound() == null).count();
        if (unchecked > 0) {
            throw new FieldValidationException("lines",
                    "Còn %d tài sản chưa kiểm — ghi \"có\" hoặc \"không thấy\" cho mọi dòng trước khi trình biên bản"
                            .formatted(unchecked));
        }
        if (voucher.getCouncil() == null || voucher.getCouncil().isBlank()) {
            throw new FieldValidationException("council",
                    "Chưa khai tổ kiểm kê — sửa phiếu, chọn người trong tổ rồi trình lại biên bản");
        }
    }

    /**
     * Biên bản được duyệt (KK-06): ghi lịch sử kiểm kê cho mọi tài sản trên phiếu; tài sản phát hiện hỏng thì tình
     * trạng thành "hỏng". Biên bản CHỈ GHI NHẬN — không đổi trạng thái tài sản nào, không tự sinh phiếu nào; xử lý
     * chênh lệch (ghi giảm, điều chuyển, ghi tăng tài sản thừa) là việc người dùng làm bằng phiếu riêng. Ghi xong là
     * biên bản hoàn tất, không còn bước "hoàn tất" bấm tay.
     */
    @Override
    protected void onApproved(InventorySession voucher) {
        VoucherRef ref = new VoucherRef(RESOURCE, voucher.getId(), voucher.getCode());
        for (InventoryLine line : voucher.getLines()) {
            Set<Discrepancy> found = line.discrepancies();
            Equipment item = line.getEquipment();
            if (found.isEmpty()) {
                lifecycle.event(item, Action.KIEM_KE, ref, "Kiểm kê: khớp sổ");
                continue;
            }
            if (found.contains(Discrepancy.MISSING)) {
                lifecycle.event(item, Action.KIEM_KE, ref, "Kiểm kê: không tìm thấy");
                continue;
            }
            if (found.contains(Discrepancy.DAMAGED)) {
                lifecycle.condition(item, EquipmentCondition.HONG, Action.KIEM_KE, ref, "Kiểm kê: phát hiện hỏng");
            }
            if (found.contains(Discrepancy.WRONG_ROOM)) {
                lifecycle.event(item, Action.KIEM_KE, ref, "Kiểm kê: thấy ở "
                        + (line.getFoundRoom() == null ? "kho" : line.getFoundRoom().getName()) + ", sổ ghi "
                        + (line.getExpectedRoom() == null ? "kho" : line.getExpectedRoom().getName()));
            }
        }
        workflow.complete(voucher, "Đã ghi nhận kết quả kiểm kê");
    }

    /**
     * Phiếu nháp có thêm nút "Ghi kết quả kiểm đếm" cho người có quyền ghi. Duyệt xong là hoàn tất ngay
     * ({@link #onApproved}), nên không có nút "Hoàn tất".
     */
    @Override
    @Transactional(propagation = Propagation.SUPPORTS)
    public Set<String> actions(InventorySession voucher, Map<String, Boolean> can, boolean canApprove) {
        Set<String> actions = new LinkedHashSet<>(super.actions(voucher, can, canApprove));
        actions.remove("complete");
        if (voucher.getStatus() == VoucherStatus.DRAFT && Boolean.TRUE.equals(can.get("write"))) {
            actions.add("count");
        }
        return actions;
    }

    /** Màn chi tiết đọc cả dòng và tài sản thừa — hai tập LAZY trên thực thể. */
    @Override
    protected InventorySession initialize(InventorySession voucher) {
        Hibernate.initialize(voucher.getLines());
        Hibernate.initialize(voucher.getSurplus());
        return voucher;
    }

    /** Dòng danh sách không nạp dòng phiếu: số tóm tắt đếm bằng {@link #summaries}. */
    @Override
    protected InventorySession initializeForList(InventorySession voucher) {
        return voucher;
    }

    /** Số tóm tắt của nhiều biên bản bằng một câu SQL — cho danh sách, không nạp dòng nào. */
    public Map<Long, InventorySessionApi.Summary> summaries(List<Long> ids) {
        Map<Long, InventorySessionApi.Summary> result = new HashMap<>();
        if (ids.isEmpty()) {
            return result;
        }
        jdbc.query("""
                SELECT s.id,
                       COUNT(l.id) AS total,
                       COUNT(l.found) AS checked,
                       COUNT(*) FILTER (WHERE l.found = false) AS missing,
                       COUNT(*) FILTER (WHERE l.found AND l.found_room_id IS DISTINCT FROM l.expected_room_id) AS wrong_room,
                       COUNT(*) FILTER (WHERE l.found AND l.found_condition = 'HONG'
                                        AND l.expected_condition IS DISTINCT FROM 'HONG') AS damaged,
                       COUNT(*) FILTER (WHERE l.found AND l.found_room_id IS NOT DISTINCT FROM l.expected_room_id
                                        AND NOT (l.found_condition = 'HONG'
                                                 AND l.expected_condition IS DISTINCT FROM 'HONG')) AS matched,
                       COALESCE((SELECT SUM(x.quantity) FROM inventory_surplus x WHERE x.session_id = s.id), 0) AS surplus
                FROM inventory_sessions s
                LEFT JOIN inventory_lines l ON l.session_id = s.id
                WHERE s.id IN (:ids)
                GROUP BY s.id
                """, new MapSqlParameterSource("ids", ids), rs -> {
            result.put(rs.getLong("id"), new InventorySessionApi.Summary(rs.getInt("total"), rs.getInt("checked"),
                    rs.getInt("matched"), rs.getInt("missing"), rs.getInt("wrong_room"), rs.getInt("damaged"),
                    rs.getInt("surplus")));
        });
        return result;
    }

    // ------------------------------------------------------------------ nội bộ

    /** Tài sản còn trên sổ của trường (hoặc của một phòng), theo phòng rồi theo mã. */
    private List<Equipment> onRegister(Long schoolId, Room room) {
        return entityManager.createQuery("""
                        select e from Equipment e
                        where e.school.id = :schoolId and e.status not in :notCounted
                          and (:roomId is null or e.room.id = :roomId)
                        order by e.room.id nulls last, e.code""", Equipment.class)
                .setParameter("schoolId", schoolId)
                .setParameter("notCounted", NOT_COUNTED)
                .setParameter("roomId", room == null ? null : room.getId())
                .getResultList();
    }

    /** Phòng theo tham chiếu, phải thuộc trường của phiếu. Trống là không nói phòng. */
    private Room roomOf(InventorySession voucher, IdRef ref, String field) {
        if (ref == null || ref.id() == null) {
            return null;
        }
        Room room = entityManager.find(Room.class, ref.id());
        if (room == null || !room.getSchool().getId().equals(voucher.getSchool().getId())) {
            throw new FieldValidationException(field, "Phòng không thuộc trường của phiếu");
        }
        return room;
    }

    /** Dựng lại danh sách tài sản thừa theo thứ tự gửi lên. Tên trống thì lấy tên thiết bị trong danh mục. */
    private List<InventorySurplus> surplusOf(InventorySession voucher, List<InventorySessionApi.SurplusInput> inputs) {
        List<InventorySurplus> items = new ArrayList<>();
        int lineNo = 1;
        for (InventorySessionApi.SurplusInput input : inputs) {
            EquipmentCatalog catalog = entityManager.find(EquipmentCatalog.class, input.catalog().id());
            if (catalog == null) {
                throw new FieldValidationException("surplus", "Thiết bị không có trong danh mục");
            }
            InventorySurplus item = new InventorySurplus();
            item.setLineNo(lineNo++);
            item.setCatalog(catalog);
            String name = trimToNull(input.name());
            item.setName(name == null ? catalog.getName() : name);
            item.setQuantity(input.quantity() == null ? 1 : input.quantity());
            item.setRoom(roomOf(voucher, input.room(), "surplus"));
            item.setNote(trimToNull(input.note()));
            items.add(item);
        }
        return items;
    }

    /**
     * Đợt của Sở là kiểm kê TOÀN BỘ và mỗi trường nộp MỘT biên bản: phiếu gắn đợt phải là cả trường, đợt
     * phải còn mở, và trường chưa có phiếu còn hiệu lực nào cho đợt đó (phiếu đã huỷ, bị từ chối thì lập
     * lại được). Phiếu không gắn đợt là trường tự kiểm kê định kỳ, cả trường hoặc một phòng.
     */
    private void requireFitsCampaign(InventorySession voucher, InventoryCampaign campaign, Room room) {
        if (campaign.isClosed()) {
            throw new FieldValidationException("campaign",
                    "Đợt \"%s\" đã đóng, không lập phiếu cho đợt này được nữa".formatted(campaign.getTitle()));
        }
        if (room != null) {
            throw new FieldValidationException("room",
                    "Kiểm kê theo đợt của Sở là kiểm kê toàn bộ: để trống phạm vi (cả trường). "
                            + "Muốn kiểm kê riêng một phòng thì lập phiếu không gắn đợt.");
        }
        List<InventorySession> live = sessions.findLiveForCampaign(voucher.getSchool().getId(), campaign.getId(), DEAD);
        if (!live.isEmpty()) {
            InventorySession existing = live.get(0);
            throw new FieldValidationException("campaign",
                    "Trường đã có phiếu kiểm kê cho đợt \"%s\" (%s). Mỗi trường nộp một biên bản cho một đợt — mở phiếu đó để làm tiếp."
                            .formatted(campaign.getTitle(), existing.getCode() != null
                                    ? existing.getCode() : "phiếu nháp \"" + existing.getTitle() + "\""));
        }
    }

    /**
     * Một trường có thể kiểm kê nhiều phòng song song, nhưng không kiểm một phòng hay một tài sản hai lần.
     * Khoá dòng trường trước khi kiểm, để hai yêu cầu đồng thời không cùng lập được phiếu. Phiếu đã trình
     * vẫn giữ phạm vi cho tới khi duyệt xong.
     */
    private void requireNoOverlappingInventory(InventorySession voucher, Room room) {
        Long schoolId = voucher.getSchool().getId();
        Long roomId = room == null ? null : room.getId();
        MapSqlParameterSource params = new MapSqlParameterSource("schoolId", schoolId).addValue("roomId", roomId);
        jdbc.queryForObject("SELECT id FROM schools WHERE id = :schoolId FOR UPDATE", params, Long.class);

        List<Map<String, Object>> conflicts = jdbc.queryForList("""
                SELECT s.id, s.code, s.title, r.name AS room_name
                FROM inventory_sessions s
                LEFT JOIN rooms r ON r.id = s.room_id
                WHERE s.school_id = :schoolId AND s.status IN ('DRAFT', 'PENDING', 'APPROVED')
                  AND (s.room_id IS NULL OR CAST(:roomId AS bigint) IS NULL OR s.room_id = :roomId
                       OR EXISTS (
                           SELECT 1 FROM inventory_lines l
                           JOIN equipment e ON e.id = l.equipment_id
                           WHERE l.session_id = s.id AND e.room_id = :roomId))
                ORDER BY s.id LIMIT 1
                """, params);
        if (conflicts.isEmpty()) {
            return;
        }
        Map<String, Object> conflict = conflicts.get(0);
        String name = conflict.get("code") == null
                ? "phiếu nháp \"" + conflict.get("title") + "\" (mã số " + conflict.get("id") + ")"
                : "phiếu " + conflict.get("code");
        String scope = conflict.get("room_name") == null ? "cả trường" : "phòng " + conflict.get("room_name");
        throw new FieldValidationException("room", "Không thể lập phiếu kiểm kê trùng phạm vi: " + name
                + " đang kiểm kê " + scope + ". Hãy xử lý xong phiếu đó trước khi lập phiếu mới.");
    }

    /** Tổ kiểm kê bắt buộc ngay lúc lập, sửa phiếu: biên bản phải nói ai đã kiểm. */
    private static String requireCouncil(String council) {
        String value = trimToNull(council);
        if (value == null) {
            throw new FieldValidationException("council", "Chọn người trong tổ kiểm kê");
        }
        return value;
    }
}
