package com.g123.sfems.module.school.inventory;

import com.g123.sfems.module.school.voucher.VoucherCampus;
import com.g123.sfems.domain.catalog.equipmentcatalog.TrackingType;
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
import com.g123.sfems.module.catalog.equipmentcatalog.EquipmentCatalogService;
import com.g123.sfems.module.school.equipment.EquipmentLifecycle;
import com.g123.sfems.module.school.equipment.EquipmentService;
import com.g123.sfems.module.school.equipment.history.EquipmentHistoryService.VoucherRef;
import com.g123.sfems.module.school.facility.CampusScope;
import com.g123.sfems.module.school.facility.FacilityCounting;
import com.g123.sfems.module.school.facility.RoomService;
import com.g123.sfems.module.school.voucher.EquipmentIncident;
import com.g123.sfems.module.school.voucher.InventoryFindings;
import com.g123.sfems.module.school.voucher.VoucherService;
import com.g123.sfems.module.school.voucher.VoucherServiceDeps;
import com.g123.sfems.module.school.voucher.VoucherSpecs;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.web.ListParams;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Kiểm kê: chụp sổ → kiểm đếm → biên bản → lãnh đạo trường duyệt.
 *
 * <p>Biên bản CHỈ GHI NHẬN: duyệt xong thì lịch sử từng tài sản có dòng kiểm kê (tài sản hỏng thì tình trạng thành
 * "hỏng"), không đổi trạng thái tài sản nào và không tự sinh phiếu nào. Xử lý chênh lệch là việc của người dùng, lúc
 * nào và bằng phiếu nào là họ quyết; hệ thống chỉ giúp LẬP NHANH ({@link #followUp}): một lần bấm là một phiếu nháp
 * mang sẵn các tài sản thiếu / hỏng / sai vị trí / thừa CHƯA có phiếu, ghi nguồn là biên bản này.
 */
@Service
public class InventorySessionService
        extends VoucherService<InventorySession, InventorySessionApi.Request, InventorySessionApi.Patch> {

    public static final String RESOURCE = "inventory_sessions";

    private final EquipmentService equipment;
    private final RoomService rooms;
    private final EquipmentCatalogService catalogs;
    private final EquipmentLifecycle lifecycle;
    private final InventoryCampaignService campaigns;
    private final InventorySessionRepository sessions;
    private final ApplicationEventPublisher events;
    private final JdbcTemplate jdbc;

    public InventorySessionService(VoucherServiceDeps deps, InventorySessionRepository repository,
            EquipmentService equipment, RoomService rooms, EquipmentCatalogService catalogs,
            EquipmentLifecycle lifecycle, InventoryCampaignService campaigns, ApplicationEventPublisher events,
            JdbcTemplate jdbc) {
        super(deps, repository, InventorySession.class, RESOURCE, InventorySession::new);
        this.equipment = equipment;
        this.rooms = rooms;
        this.catalogs = catalogs;
        this.lifecycle = lifecycle;
        this.campaigns = campaigns;
        this.sessions = repository;
        this.events = events;
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
        Room room = request.room() == null || request.room().id() == null ? null : rooms.getAcrossCampuses(request.room().id());
        if (room != null && !room.getSchool().getId().equals(voucher.getSchool().getId())) {
            throw new FieldValidationException("room", "Phòng không thuộc trường của phiếu");
        }
        if (campaign != null) {
            requireFitsCampaign(voucher, campaign, room);
        }
        // Không chọn phòng: tài khoản một cơ sở kiểm kê toàn cơ sở mình (onRegister cũng chỉ trả thiết bị của cơ sở).
        Long campus = room == null ? campusScope.pinnedCampusIn(voucher.getSchool().getId()) : null;
        requireNoOverlappingInventory(voucher, room, campus);
        voucher.setCampaign(campaign);
        voucher.setRoom(room);
        voucher.setCampusId(campus);
        List<InventoryLine> lines = new ArrayList<>();
        int lineNo = 1;
        for (Equipment item : equipment.onRegister(voucher.getSchool().getId(), room == null ? null : room.getId())) {
            if (item.getStatus() == AssetStatus.MISSING) {
                // Đang chờ quyết định ghi giảm do mất — đã biết là không còn, đếm lại chỉ sinh đề nghị trùng.
                continue;
            }
            InventoryLine line = new InventoryLine();
            line.setLineNo(lineNo++);
            line.setEquipment(item);
            line.setExpectedRoom(item.getRoom());
            line.setExpectedCondition(item.getCondition());
            // Lô hoá chất, vật tư (một mã, nhiều đơn vị): kiểm theo số lượng.
            if (item.getCatalog() != null && item.getCatalog().getTrackingType() == TrackingType.BULK) {
                line.setExpectedQuantity(item.getQuantity());
            }
            lines.add(line);
        }
        voucher.replaceLines(lines);
    }

    /**
     * A school may count different rooms in parallel, but never the same room or asset twice.
     * Lock the school row before checking so two concurrent requests cannot both create a draft.
     * A submitted inventory remains active until its approval completes the record.
     *
     * <p>Phạm vi cơ sở (271): kiểm kê toàn cơ sở ({@code campus}) chặn kiểm kê cả trường, cùng cơ sở, và phòng thuộc
     * cơ sở đó — không chặn toàn cơ sở / phòng của cơ sở khác. Kiểm kê cả trường chặn tất cả.
     */
    private void requireNoOverlappingInventory(InventorySession voucher, Room room, Long campus) {
        Long schoolId = voucher.getSchool().getId();
        Long roomId = room == null ? null : room.getId();
        jdbc.queryForObject("SELECT id FROM schools WHERE id = ? FOR UPDATE", Long.class, schoolId);

        String newRoomCampus = FacilityCounting.campusOfRoomSql("CAST(? AS bigint)", "s.school_id");
        String oldRoomCampus = FacilityCounting.campusOfRoomSql("s.room_id", "s.school_id");
        List<Map<String, Object>> conflicts = jdbc.queryForList("""
                SELECT s.id, s.code, s.title, r.name AS room_name, c.name AS campus_name
                FROM inventory_sessions s
                LEFT JOIN rooms r ON r.id = s.room_id
                LEFT JOIN campuses c ON c.id = s.campus_id
                WHERE s.school_id = ? AND s.status IN ('DRAFT', 'PENDING', 'APPROVED')
                  AND ((s.room_id IS NULL AND s.campus_id IS NULL)
                       OR (CAST(? AS bigint) IS NULL AND CAST(? AS bigint) IS NULL)
                       OR (s.room_id IS NULL AND (s.campus_id = CAST(? AS bigint)
                           OR (CAST(? AS bigint) IS NOT NULL AND %s = s.campus_id)))
                       OR (s.room_id IS NOT NULL AND (s.room_id = CAST(? AS bigint)
                           OR (CAST(? AS bigint) IS NULL AND %s = CAST(? AS bigint))))
                       OR (CAST(? AS bigint) IS NOT NULL AND EXISTS (
                           SELECT 1 FROM inventory_lines l
                           JOIN equipment e ON e.id = l.equipment_id
                           WHERE l.session_id = s.id AND e.school_id = ? AND e.room_id = ?
                       )))
                ORDER BY s.id LIMIT 1
                """.formatted(newRoomCampus, oldRoomCampus),
                schoolId, roomId, campus, campus, roomId, roomId, roomId, roomId, campus, roomId, schoolId, roomId);
        if (conflicts.isEmpty()) {
            return;
        }
        Map<String, Object> conflict = conflicts.get(0);
        String name = conflict.get("code") == null
                ? "phiếu nháp \"" + conflict.get("title") + "\" (mã số " + conflict.get("id") + ")"
                : "phiếu " + conflict.get("code");
        String scope = conflict.get("room_name") != null ? "phòng " + conflict.get("room_name")
                : conflict.get("campus_name") != null ? "cơ sở " + conflict.get("campus_name") : "cả trường";
        throw new FieldValidationException("room", "Không thể lập phiếu kiểm kê trùng phạm vi: " + name
                + " đang kiểm kê " + scope + ". Hãy xử lý xong phiếu đó trước khi lập phiếu mới.");
    }

    private CampusScope campusScope;

    /** Tiêm qua setter — phạm vi cơ sở của kiểm kê toàn cơ sở (271). */
    @Autowired
    void setCampusScope(CampusScope campusScope) {
        this.campusScope = campusScope;
    }

    /** Active inventory scopes are visible to school users even when a draft is not yet readable. */
    public record ActiveInventory(Long id, String code, String title, VoucherStatus status,
            String roomName, boolean canOpen, String campusName) {
    }

    public List<ActiveInventory> activeForMySchool() {
        Long schoolId = principals.current().orElseThrow().schoolId();
        if (schoolId == null) {
            return List.of();
        }
        List<InventorySession> active = sessions.findAll((root, query, cb) -> cb.and(
                cb.equal(root.get("school").get("id"), schoolId),
                root.get("status").in(VoucherStatus.DRAFT, VoucherStatus.PENDING, VoucherStatus.APPROVED)));
        if (active.isEmpty()) {
            return List.of();
        }
        Set<Long> readableIds = sessions.findAll(rowLevel.<InventorySession>scope(InventorySession.class,
                        com.g123.sfems.shared.security.rowlevel.Action.READ)
                .and(campusRead())
                .and((root, query, cb) -> root.get("id").in(active.stream().map(InventorySession::getId).toList())))
                .stream().map(InventorySession::getId).collect(Collectors.toSet());
        Map<Long, String> campusNames = campusScope.activeCampuses(schoolId).stream()
                .collect(Collectors.toMap(CampusScope.CampusLabel::id, CampusScope.CampusLabel::name));
        return active.stream().map(s -> new ActiveInventory(s.getId(), s.getCode(), s.getTitle(), s.getStatus(),
                s.getRoom() == null ? null : s.getRoom().getName(), readableIds.contains(s.getId()),
                s.getRoom() == null && s.getCampusId() != null ? campusNames.get(s.getCampusId()) : null)).toList();
    }

    /**
     * Hai kiểu kiểm kê: trường TỰ kiểm kê định kỳ (không gắn đợt — cả trường hoặc một phòng, các lần
     * cùng phạm vi phải hoàn tất lần lượt), và kiểm kê THEO ĐỢT của cấp trên. Đợt của Sở / UBND là kiểm kê TOÀN BỘ và
     * mỗi trường nộp MỘT biên bản, nên phiếu gắn đợt phải là cả trường, đợt phải còn mở, và trường chưa
     * có phiếu còn hiệu lực nào cho đợt đó (phiếu đã huỷ / bị từ chối thì lập lại được).
     */
    private void requireFitsCampaign(InventorySession voucher, InventoryCampaign campaign, Room room) {
        if (campaign.isClosed()) {
            throw new FieldValidationException("campaign",
                    "Đợt \"%s\" đã đóng, không lập phiếu cho đợt này được nữa".formatted(campaign.getTitle()));
        }
        if (room != null) {
            throw new FieldValidationException("room",
                    "Kiểm kê theo đợt của cấp trên là kiểm kê toàn bộ: để trống phạm vi (cả trường). "
                            + "Muốn kiểm kê riêng một phòng thì lập phiếu không gắn đợt.");
        }
        List<InventorySession> live = sessions.findLiveForCampaign(voucher.getSchool().getId(), campaign.getId(),
                List.of(VoucherStatus.CANCELLED, VoucherStatus.REJECTED));
        if (!live.isEmpty()) {
            InventorySession existing = live.get(0);
            throw new FieldValidationException("campaign",
                    "Trường đã có phiếu kiểm kê cho đợt \"%s\" (%s). Mỗi trường nộp một biên bản cho một đợt — mở phiếu đó để làm tiếp."
                            .formatted(campaign.getTitle(),
                                    existing.getCode() != null ? existing.getCode() : "phiếu nháp \"" + existing.getTitle() + "\""));
        }
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
            List<InventorySurplus> items = new ArrayList<>();
            int lineNo = 1;
            for (InventorySessionApi.SurplusInput input : request.surplus()) {
                InventorySurplus item = new InventorySurplus();
                item.setLineNo(lineNo++);
                item.setCatalog(catalogs.get(input.catalog().id()));
                catalogs.requireOwnedBy(item.getCatalog(), voucher.getSchool(), lineNo - 1);
                item.setName(input.name() == null || input.name().isBlank() ? item.getCatalog().getName() : input.name().trim());
                item.setQuantity(input.quantity() == null ? 1 : input.quantity());
                item.setRoom(input.room() == null || input.room().id() == null ? null : rooms.getAcrossCampuses(input.room().id()));
                item.setNote(trimToNull(input.note()));
                items.add(item);
            }
            voucher.replaceSurplus(items);
        }
    }

    /** Ghi kết quả kiểm đếm. Chỉ khi phiếu còn nháp: biên bản đã trình thì kết quả đã chốt. */
    @Transactional
    public InventorySession count(Long id, InventorySessionApi.Count request) {
        InventorySession voucher = writable(id);
        requireDraft(voucher);
        for (InventorySessionApi.CountLine input : request.lines()) {
            InventoryLine line = voucher.getLines().stream()
                    .filter(l -> l.getId().equals(input.lineId()))
                    .findFirst()
                    .orElseThrow(() -> new FieldValidationException("lines", "Dòng không thuộc phiếu này"));
            line.setFound(input.found());
            if (Boolean.TRUE.equals(input.found())) {
                Room room = input.foundRoom() == null || input.foundRoom().id() == null
                        ? line.getExpectedRoom() : rooms.getAcrossCampuses(input.foundRoom().id());
                if (room != null && !room.getSchool().getId().equals(voucher.getSchool().getId())) {
                    throw new FieldValidationException("lines", "Phòng tìm thấy không thuộc trường của phiếu");
                }
                line.setFoundRoom(room);
                line.setFoundCondition(input.foundCondition() == null ? line.getExpectedCondition() : input.foundCondition());
                if (line.getExpectedQuantity() != null) {
                    if (input.countedQuantity() != null && input.countedQuantity().signum() < 0) {
                        throw new FieldValidationException("lines", "Số lượng đếm được không được âm");
                    }
                    line.setCountedQuantity(input.countedQuantity() == null ? line.getExpectedQuantity() : input.countedQuantity());
                }
            } else {
                line.setFoundRoom(null);
                line.setFoundCondition(null);
                line.setCountedQuantity(null);
            }
            line.setNote(trimToNull(input.note()));
            if (input.details() != null) {
                line.setDetails(lineDetails(input.details(), voucher.getSchool(), line.getLineNo()));
            }
        }
        rowLevel.checkWritable(voucher);
        return initialize(repository.persist(voucher));
    }

    /** Tổ kiểm kê bắt buộc ngay lúc lập / sửa phiếu — không chỉ lúc trình. */
    private static String requireCouncil(String council) {
        String value = trimToNull(council);
        if (value == null) {
            throw new FieldValidationException("council", "Chọn người trong tổ kiểm kê");
        }
        return value;
    }

    @Override
    protected void validateSubmit(InventorySession voucher) {
        long unchecked = voucher.getLines().stream().filter(l -> l.getFound() == null).count();
        if (unchecked > 0) {
            throw new FieldValidationException("lines",
                    "Còn %d thiết bị chưa kiểm — ghi \"có\" hoặc \"không thấy\" cho mọi dòng trước khi trình biên bản"
                            .formatted(unchecked));
        }
        // Biên bản kiểm kê phải nói AI đã kiểm: không có tổ kiểm kê thì biên bản không có người ký.
        if (voucher.getCouncil() == null || voucher.getCouncil().isBlank()) {
            throw new FieldValidationException("council",
                    "Chưa khai tổ kiểm kê — sửa phiếu, chọn người trong tổ rồi trình lại biên bản");
        }
    }

    /**
     * Biên bản được duyệt: ghi lịch sử kiểm kê cho mọi tài sản, rồi LẬP NGAY phiếu nháp cho từng nhóm chênh lệch
     * (607 — đúng như hộp duyệt nói): thiếu → đề nghị ghi giảm do mất, hỏng → phiếu báo hỏng, sai vị trí →
     * phiếu điều chuyển nội bộ, thừa → phiếu ghi tăng. Trạng thái tài sản KHÔNG đổi lúc duyệt: phiếu báo hỏng được ghi
     * nhận thì tài sản mới thành hỏng, đề nghị ghi giảm hoàn tất thì mới thành mất. Nhóm nào đã có phiếu thì bỏ qua;
     * nút "Nghiệp vụ đề xuất" ({@link #followUp}) vẫn lập lại được phần còn thiếu.
     */
    @Override
    protected void onApproved(InventorySession voucher) {
        VoucherRef ref = VoucherRef.of(RESOURCE, voucher);
        for (InventoryLine line : voucher.getLines()) {
            Set<Discrepancy> found = line.discrepancies();
            Equipment item = line.getEquipment();
            if (found.isEmpty()) {
                lifecycle.event(item, Action.KIEM_KE, ref, "Kiểm kê: khớp hệ thống");
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
                        + (line.getFoundRoom() == null ? "kho" : line.getFoundRoom().getName()) + ", hệ thống ghi "
                        + (line.getExpectedRoom() == null ? "kho" : line.getExpectedRoom().getName()));
            }
        }
        workflow.complete(voucher, RESOURCE, "Đã ghi nhận kết quả kiểm kê");
        for (FollowUp kind : FollowUp.values()) {
            if (pendingCount(voucher, kind) > 0) {
                followUp(voucher.getId(), kind);
            }
        }
    }

    // ------------------------------------------------------------------ lập phiếu nhanh sau kiểm kê

    /** Một nhóm chênh lệch và loại phiếu lập nhanh cho nó. */
    public enum FollowUp {
        /** Thiếu → đề nghị ghi giảm do mất. */
        LOSS("disposals", "disposal_lines", "disposal_id", "thiết bị thiếu",
                Set.of(AssetStatus.IN_STOCK, AssetStatus.IN_USE, AssetStatus.BROKEN, AssetStatus.UNREPAIRABLE)),
        /** Hỏng → phiếu báo hỏng. */
        DAMAGE("damage_reports", "damage_report_lines", "report_id", "thiết bị hỏng",
                Set.of(AssetStatus.IN_STOCK, AssetStatus.IN_USE, AssetStatus.BROKEN)),
        /** Sai vị trí → cấp phát / thu hồi, mỗi phòng thực tế một phiếu. */
        MOVE("equipment_allocations", "equipment_allocation_lines", "allocation_id", "thiết bị sai vị trí",
                Set.of(AssetStatus.IN_STOCK, AssetStatus.IN_USE)),
        /** Thừa → phiếu ghi tăng (nguồn "Kiểm kê thừa"). */
        SURPLUS("equipment_intakes", null, null, "thiết bị thừa", Set.of());

        private final String resource;
        private final String lineTable;
        private final String fk;
        private final String label;
        private final Set<AssetStatus> statuses;

        FollowUp(String resource, String lineTable, String fk, String label, Set<AssetStatus> statuses) {
            this.resource = resource;
            this.lineTable = lineTable;
            this.fk = fk;
            this.label = label;
            this.statuses = statuses;
        }

        public String resource() {
            return resource;
        }
    }

    /**
     * Tình hình một nhóm: {@code total} — số chênh lệch biên bản ghi; {@code pending} — số còn lập phiếu được (chưa
     * nằm trên phiếu nào lập từ biên bản này mà còn hiệu lực, và tài sản vẫn ở trạng thái phiếu đó nhận).
     */
    public record FollowUpState(FollowUp kind, String resource, int total, int pending) {
    }

    /** Kết quả một lần lập nhanh: loại phiếu và id các phiếu nháp vừa lập. */
    public record FollowUpResult(String resource, List<Long> ids) {
    }

    @Transactional(readOnly = true)
    public List<FollowUpState> followUps(Long id) {
        InventorySession session = get(id);
        if (session.getStatus() != VoucherStatus.COMPLETED) {
            return List.of();
        }
        List<FollowUpState> states = new ArrayList<>();
        for (FollowUp kind : FollowUp.values()) {
            int total = kind == FollowUp.SURPLUS ? session.getSurplus().size() : findings(session, kind).size();
            if (total > 0) {
                states.add(new FollowUpState(kind, kind.resource, total, pendingCount(session, kind)));
            }
        }
        return states;
    }

    /**
     * Lập nhanh phiếu nháp cho một nhóm chênh lệch của biên bản ĐÃ DUYỆT, chỉ với những tài sản chưa có phiếu. Dùng lại
     * đúng các listener đã có (đề nghị ghi giảm, báo hỏng, cấp phát, ghi tăng) — phiếu nháp ra đời giống hệt phiếu lập
     * tay, mang nguồn là biên bản này, người dùng sửa / bớt dòng rồi tự trình.
     */
    @Transactional
    public FollowUpResult followUp(Long id, FollowUp kind) {
        InventorySession session = get(id);
        if (session.getStatus() != VoucherStatus.COMPLETED) {
            throw new FieldValidationException("status", "Biên bản chưa được duyệt — chưa lập phiếu xử lý được");
        }
        List<InventoryLine> lines = kind == FollowUp.SURPLUS ? List.of() : pending(session, kind);
        if (pendingCount(session, kind) == 0) {
            throw new FieldValidationException("kind",
                    "Không còn %s nào chưa có phiếu — xem khối Phiếu liên quan".formatted(kind.label));
        }
        Long schoolId = session.getSchool().getId();
        String note = "Theo biên bản kiểm kê " + session.getCode();
        Long before = jdbc.queryForObject("SELECT COALESCE(MAX(id), 0) FROM " + kind.resource, Long.class);
        List<Long> ids = lines.stream().map(l -> l.getEquipment().getId()).toList();
        switch (kind) {
            case LOSS -> events.publishEvent(new EquipmentIncident(EquipmentIncident.Kind.MISSING, schoolId, ids,
                    RESOURCE, session.getId(), session.getCode(), "Không tìm thấy khi kiểm kê — " + note));
            case DAMAGE -> events.publishEvent(new EquipmentIncident(EquipmentIncident.Kind.DAMAGED, schoolId, ids,
                    RESOURCE, session.getId(), session.getCode(), "Phát hiện hỏng khi kiểm kê — " + note));
            case MOVE -> events.publishEvent(new InventoryFindings.Misplaced(schoolId, lines.stream()
                    .map(l -> new InventoryFindings.Move(l.getEquipment().getId(),
                            l.getFoundRoom() == null ? null : l.getFoundRoom().getId()))
                    .toList(), session.getId(), session.getCode(), note));
            case SURPLUS -> events.publishEvent(new InventoryFindings.Surplus(schoolId, session.getSurplus().stream()
                    .map(s -> new InventoryFindings.Item(s.getCatalog().getId(), s.getName(), s.getQuantity(),
                            s.getRoom() == null ? null : s.getRoom().getId()))
                    .toList(), session.getId(), session.getCode(), note));
        }
        entityManager.flush();
        return new FollowUpResult(kind.resource, jdbc.queryForList("SELECT id FROM " + kind.resource
                + " WHERE source_resource = ? AND source_id = ? AND id > ? ORDER BY id", Long.class,
                RESOURCE, session.getId(), before));
    }

    /** Các dòng của biên bản thuộc nhóm này (chưa xét đã có phiếu hay chưa). */
    private static List<InventoryLine> findings(InventorySession session, FollowUp kind) {
        return session.getLines().stream().filter(line -> {
            Set<Discrepancy> found = line.discrepancies();
            return switch (kind) {
                case LOSS -> found.contains(Discrepancy.MISSING);
                case DAMAGE -> found.contains(Discrepancy.DAMAGED) && !found.contains(Discrepancy.MISSING);
                case MOVE -> found.contains(Discrepancy.WRONG_ROOM) && !found.contains(Discrepancy.MISSING);
                case SURPLUS -> false;
            };
        }).toList();
    }

    /**
     * Dòng còn lập phiếu được: chưa nằm trên phiếu nào (trừ phiếu đã huỷ / bị từ chối) lập từ biên bản này, và tài sản
     * vẫn ở trạng thái loại phiếu đó nhận — đã ghi giảm, đã điều chỉnh theo phiếu khác thì thôi. Sai vị trí mà tài sản
     * đã ở đúng phòng thực tế (do phiếu khác) cũng thôi. Thừa: còn lập được khi chưa có phiếu ghi tăng nào còn hiệu lực.
     */
    private int pendingCount(InventorySession session, FollowUp kind) {
        if (kind != FollowUp.SURPLUS) {
            return pending(session, kind).size();
        }
        Integer active = jdbc.queryForObject("SELECT COUNT(*) FROM equipment_intakes WHERE source_resource = ?"
                + " AND source_id = ? AND status NOT IN ('CANCELLED', 'REJECTED')", Integer.class,
                RESOURCE, session.getId());
        return active != null && active > 0 ? 0 : session.getSurplus().size();
    }

    private List<InventoryLine> pending(InventorySession session, FollowUp kind) {
        Set<Long> covered = new HashSet<>(jdbc.queryForList("SELECT l.equipment_id FROM " + kind.lineTable + " l"
                + " JOIN " + kind.resource + " v ON v.id = l." + kind.fk
                + " WHERE v.source_resource = ? AND v.source_id = ? AND v.status NOT IN ('CANCELLED', 'REJECTED')",
                Long.class, RESOURCE, session.getId()));
        return findings(session, kind).stream().filter(line -> {
            Equipment item = line.getEquipment();
            if (covered.contains(item.getId()) || !kind.statuses.contains(item.getStatus())) {
                return false;
            }
            if (kind == FollowUp.MOVE) {
                Long now = item.getRoom() == null ? null : item.getRoom().getId();
                Long seen = line.getFoundRoom() == null ? null : line.getFoundRoom().getId();
                return !Objects.equals(now, seen);
            }
            return true;
        }).toList();
    }

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

    /** Danh sách không nạp dòng, cũng không nạp tài sản thừa: số tóm tắt lấy từ {@link #summaries}. */
    @Override
    protected InventorySession initializeForList(InventorySession voucher) {
        return voucher;
    }

    /**
     * Số tóm tắt của từng biên bản, đếm bằng SQL — cùng phép đếm với {@code InventoryLine.discrepancies()}: không
     * thấy là thiếu; thấy mà khác phòng trên sổ là sai vị trí; thấy hỏng mà sổ chưa ghi hỏng là hỏng; thấy và không
     * lệch gì là khớp. Đổi một bên thì đổi bên kia.
     */
    @Transactional(readOnly = true)
    public Map<Long, InventorySessionApi.Summary> summaries(Collection<Long> sessionIds) {
        Map<Long, InventorySessionApi.Summary> result = new HashMap<>();
        if (sessionIds.isEmpty()) {
            return result;
        }
        String in = sessionIds.stream().map(String::valueOf).collect(Collectors.joining(","));
        Map<Long, Integer> surplus = new HashMap<>();
        jdbc.query("SELECT session_id, COALESCE(SUM(quantity), 0) FROM inventory_surplus WHERE session_id IN (" + in
                + ") GROUP BY session_id", rs -> {
                    surplus.put(rs.getLong(1), rs.getInt(2));
                });
        jdbc.query("""
                SELECT session_id, COUNT(*), COUNT(found),
                       COUNT(*) FILTER (WHERE found AND expected_room_id IS NOT DISTINCT FROM found_room_id
                                         AND NOT COALESCE(found_condition = 'HONG'
                                                          AND expected_condition IS DISTINCT FROM 'HONG', FALSE)),
                       COUNT(*) FILTER (WHERE NOT found),
                       COUNT(*) FILTER (WHERE found AND expected_room_id IS DISTINCT FROM found_room_id),
                       COUNT(*) FILTER (WHERE found AND found_condition = 'HONG'
                                         AND expected_condition IS DISTINCT FROM 'HONG')
                FROM inventory_lines WHERE session_id IN (%s) GROUP BY session_id""".formatted(in), rs -> {
                    long id = rs.getLong(1);
                    result.put(id, new InventorySessionApi.Summary(rs.getInt(2), rs.getInt(3), rs.getInt(4),
                            rs.getInt(5), rs.getInt(6), rs.getInt(7), surplus.getOrDefault(id, 0)));
                });
        for (Long id : sessionIds) {
            result.computeIfAbsent(id, k -> new InventorySessionApi.Summary(0, 0, 0, 0, 0, 0,
                    surplus.getOrDefault(k, 0)));
        }
        return result;
    }

    @Override
    protected InventorySession initialize(InventorySession voucher) {
        voucher.getLines().size();
        voucher.getSurplus().size();
        return voucher;
    }

    @Override
    protected Specification<InventorySession> filters(ListParams params) {
        List<Specification<InventorySession>> specs = new ArrayList<>();
        for (ListParams.Criterion c : params.filters()) {
            Specification<InventorySession> spec = switch (c.field()) {
                case "inventoryDate" -> VoucherSpecs.date("inventoryDate", c);
                case "campaign.id" -> (root, q, cb) -> cb.equal(root.get("campaign").get("id"), Long.valueOf(c.value()));
                default -> null;
            };
            if (spec != null) {
                specs.add(spec);
            }
        }
        params.search().ifPresent(term -> specs.add((root, q, cb) -> cb.or(
                ListParams.foldedLike(cb, root.get("code"), term),
                ListParams.foldedLike(cb, root.get("title"), term))));
        return Specification.allOf(specs);
    }

    @Override
    protected Set<String> sortable() {
        return Set.of("id", "code", "status", "inventoryDate", "createdAt", "updatedAt");
    }

    /** Hình dạng phạm vi cơ sở của biên bản kiểm kê — {@code InventoryCampaignService} dùng lại. */
    public static final VoucherCampus.Shape CAMPUS = VoucherCampus.Shape.of(List.of("room"), List.of(),
            new VoucherCampus.Line("lines", List.of("expectedRoom", "foundRoom"), List.of("equipment")),
            new VoucherCampus.Line("surplus", List.of("room"), List.of()));

    /** Phạm vi cơ sở: Phòng kiểm kê ở đầu phiếu; dòng: thiết bị, phòng theo sổ, phòng thấy; thừa: phòng thấy. */
    @Override
    protected VoucherCampus.Shape campusShape() {
        return CAMPUS;
    }
}
