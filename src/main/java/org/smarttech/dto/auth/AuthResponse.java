package org.smarttech.dto.auth;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class AuthResponse {
    private Long userId;
    private String token;
    private String loginId;
    private String name;
    private String role;
    private String flatNumber;
    private String towerNumber;
}
