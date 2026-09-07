package org.smarttech.repository;

import org.smarttech.entity.MeterReading;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface MeterReadingRepository extends JpaRepository<MeterReading, Long> {

    Optional<MeterReading> findTopByMeterIdOrderByRecordedAtDesc(Long meterId);

    List<MeterReading> findAllByMeterIdAndRecordedAtBetweenOrderByRecordedAt(
            Long meterId, LocalDateTime from, LocalDateTime to);

    @Query("""
            SELECT mr FROM MeterReading mr
            WHERE mr.meter.id = :meterId
              AND mr.recordedAt >= :from
              AND mr.recordedAt < :to
            ORDER BY mr.recordedAt ASC
            LIMIT 1
            """)
    Optional<MeterReading> findFirstReadingOfDay(
            @Param("meterId") Long meterId,
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to);

    @Query("""
            SELECT mr FROM MeterReading mr
            WHERE mr.meter.id = :meterId
              AND mr.recordedAt >= :from
              AND mr.recordedAt < :to
            ORDER BY mr.recordedAt DESC
            LIMIT 1
            """)
    Optional<MeterReading> findLastReadingOfDay(
            @Param("meterId") Long meterId,
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to);

    /**
     * Purge raw readings older than cutoff date — but ONLY for dates where
     * daily_consumption already exists (aggregation was completed for that day).
     *
     * This is the safety guard: we never delete raw data that hasn't been
     * aggregated yet, even if it's older than the retention window.
     */
    @Modifying
    @Query("""
            DELETE FROM MeterReading mr
            WHERE CAST(mr.recordedAt AS LocalDate) < :cutoff
              AND EXISTS (
                SELECT 1 FROM DailyConsumption dc
                WHERE dc.meter.id = mr.meter.id
                  AND dc.date = CAST(mr.recordedAt AS LocalDate)
              )
            """)
    long deleteAggregatedBefore(@Param("cutoff") LocalDate cutoff);
}
