package org.smarttech.dto.dcu;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

/**
 * Reading payload sent by the DCU — shared by both integration modes.
 *
 * REST mode : DCU POSTs this JSON to /api/v1/dcu/readings
 * MQTT mode : this same structure is deserialized from the MQTT message payload
 *
 * Example:
 * {
 *   "meter_number":        "MTR-001",
 *   "kwh_value":           1234.5678,
 *   "instant_power_watts": 450.0,
 *   "recorded_at":         "2024-05-01T10:30:00"
 * }
 */
@Data
public class DcuReadingRequest {

    @NotBlank(message = "meter_number is required")
    @JsonProperty("meter_number")
    private String meterNumber;

    @NotNull(message = "kwh_value is required")
    @DecimalMin(value = "0.0", message = "kwh_value must be non-negative")
    @JsonProperty("kwh_value")
    private BigDecimal kwhValue;

    @JsonProperty("instant_power_watts")
    private BigDecimal instantPowerWatts;

    /** ISO-8601 local datetime string: "2024-05-01T10:30:00" */
    @JsonProperty("recorded_at")
    private String recordedAt;
}
