package com.g123.sfems.module.school.inventory;

import com.g123.sfems.domain.school.facility.FacilityCondition;
import com.g123.sfems.domain.school.facility.FacilityStructure;
import com.g123.sfems.shared.validation.FieldRule;
import com.g123.sfems.shared.validation.Text;
import java.time.Instant;
import java.util.List;
import java.util.Objects;

/** Payload và DTO của phần kiểm kê hạng mục CSVC ({@link InventoryFacilityService}). */
public final class InventoryFacilityApi {

    private InventoryFacilityApi() {
    }

    /**
     * Một hạng mục: khối nhà ({@code buildingId}) hoặc phòng / hạng mục ({@code roomId}). {@code *Before} — hồ sơ lúc
     * lập danh sách; {@code *Found} — thấy thực tế, trống = như sổ.
     */
    public record Line(Long id, Long roomId, Long buildingId, String code, String name, String typeName,
            String typeKind, String buildingName, String structureBefore, String conditionBefore,
            String structureFound, String conditionFound, boolean checked, String note, Instant appliedAt) {

        /** Đã kiểm và thấy khác hồ sơ ở kết cấu hoặc hiện trạng. */
        public boolean changed() {
            return checked && ((structureFound != null && !Objects.equals(structureFound, structureBefore))
                    || (conditionFound != null && !Objects.equals(conditionFound, conditionBefore)));
        }
    }

    /**
     * Danh sách và số tóm tắt. {@code editable} — phiếu còn nháp, ghi kết quả được; {@code applicable} — phiếu đã duyệt
     * và còn dòng khác sổ chưa áp vào hồ sơ.
     */
    public record Lines(List<Line> lines, int total, int checked, int changed, int applied, boolean editable,
            boolean applicable) {
    }

    /** Ghi kết quả một hạng mục. {@code checked} vắng = đã kiểm. */
    public record LineUpdate(FacilityStructure structureFound, FacilityCondition conditionFound, Boolean checked,
            @Text(value = FieldRule.NOTE, label = "Ghi chú") String note) {
    }

    /** Kết quả áp dụng: số hạng mục đã ghi vào hồ sơ. */
    public record Applied(int count) {
    }
}
