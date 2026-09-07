package org.smarttech.scheduler;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.smarttech.entity.DailyConsumption;
import org.smarttech.entity.Meter;
import org.smarttech.entity.MeterReading;
import org.smarttech.repository.DailyConsumptionRepository;
import org.smarttech.repository.MeterReadingRepository;
import org.smarttech.repository.MeterRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

@Slf4j
@Component
@RequiredArgsConstructor
public class DailyConsumptionAggregator {

    private final MeterRepository meterRepository;
    private final MeterReadingRepository meterReadingRepository;
    private final DailyConsumptionRepository dailyConsumptionRepository;

    @Scheduled(cron = "0 0 * * * *")
    @Transactional
    public void aggregateToday() {
        aggregate(LocalDate.now());
    }

    @Scheduled(cron = "0 5 0 * * *")
    @Transactional
    public void aggregateYesterday() {
        aggregate(LocalDate.now().minusDays(1));
    }

    @Transactional
    public int aggregateRange(int days) {
        log.info("Manual aggregation: {} days", days);
        for (int i = days - 1; i >= 0; i--) {
            aggregate(LocalDate.now().minusDays(i));
        }
        return days;
    }

    private void aggregate(LocalDate date) {
        List<Meter> meters = meterRepository.findAll();
        int count = 0;
        for (Meter meter : meters) {
            try {
                if (aggregateForMeter(meter, date)) count++;
            } catch (Exception e) {
                log.error("Aggregation failed — meter: {}, date: {}, reason: {}",
                        meter.getMeterNumber(), date, e.getMessage());
            }
        }
        log.info("Aggregation done — date: {}, meters: {}/{}", date, count, meters.size());
    }

    private boolean aggregateForMeter(Meter meter, LocalDate date) {
        LocalDateTime dayStart = date.atStartOfDay();
        LocalDateTime dayEnd   = date.atTime(LocalTime.MAX);

        Optional<MeterReading> firstOpt =
                meterReadingRepository.findFirstReadingOfDay(meter.getId(), dayStart, dayEnd);
        Optional<MeterReading> lastOpt =
                meterReadingRepository.findLastReadingOfDay(meter.getId(), dayStart, dayEnd);

        if (firstOpt.isEmpty() || lastOpt.isEmpty()) return false;

        BigDecimal consumed = lastOpt.get().getKwhValue()
                .subtract(firstOpt.get().getKwhValue())
                .max(BigDecimal.ZERO);

        DailyConsumption record = dailyConsumptionRepository
                .findByMeterIdAndDate(meter.getId(), date)
                .orElseGet(() -> DailyConsumption.builder().meter(meter).date(date).build());

        record.setUnitsConsumed(consumed);
        dailyConsumptionRepository.save(record);
        return true;
    }
}
