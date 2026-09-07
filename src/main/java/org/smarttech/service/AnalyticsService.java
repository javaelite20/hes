package org.smarttech.service;

import lombok.RequiredArgsConstructor;
import org.smarttech.dto.analytics.ConsumptionSummaryDto;
import org.smarttech.dto.analytics.DailyConsumptionDto;
import org.smarttech.dto.analytics.RealTimeReadingDto;
import org.smarttech.entity.DailyConsumption;
import org.smarttech.entity.Meter;
import org.smarttech.entity.MeterReading;
import org.smarttech.repository.DailyConsumptionRepository;
import org.smarttech.repository.MeterReadingRepository;
import org.smarttech.repository.MeterRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AnalyticsService {

    private final MeterRepository meterRepository;
    private final MeterReadingRepository meterReadingRepository;
    private final DailyConsumptionRepository dailyConsumptionRepository;

    /**
     * Returns the most recent reading for the meter owned by the given user.
     */
    @Transactional(readOnly = true)
    public RealTimeReadingDto getRealTimeReading(Long userId) {
        Meter meter = getMeterfByUserId(userId);
        return getRealTimeReadingForMeter(meter);
    }

    /**
     * Admin version — lookup by meter ID directly.
     */
    @Transactional(readOnly = true)
    public RealTimeReadingDto getRealTimeReadingByMeterId(Long meterId) {
        Meter meter = meterRepository.findById(meterId)
                .orElseThrow(() -> new IllegalArgumentException("Meter not found: " + meterId));
        return getRealTimeReadingForMeter(meter);
    }

    /**
     * Daily consumption for the last N days for the resident's meter.
     */
    @Transactional(readOnly = true)
    public ConsumptionSummaryDto getDailyConsumption(Long userId, LocalDate from, LocalDate to) {
        Meter meter = getMeterfByUserId(userId);
        return buildSummary(meter, from, to);
    }

    /**
     * Admin version — lookup by meter ID.
     */
    @Transactional(readOnly = true)
    public ConsumptionSummaryDto getDailyConsumptionByMeterId(Long meterId, LocalDate from, LocalDate to) {
        Meter meter = meterRepository.findById(meterId)
                .orElseThrow(() -> new IllegalArgumentException("Meter not found: " + meterId));
        return buildSummary(meter, from, to);
    }

    // ── internals ──────────────────────────────────────────────────────────────

    private RealTimeReadingDto getRealTimeReadingForMeter(Meter meter) {
        MeterReading latest = meterReadingRepository
                .findTopByMeterIdOrderByRecordedAtDesc(meter.getId())
                .orElseThrow(() -> new IllegalArgumentException(
                        "No readings available for meter: " + meter.getMeterNumber()));

        return RealTimeReadingDto.builder()
                .meterNumber(meter.getMeterNumber())
                .flatNumber(meter.getFlatNumber())
                .kwhValue(latest.getKwhValue())
                .instantPowerWatts(latest.getInstantPowerWatts())
                .recordedAt(latest.getRecordedAt())
                .build();
    }

    private ConsumptionSummaryDto buildSummary(Meter meter, LocalDate from, LocalDate to) {
        List<DailyConsumption> records =
                dailyConsumptionRepository.findAllByMeterIdAndDateBetweenOrderByDate(meter.getId(), from, to);

        List<DailyConsumptionDto> dailyDtos = records.stream()
                .map(r -> DailyConsumptionDto.builder()
                        .date(r.getDate())
                        .unitsConsumed(r.getUnitsConsumed())
                        .build())
                .toList();

        BigDecimal total = records.stream()
                .map(DailyConsumption::getUnitsConsumed)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return ConsumptionSummaryDto.builder()
                .meterNumber(meter.getMeterNumber())
                .flatNumber(meter.getFlatNumber())
                .from(from)
                .to(to)
                .totalUnitsConsumed(total)
                .dailyBreakdown(dailyDtos)
                .build();
    }

    private Meter getMeterfByUserId(Long userId) {
        return meterRepository.findByUserId(userId)
                .orElseThrow(() -> new IllegalArgumentException("No meter assigned to user: " + userId));
    }
}
