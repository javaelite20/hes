package org.smarttech.controller;

import lombok.RequiredArgsConstructor;
import org.smarttech.dto.analytics.ConsumptionSummaryDto;
import org.smarttech.dto.analytics.RealTimeReadingDto;
import org.smarttech.repository.UserRepository;
import org.smarttech.service.AnalyticsService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/v1/analytics")
@RequiredArgsConstructor
public class AnalyticsController {

    private final AnalyticsService analyticsService;
    private final UserRepository userRepository;

    // ── Resident endpoints ────────────────────────────────────────────────────

    /**
     * GET /api/v1/analytics/my/realtime
     * Resident: get their latest meter reading.
     */
    @GetMapping("/my/realtime")
    @PreAuthorize("hasRole('RESIDENT')")
    public ResponseEntity<RealTimeReadingDto> getMyRealTimeReading(
            @AuthenticationPrincipal UserDetails userDetails) {
        Long userId = resolveUserId(userDetails);
        return ResponseEntity.ok(analyticsService.getRealTimeReading(userId));
    }

    /**
     * GET /api/v1/analytics/my/daily?from=2024-05-01&to=2024-05-07
     * Resident: daily consumption for a date range (defaults to last 7 days).
     */
    @GetMapping("/my/daily")
    @PreAuthorize("hasRole('RESIDENT')")
    public ResponseEntity<ConsumptionSummaryDto> getMyDailyConsumption(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {

        LocalDate end = to != null ? to : LocalDate.now();
        LocalDate start = from != null ? from : end.minusDays(6);   // last 7 days default

        Long userId = resolveUserId(userDetails);
        return ResponseEntity.ok(analyticsService.getDailyConsumption(userId, start, end));
    }

    /**
     * GET /api/v1/analytics/my/weekly
     * Resident: last 7 days of consumption (convenience alias).
     */
    @GetMapping("/my/weekly")
    @PreAuthorize("hasRole('RESIDENT')")
    public ResponseEntity<ConsumptionSummaryDto> getMyWeeklyConsumption(
            @AuthenticationPrincipal UserDetails userDetails) {
        Long userId = resolveUserId(userDetails);
        LocalDate to = LocalDate.now();
        LocalDate from = to.minusDays(6);
        return ResponseEntity.ok(analyticsService.getDailyConsumption(userId, from, to));
    }

    // ── Admin endpoints ───────────────────────────────────────────────────────

    /**
     * GET /api/v1/analytics/meters/{meterId}/realtime
     * Admin: real-time reading for any meter.
     */
    @GetMapping("/meters/{meterId}/realtime")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<RealTimeReadingDto> getRealTimeByMeter(@PathVariable Long meterId) {
        return ResponseEntity.ok(analyticsService.getRealTimeReadingByMeterId(meterId));
    }

    /**
     * GET /api/v1/analytics/meters/{meterId}/daily?from=2024-05-01&to=2024-05-31
     * Admin: daily consumption for any meter.
     */
    @GetMapping("/meters/{meterId}/daily")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ConsumptionSummaryDto> getDailyByMeter(
            @PathVariable Long meterId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {

        LocalDate end = to != null ? to : LocalDate.now();
        LocalDate start = from != null ? from : end.minusDays(6);

        return ResponseEntity.ok(analyticsService.getDailyConsumptionByMeterId(meterId, start, end));
    }

    // ── helper ────────────────────────────────────────────────────────────────

    private Long resolveUserId(UserDetails userDetails) {
        return userRepository.findByLoginId(userDetails.getUsername())
                .orElseThrow(() -> new IllegalArgumentException("User not found"))
                .getId();
    }
}
