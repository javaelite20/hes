package org.smarttech.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Raw reading pushed by the DCU via MQTT.
 * Each record represents one reading snapshot from a meter.
 */
@Entity
@Table(name = "meter_readings", indexes = {
        @Index(name = "idx_meter_readings_meter_id", columnList = "meter_id"),
        @Index(name = "idx_meter_readings_recorded_at", columnList = "recorded_at")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MeterReading {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "meter_id", nullable = false)
    private Meter meter;

    /**
     * Cumulative kWh reading at the time of this snapshot (odometer-style).
     */
    @Column(name = "kwh_value", nullable = false, precision = 12, scale = 4)
    private BigDecimal kwhValue;

    /**
     * Instantaneous power in watts at time of reading.
     */
    @Column(name = "instant_power_watts", precision = 10, scale = 2)
    private BigDecimal instantPowerWatts;

    /**
     * Timestamp as reported by the DCU (device time).
     */
    @Column(name = "recorded_at", nullable = false)
    private LocalDateTime recordedAt;

    /**
     * Timestamp when this record was persisted to our DB.
     */
    @Column(name = "received_at", updatable = false)
    private LocalDateTime receivedAt;

    @PrePersist
    protected void onCreate() {
        receivedAt = LocalDateTime.now();
    }
}
