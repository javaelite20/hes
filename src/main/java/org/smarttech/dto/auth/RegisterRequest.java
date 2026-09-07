package org.smarttech.dto.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class RegisterRequest {

    @NotBlank(message = "Name is required")
    private String name;

    @NotBlank(message = "Tower number is required")
    private String towerNumber;

    @NotBlank(message = "Flat number is required")
    private String flatNumber;

    @NotBlank(message = "Password is required")
    @Size(min = 4, message = "Password must be at least 4 characters")
    private String password;

    private String phoneNumber;

    // Optional — only relevant for admins or contact info
    private String email;
}
