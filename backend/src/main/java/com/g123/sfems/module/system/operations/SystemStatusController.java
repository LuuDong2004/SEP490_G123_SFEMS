package com.g123.sfems.module.system.operations;

import com.g123.sfems.module.security.user.service.UserService;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.security.CurrentUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@code /api/system_status} — tình trạng vận hành và sao lưu.
 * {@code POST /backups} chạy một lần sao lưu ngay (ví dụ trước khi nâng cấp);
 * {@code POST /backups/{name}/restore} khôi phục từ một bản — đòi gõ lại tên bản và mật khẩu.
 */
@RestController
@RequestMapping("/api/system_status")
public class SystemStatusController {

    private final SystemStatusService status;
    private final BackupService backups;
    private final UserService users;

    public SystemStatusController(SystemStatusService status, BackupService backups, UserService users) {
        this.status = status;
        this.backups = backups;
        this.users = users;
    }

    /** Xác nhận khôi phục: gõ lại đúng tên bản sao lưu, và mật khẩu của chính người bấm. */
    public record RestoreRequest(
            @Size(max = 255, message = "Tên bản sao lưu tối đa 255 ký tự") String confirm,
            @Size(max = 128, message = "Mật khẩu tối đa 128 ký tự") String password) {
    }

    @GetMapping
    @PreAuthorize("hasAuthority('system_status:read')")
    public SystemStatusService.Status status() {
        return status.status();
    }

    @GetMapping("/backups")
    @PreAuthorize("hasAuthority('system_status:read')")
    public List<BackupService.BackupFile> backups() {
        return backups.list();
    }

    @PostMapping("/backups")
    @PreAuthorize("hasAuthority('system_status:write')")
    public BackupService.Result backupNow() {
        return backups.run();
    }

    /**
     * Khôi phục cơ sở dữ liệu từ một bản sao lưu — ghi đè toàn bộ dữ liệu đang chạy, nên hỏi lại hai lần: tên bản
     * phải gõ lại đúng, mật khẩu phải đúng của người đang đăng nhập. Bản hiện tại được sao lưu trước.
     */
    @PostMapping("/backups/{name}/restore")
    @PreAuthorize("hasAuthority('system_status:write')")
    public BackupService.Result restore(@PathVariable String name, @Valid @RequestBody RestoreRequest request) {
        if (request == null || !name.equals(request.confirm() == null ? null : request.confirm().trim())) {
            throw new FieldValidationException("confirm", "Gõ lại đúng tên bản sao lưu để xác nhận");
        }
        Long me = CurrentUser.id().orElseThrow();
        if (!users.passwordMatches(me, request.password())) {
            throw new FieldValidationException("password", "Mật khẩu không đúng");
        }
        return backups.restore(name);
    }
}
