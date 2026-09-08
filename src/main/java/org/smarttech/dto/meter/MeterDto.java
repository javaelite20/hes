package org.smarttech.dto.meter;

import lombok.Builder;
import lombok.Data;
import org.smarttech.entity.enums.MeterStatus;

import java.time.LocalDateTime;

@Data
@Builder
public class MeterDto {
    private Long id;
    private String meterNumber;
    private String dcuId;
    private String flatNumber;
    private MeterStatus status;
    private String userId;
    private String userName;
    private LocalDateTime installedAt;
}
