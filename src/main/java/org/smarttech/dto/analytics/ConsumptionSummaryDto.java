package org.smarttech.dto.analytics;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
@Builder
public class ConsumptionSummaryDto {
    private String meterNumber;
    private String flatNumber;
    private LocalDate from;
    private LocalDate to;
    private BigDecimal totalUnitsConsumed;
    private List<DailyConsumptionDto> dailyBreakdown;
}
