package org.smarttech.dto.analytics;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
public class RealTimeReadingDto {
    private String meterNumber;
    private String flatNumber;
    private BigDecimal kwhValue;
    private BigDecimal instantPowerWatts;
    private LocalDateTime recordedAt;
}
