package org.smarttech.controller;

import lombok.RequiredArgsConstructor;
import org.smarttech.scheduler.DailyConsumptionAggregator;
import org.smarttech.service.DataRetentionService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class AdminController {

    private final DailyConsumptionAggregator aggregator;
    private final DataRetentionService retentionService;

    /**
     * POST /api/v1/admin/aggregate?days=30
     * Manually trigger daily consumption aggregation.
     */
    @PostMapping("/aggregate")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> triggerAggregation(
            @RequestParam(defaultValue = "30") int days) {

        int processed = aggregator.aggregateRange(days);
        return ResponseEntity.ok(Map.of(
                "status", "done",
                "daysProcessed", processed
        ));
    }

    /**
     * POST /api/v1/admin/purge
     * Manually trigger data retention purge.
     *
     * Deletes:
     *   - meter_readings older than app.retention.raw-readings-days (default 90)
     *     ONLY for dates where daily_consumption already exists (safe guard)
     *   - daily_consumption older than app.retention.daily-consumption-days (default 1095)
     */
    @PostMapping("/purge")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> triggerPurge() {
        DataRetentionService.PurgeResult result = retentionService.purgeAll();
        return ResponseEntity.ok(Map.of(
                "status", "done",
                "rawReadingsDeleted", result.rawReadingsDeleted(),
                "dailyConsumptionDeleted", result.dailyConsumptionDeleted(),
                "rawRetentionDays", result.rawRetentionDays(),
                "dailyRetentionDays", result.dailyRetentionDays()
        ));
    }
}
