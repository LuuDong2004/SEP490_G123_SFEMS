package com.g123.sfems.module.school.inventory;

import java.time.LocalDate;

/** Sự kiện: một đợt kiểm kê vừa được phát động. */
record CampaignLaunched(Long managingBodyId, String title, LocalDate cutoffDate, LocalDate deadline) {
}
