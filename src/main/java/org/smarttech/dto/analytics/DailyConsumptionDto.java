package org.smarttech.dto.analytics;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@Builder
public class DailyConsumptionDto {
    private LocalDate date;
    private BigDecimal unitsConsumed;
}
