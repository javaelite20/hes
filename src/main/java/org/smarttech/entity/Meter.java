package org.smarttech.entity;

import jakarta.persistence.*;
import lombok.*;
import org.smarttech.entity.enums.MeterStatus;

import java.time.LocalDateTime;

@Entity
@Table(name = "meters")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Meter {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * Unique meter identifier as sent by the DCU (e.g. "MTR-001")
     */
    @Column(name = "meter_number", nullable = false, unique = true)
    private String meterNumber;

    /**
     * The DCU device this meter belongs to (e.g. "DCU-A1")
     */
    @Column(name = "dcu_id", nullable = false)
    private String dcuId;

    @Column(name = "flat_number", nullable = false)
    private String flatNumber;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private MeterStatus status;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(name = "installed_at")
    private LocalDateTime installedAt;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (status == null) {
            status = MeterStatus.ACTIVE;
        }
    }
}
