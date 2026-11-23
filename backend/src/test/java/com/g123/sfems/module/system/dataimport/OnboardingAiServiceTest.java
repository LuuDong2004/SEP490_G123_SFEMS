package com.g123.sfems.module.system.dataimport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import com.anthropic.models.messages.MessageCreateParams;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Phần của AI gợi ý chạy được không cần mạng: lược đồ đầu ra hợp lệ, và chọn thiết bị ứng viên. */
class OnboardingAiServiceTest {

    private static OnboardingAiService.Catalog cat(String code, String name) {
        return new OnboardingAiService.Catalog(code, name, "Bộ", "Vật lý", OnboardingValidator.norm(name));
    }

    @Test
    void outputSchemaIsAccepted() {
        // SDK dựng lược đồ JSON từ record lúc build — lược đồ sai kiểu thì ném ngay ở đây, không đợi tới lần gọi thật.
        assertThatCode(() -> MessageCreateParams.builder()
                .model("claude-opus-5-5")
                .maxTokens(1000L)
                .outputConfig(OnboardingAiService.AiResult.class)
                .addUserMessage("{}")
                .build()).doesNotThrowAnyException();
    }

    @Test
    void candidatesRankByWordOverlap() {
        List<OnboardingAiService.Catalog> all = List.of(
                cat("THCS-27-001", "Bộ thí nghiệm điện học"),
                cat("THCS-27-002", "Bộ thí nghiệm quang học"),
                cat("THCS-08-001", "Bộ thước vẽ bảng"));
        List<OnboardingAiService.Catalog> picks = OnboardingAiService.candidates(all, "Bo TN dien hoc lop 9", null);
        assertThat(picks).isNotEmpty();
        assertThat(picks.getFirst().code()).isEqualTo("THCS-27-001");
    }

    @Test
    void typedCodeComesFirst() {
        List<OnboardingAiService.Catalog> all = List.of(
                cat("THCS-27-001", "Bộ thí nghiệm điện học"),
                cat("THCS-27-002", "Bộ thí nghiệm quang học"));
        assertThat(OnboardingAiService.candidates(all, "Bộ thí nghiệm điện học", "thcs-27-002").getFirst().code())
                .isEqualTo("THCS-27-002");
    }

    @Test
    void noOverlapNoCandidates() {
        assertThat(OnboardingAiService.candidates(List.of(cat("A", "Máy chiếu")), "Bàn ghế học sinh", null)).isEmpty();
    }
}
