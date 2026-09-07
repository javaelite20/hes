package org.smarttech.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.smarttech.dto.auth.AuthResponse;
import org.smarttech.dto.auth.LoginRequest;
import org.smarttech.dto.auth.RegisterRequest;
import org.smarttech.service.AuthService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    /**
     * Admin-only: create a new resident account.
     * Residents no longer self-register — admin provisions them.
     */
    @PostMapping("/register")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.register(request));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }
}
