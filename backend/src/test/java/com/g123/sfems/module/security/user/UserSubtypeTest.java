package com.g123.sfems.module.security.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.g123.sfems.domain.security.user.SchoolUser;
import com.g123.sfems.domain.security.user.SoUser;
import com.g123.sfems.domain.security.user.SystemUser;
import com.g123.sfems.domain.security.user.User;
import com.g123.sfems.domain.security.user.UserPosition;
import com.g123.sfems.domain.security.user.UserStatus;
import com.g123.sfems.module.security.user.api.dto.RoleRef;
import com.g123.sfems.module.security.user.api.dto.SchoolRef;
import com.g123.sfems.module.security.user.api.dto.UserPatchRequest;
import com.g123.sfems.module.security.user.api.dto.UserProfileRequest;
import com.g123.sfems.module.security.user.api.dto.UserRequest;
import com.g123.sfems.module.security.user.repo.UserRepository;
import com.g123.sfems.module.security.user.service.UserService;
import com.g123.sfems.shared.exception.ConflictException;
import com.g123.sfems.shared.exception.FieldValidationException;
import com.g123.sfems.shared.security.JwtService;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.transaction.annotation.Transactional;

/**
 * Tài khoản tách theo loại thành bảng con (docs/kien-truc/11, changelog 232 / 233): mỗi loại đúng lớp, đúng bảng;
 * đơn vị công tác không đổi được; ô của loại khác bị từ chối; quản trị cấp cao mới quản lý được quản trị khác; CSDL
 * tự chặn tài khoản Sở gắn vào UBND. Chạy trong giao dịch, lùi hết sau mỗi test.
 */
@SpringBootTest
@Transactional
class UserSubtypeTest {

    @Autowired
    UserRepository users;

    @Autowired
    UserService service;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    JwtService jwt;

    @Autowired
    JwtDecoder decoder;

    @AfterEach
    void signOut() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void everyAccountLoadsAsItsOwnSubclass() {
        assertThat(demo("thcs.canbo")).isInstanceOf(SchoolUser.class);
        assertThat(demo("so.lanhdao")).isInstanceOf(SoUser.class);
        assertThat(demo("admin")).isInstanceOf(SystemUser.class);
        assertThat(((SoUser) demo("so.lanhdao")).getPosition()).isEqualTo(UserPosition.LEADER);
        assertThat(((SchoolUser) demo("thcs.canbo")).getPosition()).isEqualTo(UserPosition.STAFF);
        assertThat(((SchoolUser) demo("thcs.canbo")).getSchool()).isNotNull();
    }

    @Test
    void everyAccountHasExactlyOneSubtypeRow() {
        Long wrong = jdbc.queryForObject("""
                SELECT count(*) FROM users u
                WHERE (SELECT count(*) FROM (SELECT id FROM user_systems UNION ALL SELECT id FROM user_sos
                                             UNION ALL SELECT id FROM user_schools) c
                       WHERE c.id = u.id) <> 1""", Long.class);
        assertThat(wrong).isZero();
    }

    @Test
    void schoolOfAnAccountCannotChange() {
        SchoolUser member = (SchoolUser) demo("thcs.canbo");
        Long other = jdbc.queryForObject("SELECT min(id) FROM schools WHERE id <> ?", Long.class,
                member.getSchool().getId());
        assertThatThrownBy(() -> service.update(member.getId(), patch(new SchoolRef(other), null)))
                .isInstanceOf(FieldValidationException.class);
        // Gửi lại đúng trường đang có thì không phải đổi.
        service.update(member.getId(), patch(new SchoolRef(member.getSchool().getId()), null));
    }

    @Test
    void profileFieldOfAnotherTypeIsRejected() {
        User member = demo("thcs.canbo");
        signIn("admin");
        assertThatThrownBy(() -> service.update(member.getId(),
                patch(null, new UserProfileRequest(null, null, null, true, null))))
                .isInstanceOf(FieldValidationException.class);
        assertThatThrownBy(() -> service.update(member.getId(),
                patch(null, new UserProfileRequest(null, "0912345678", null, null, null))))
                .isInstanceOf(FieldValidationException.class);
        User saved = service.update(member.getId(), patch(null, new UserProfileRequest("Cán bộ thiết bị", null, null,
                null, null)));
        assertThat(((SchoolUser) saved).getJobTitle()).isEqualTo("Cán bộ thiết bị");
    }

    @Test
    void onlySuperAdminManagesOtherAdmins() {
        User admin = demo("admin");
        signIn("admin");
        Long adminRole = jdbc.queryForObject("SELECT id FROM roles WHERE code = 'ADMIN'", Long.class);
        User plain = service.create(new UserRequest("qt.thuong.test", "qt.thuong.test@qltb.local", "Quản trị thường",
                "Qx7#Tram-Vung!9", UserStatus.ACTIVE, null, null, List.of(new RoleRef(adminRole)), null));
        assertThat(plain).isInstanceOf(SystemUser.class);
        assertThat(((SystemUser) plain).isSuperAdmin()).isFalse();

        signIn(plain);
        assertThatThrownBy(() -> service.update(admin.getId(),
                patch(null, new UserProfileRequest("Đổi", null, null, null, null))))
                .isInstanceOf(ConflictException.class);
        // Tự nâng mình lên cấp cao cũng không được.
        assertThatThrownBy(() -> service.update(plain.getId(),
                patch(null, new UserProfileRequest(null, null, null, true, null))))
                .isInstanceOf(ConflictException.class);

        signIn("admin");
        User saved = service.update(plain.getId(),
                patch(null, new UserProfileRequest(null, null, null, null, "10.0.0.5, 192.168.1.0/24")));
        assertThat(((SystemUser) saved).allowedIpList()).containsExactly("10.0.0.5", "192.168.1.0/24");
        assertThatThrownBy(() -> service.update(plain.getId(),
                patch(null, new UserProfileRequest(null, null, null, null, "khong-phai-ip"))))
                .isInstanceOf(FieldValidationException.class);
    }

    @Test
    void lastSuperAdminCannotStepDown() {
        Long supers = users.countActiveSuperAdmins();
        Assumptions.assumeTrue(supers == 1, "Có hơn một quản trị cấp cao");
        User admin = demo("admin");
        signIn("admin");
        assertThatThrownBy(() -> service.update(admin.getId(),
                patch(null, new UserProfileRequest(null, null, null, false, null))))
                .isInstanceOf(ConflictException.class);
    }

    private User demo(String username) {
        User user = users.findByUsernameOrEmail(username).orElse(null);
        Assumptions.assumeTrue(user != null, "Thiếu tài khoản demo " + username);
        return user;
    }

    private void signIn(String username) {
        signIn(demo(username));
    }

    private void signIn(User user) {
        String token = jwt.issueAccessToken(user, Instant.now(), null);
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(decoder.decode(token)));
    }

    private static UserPatchRequest patch(SchoolRef school, UserProfileRequest profile) {
        return new UserPatchRequest(null, null, null, null, school, null, null, profile);
    }
}
