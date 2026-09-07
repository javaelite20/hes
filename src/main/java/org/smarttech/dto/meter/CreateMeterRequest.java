package org.smarttech.dto.meter;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreateMeterRequest {

    @NotBlank(message = "Meter number is required")
    private String meterNumber;

    @NotBlank(message = "DCU ID is required")
    private String dcuId;

    @NotBlank(message = "Flat number is required")
    private String flatNumber;

    // Optional — meter can be created before assigning to a user
    private Long userId;
}
