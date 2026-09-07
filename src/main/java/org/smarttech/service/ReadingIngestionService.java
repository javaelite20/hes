package org.smarttech.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.smarttech.dto.dcu.DcuReadingRequest;
import org.smarttech.entity.Meter;
import org.smarttech.entity.MeterReading;
import org.smarttech.repository.MeterReadingRepository;
import org.smarttech.repository.MeterRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReadingIngestionService {

    private final MeterRepository meterRepository;
    private final MeterReadingRepository meterReadingRepository;

    @Transactional
    public MeterReading ingest(DcuReadingRequest request, String source) {
        Meter meter = meterRepository.findByMeterNumber(request.getMeterNumber())
                .orElseThrow(() -> {
                    log.warn("[{}] Unknown meter: {}", source, request.getMeterNumber());
                    return new IllegalArgumentException(
                            "Meter not registered: " + request.getMeterNumber());
                });

        LocalDateTime recordedAt = parseRecordedAt(request.getRecordedAt());

        MeterReading saved = meterReadingRepository.save(
                MeterReading.builder()
                        .meter(meter)
                        .kwhValue(request.getKwhValue())
                        .instantPowerWatts(request.getInstantPowerWatts())
                        .recordedAt(recordedAt)
                        .build()
        );

        log.debug("[{}] meter={} kWh={} at={}", source,
                meter.getMeterNumber(), request.getKwhValue(), recordedAt);

        return saved;
    }

    private LocalDateTime parseRecordedAt(String recordedAt) {
        if (recordedAt == null || recordedAt.isBlank()) return LocalDateTime.now();
        try {
            return LocalDateTime.parse(recordedAt, DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        } catch (Exception e) {
            log.warn("Could not parse recorded_at '{}', using server time", recordedAt);
            return LocalDateTime.now();
        }
    }
}
