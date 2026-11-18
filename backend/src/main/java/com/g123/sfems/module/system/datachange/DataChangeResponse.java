package com.g123.sfems.module.system.datachange;

import com.g123.sfems.domain.system.datachange.DataChange;
import java.time.Instant;

/** Một dòng lịch sử thay đổi: ai, lúc nào, bản ghi nào, trường nào, cũ → mới. */
public record DataChangeResponse(Long id, Instant createdAt, Long actorId, String actorName, String resource,
        Long recordId, String recordLabel, String field, String oldValue, String newValue) {

    public static DataChangeResponse from(DataChange c) {
        return new DataChangeResponse(c.getId(), c.getCreatedAt(), c.getActorId(), c.getActorName(),
                c.getResource(), c.getRecordId(), c.getRecordLabel(), c.getField(), c.getOldValue(),
                c.getNewValue());
    }
}
