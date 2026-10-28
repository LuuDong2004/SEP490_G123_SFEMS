package com.g123.sfems.module.security.user.api;

import com.g123.sfems.domain.security.user.UserStatus;
import com.g123.sfems.module.security.user.api.dto.UserResponse;
import com.g123.sfems.module.security.user.service.SchoolUserService;
import com.g123.sfems.module.security.user.service.SchoolUserService.Issued;
import com.g123.sfems.shared.web.ListParams;
import com.g123.sfems.shared.web.ListResponse;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@code /api/school_users} — tài khoản của trường người gọi (mã quyền {@code school_users:*}, 092).
 * Cùng dialect danh sách với mọi resource; xem {@link SchoolUserService} về các giới hạn.
 */
@RestController
@RequestMapping("/api/school_users")
public class SchoolUserController {

    private final SchoolUserService service;

    public SchoolUserController(SchoolUserService service) {
        this.service = service;
    }

    public record CreateRequest(String username, String fullName, String email, String role) {
    }

    public record PatchRequest(String fullName, String email, String role, UserStatus status) {
    }

    /** Tài khoản kèm mật khẩu tạm — chỉ ở lần tạo / đặt lại. */
    public record IssuedResponse(UserResponse user, String temporaryPassword) {
        static IssuedResponse of(Issued issued) {
            return new IssuedResponse(UserResponse.from(issued.user()), issued.temporaryPassword());
        }
    }

    @GetMapping
    @PreAuthorize("hasAuthority('school_users:read')")
    public ResponseEntity<List<UserResponse>> list(@RequestParam MultiValueMap<String, String> query) {
        Page<UserResponse> page = service.list(new ListParams(query)).map(UserResponse::from);
        return ListResponse.of(page.getContent(), page.getTotalElements());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('school_users:read')")
    public UserResponse get(@PathVariable Long id) {
        return UserResponse.from(service.get(id));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('school_users:write')")
    public IssuedResponse create(@RequestBody CreateRequest request) {
        return IssuedResponse.of(service.create(request.username(), request.fullName(), request.email(), request.role()));
    }

    @RequestMapping(value = "/{id}", method = {RequestMethod.PATCH, RequestMethod.PUT})
    @PreAuthorize("hasAuthority('school_users:write')")
    public UserResponse update(@PathVariable Long id, @RequestBody PatchRequest request) {
        return UserResponse.from(service.update(id, request.fullName(), request.email(), request.role(), request.status()));
    }

    @PostMapping("/{id}/password")
    @PreAuthorize("hasAuthority('school_users:write')")
    public IssuedResponse resetPassword(@PathVariable Long id) {
        return IssuedResponse.of(service.resetPassword(id));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('school_users:delete')")
    public UserResponse delete(@PathVariable Long id) {
        return UserResponse.from(service.delete(id));
    }
}
