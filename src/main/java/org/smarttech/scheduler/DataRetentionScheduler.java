package org.smarttech.scheduler;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.smarttech.service.DataRetentionService;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Runs weekly to purge stale data and keep table sizes in check.
 *
 * Schedule: every Sunday at 02:00 — low-traffic window.
 * Retention periods are configurable in application.yml:
 *   app.retention.raw-readings-days      (default 90)
 *   app.retention.daily-consumption-days (default 1095 / 3 years)
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DataRetentionScheduler {

    private final DataRetentionService retentionService;

    // Every Sunday at 02:00
    @Scheduled(cron = "0 0 2 * * SUN")
    public void runWeeklyPurge() {
        log.info("Data retention job started");
        DataRetentionService.PurgeResult result = retentionService.purgeAll();
        log.info("Data retention done — raw readings: {}, daily consumption: {}",
                result.rawReadingsDeleted(), result.dailyConsumptionDeleted());
    }
}
