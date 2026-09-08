package org.smarttech.dto.auth;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class LoginRequest {

    /**
     * For residents : towerNumber_flatNumber  (e.g. "01_A-101")
     * For admins    : email address           (e.g. "admin@society.com")
     */
    @NotBlank(message = "user ID is required")
    private String userId;

    @NotBlank(message = "Password is required")
    private String password;
}
