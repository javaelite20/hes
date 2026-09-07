package org.smarttech.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.smarttech.repository.DailyConsumptionRepository;
import org.smarttech.repository.MeterReadingRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

@Slf4j
@Service
@RequiredArgsConstructor
public class DataRetentionService {

    private final MeterReadingRepository meterReadingRepository;
    private final DailyConsumptionRepository dailyConsumptionRepository;

    @Value("${app.retention.raw-readings-days:90}")
    private int rawReadingsDays;

    @Value("${app.retention.daily-consumption-days:1095}")
    private int dailyConsumptionDays;

    /**
     * Purge raw meter readings older than the configured retention period.
     *
     * Safety rule: only delete readings for dates where daily_consumption
     * already exists — guarantees aggregated data was captured before purge.
     *
     * @return number of rows deleted
     */
    @Transactional
    public long purgeRawReadings() {
        LocalDate cutoff = LocalDate.now().minusDays(rawReadingsDays);
        long deleted = meterReadingRepository.deleteAggregatedBefore(cutoff);
        log.info("Purge raw readings — cutoff: {}, deleted: {} rows", cutoff, deleted);
        return deleted;
    }

    /**
     * Purge daily_consumption records older than the configured retention period.
     *
     * @return number of rows deleted
     */
    @Transactional
    public long purgeDailyConsumption() {
        LocalDate cutoff = LocalDate.now().minusDays(dailyConsumptionDays);
        long deleted = dailyConsumptionRepository.deleteByDateBefore(cutoff);
        log.info("Purge daily consumption — cutoff: {}, deleted: {} rows", cutoff, deleted);
        return deleted;
    }

    /**
     * Run both purge operations and return a combined summary.
     */
    @Transactional
    public PurgeResult purgeAll() {
        long readings = purgeRawReadings();
        long daily    = purgeDailyConsumption();
        return new PurgeResult(readings, daily, rawReadingsDays, dailyConsumptionDays);
    }

    public record PurgeResult(
            long rawReadingsDeleted,
            long dailyConsumptionDeleted,
            int rawRetentionDays,
            int dailyRetentionDays
    ) {}
}
