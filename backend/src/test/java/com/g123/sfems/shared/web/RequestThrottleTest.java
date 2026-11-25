package com.g123.sfems.shared.web;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class RequestThrottleTest {

    private static MockHttpServletRequest get(String path, String ip) {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", path);
        request.setRemoteAddr(ip);
        return request;
    }

    @Test
    void burstPassesThenAsksToSlowDown() throws Exception {
        RequestThrottle throttle = new RequestThrottle(true, 5, 1, 3, 1);
        for (int i = 0; i < 5; i++) {
            assertThat(throttle.preHandle(get("/api/rooms", "1.1.1.1"), new MockHttpServletResponse(), null)).isTrue();
        }
        MockHttpServletResponse response = new MockHttpServletResponse();
        assertThat(throttle.preHandle(get("/api/rooms", "1.1.1.1"), response, null)).isFalse();
        assertThat(response.getStatus()).isEqualTo(429);
        assertThat(response.getHeader("Retry-After")).isEqualTo("1");
        // Người khác không bị ảnh hưởng.
        assertThat(throttle.preHandle(get("/api/rooms", "2.2.2.2"), new MockHttpServletResponse(), null)).isTrue();
    }

    @Test
    void heavyRequestsQueueAndRunWhenASlotFrees() throws Exception {
        RequestThrottle throttle = new RequestThrottle(true, 100, 100, 1, 5);
        MockHttpServletRequest first = get("/api/reports/export", "1.1.1.1");
        assertThat(throttle.preHandle(first, new MockHttpServletResponse(), null)).isTrue();

        CompletableFuture<Boolean> second = CompletableFuture.supplyAsync(() -> {
            try {
                return throttle.preHandle(get("/api/reports/export", "1.1.1.1"), new MockHttpServletResponse(), null);
            } catch (Exception e) {
                throw new IllegalStateException(e);
            }
        });
        Thread.sleep(200);
        assertThat(second).isNotDone();
        throttle.afterCompletion(first, new MockHttpServletResponse(), null, null);
        assertThat(second.get(3, TimeUnit.SECONDS)).isTrue();
    }

    @Test
    void heavyRequestGivesUpAfterWaiting() throws Exception {
        RequestThrottle throttle = new RequestThrottle(true, 100, 100, 1, 1);
        assertThat(throttle.preHandle(get("/api/x/summary.xlsx", "1.1.1.1"), new MockHttpServletResponse(), null))
                .isTrue();
        MockHttpServletResponse response = new MockHttpServletResponse();
        assertThat(throttle.preHandle(get("/api/x/summary.xlsx", "1.1.1.1"), response, null)).isFalse();
        assertThat(response.getStatus()).isEqualTo(429);
        // Người khác vẫn chạy truy vấn nặng ngay — không có trần chung.
        assertThat(throttle.preHandle(get("/api/x/summary.xlsx", "2.2.2.2"), new MockHttpServletResponse(), null))
                .isTrue();
    }
}
