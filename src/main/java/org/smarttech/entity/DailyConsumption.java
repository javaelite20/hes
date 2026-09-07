package org.smarttech.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Pre-aggregated daily consumption per meter.
 * Populated by a scheduled job from raw MeterReadings.
 */
@Entity
@Table(name = "daily_consumption",
        uniqueConstraints = @UniqueConstraint(columnNames = {"meter_id", "date"}),
        indexes = {
                @Index(name = "idx_daily_consumption_meter_date", columnList = "meter_id, date")
        })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DailyConsumption {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "meter_id", nullable = false)
    private Meter meter;

    @Column(nullable = false)
    private LocalDate date;

    /**
     * Total kWh consumed on this day (last reading - first reading of the day).
     */
    @Column(name = "units_consumed", nullable = false, precision = 10, scale = 4)
    private BigDecimal unitsConsumed;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    protected void onSave() {
        updatedAt = LocalDateTime.now();
    }
}
