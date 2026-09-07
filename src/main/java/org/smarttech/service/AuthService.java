package org.smarttech.service;

import lombok.RequiredArgsConstructor;
import org.smarttech.dto.auth.AuthResponse;
import org.smarttech.dto.auth.LoginRequest;
import org.smarttech.dto.auth.RegisterRequest;
import org.smarttech.entity.User;
import org.smarttech.entity.enums.Role;
import org.smarttech.repository.UserRepository;
import org.smarttech.security.JwtService;
import org.smarttech.security.UserDetailsServiceImpl;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;
    private final UserDetailsServiceImpl userDetailsService;

    /**
     * Admin creates a resident.
     * loginId is auto-derived as towerNumber_flatNumber (e.g. "01_A-101").
     */
    public AuthResponse register(RegisterRequest request) {
        String loginId = buildLoginId(request.getTowerNumber(), request.getFlatNumber());

        if (userRepository.existsByLoginId(loginId)) {
            throw new IllegalArgumentException("Resident already registered: " + loginId);
        }

        User user = User.builder()
                .loginId(loginId)
                .name(request.getName())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .phoneNumber(request.getPhoneNumber())
                .towerNumber(request.getTowerNumber())
                .flatNumber(request.getFlatNumber())
                .role(Role.RESIDENT)
                .build();

        userRepository.save(user);

        UserDetails userDetails = userDetailsService.loadUserByUsername(loginId);
        String token = jwtService.generateToken(userDetails);

        return toAuthResponse(user, token);
    }

    public AuthResponse login(LoginRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getLoginId(), request.getPassword())
        );

        User user = userRepository.findByLoginId(request.getLoginId())
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        UserDetails userDetails = userDetailsService.loadUserByUsername(user.getLoginId());
        String token = jwtService.generateToken(userDetails);

        return toAuthResponse(user, token);
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    /**
     * Derives the login ID from tower and flat numbers.
     * Format: towerNumber_flatNumber  e.g. "01_A-101"
     */
    public static String buildLoginId(String towerNumber, String flatNumber) {
        return towerNumber.trim() + "_" + flatNumber.trim();
    }

    private AuthResponse toAuthResponse(User user, String token) {
        return AuthResponse.builder()
                .userId(user.getId())
                .token(token)
                .loginId(user.getLoginId())
                .name(user.getName())
                .role(user.getRole().name())
                .towerNumber(user.getTowerNumber())
                .flatNumber(user.getFlatNumber())
                .build();
    }
}
