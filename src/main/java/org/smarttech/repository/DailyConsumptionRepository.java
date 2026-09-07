package org.smarttech.repository;

import org.smarttech.entity.DailyConsumption;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface DailyConsumptionRepository extends JpaRepository<DailyConsumption, Long> {

    Optional<DailyConsumption> findByMeterIdAndDate(Long meterId, LocalDate date);

    List<DailyConsumption> findAllByMeterIdAndDateBetweenOrderByDate(
            Long meterId, LocalDate from, LocalDate to);

    /**
     * Purge daily consumption records older than the cutoff date.
     */
    @Modifying
    @Query("DELETE FROM DailyConsumption dc WHERE dc.date < :cutoff")
    long deleteByDateBefore(@Param("cutoff") LocalDate cutoff);
}
