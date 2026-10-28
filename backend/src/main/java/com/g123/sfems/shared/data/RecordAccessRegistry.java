package com.g123.sfems.shared.data;

import com.g123.sfems.shared.exception.ResourceNotFoundException;
import com.g123.sfems.shared.security.CurrentUser;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

/**
 * Tra {@link RecordAccess} theo tên tài nguyên, và kiểm cả hai tầng quyền một
 * lượt: mã quyền {@code <resource>:read|write} rồi phạm vi dữ liệu của bản ghi.
 *
 * <p>Một tài nguyên không có bean nào thì bị từ chối như không tồn tại — tệp
 * đính kèm không được thành đường vòng để đọc thứ mà chính tài nguyên đó không
 * cho đọc.
 */
@Component
public class RecordAccessRegistry {

    private final Map<String, RecordAccess> byResource = new HashMap<>();

    public RecordAccessRegistry(List<RecordAccess> accesses) {
        for (RecordAccess access : accesses) {
            if (byResource.put(access.resource(), access) != null) {
                throw new IllegalStateException("Hai RecordAccess cho cùng tài nguyên " + access.resource());
            }
        }
    }

    public void checkReadable(String resource, Long id) {
        RecordAccess access = access(resource, id);
        requireAuthority(access.permission() + ":read");
        access.checkReadable(id);
    }

    public void checkWritable(String resource, Long id) {
        RecordAccess access = access(resource, id);
        requireAuthority(access.permission() + ":write");
        access.checkWritable(id);
    }

    private RecordAccess access(String resource, Long id) {
        RecordAccess access = byResource.get(resource);
        if (access == null) {
            throw new ResourceNotFoundException(resource, id);
        }
        return access;
    }

    private static void requireAuthority(String code) {
        if (!CurrentUser.has(code)) {
            throw new AccessDeniedException(code);
        }
    }
}
