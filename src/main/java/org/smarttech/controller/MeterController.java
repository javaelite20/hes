package org.smarttech.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.smarttech.dto.meter.CreateMeterRequest;
import org.smarttech.dto.meter.MeterDto;
import org.smarttech.repository.UserRepository;
import org.smarttech.service.MeterService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/meters")
@RequiredArgsConstructor
public class MeterController {

    private final MeterService meterService;
    private final UserRepository userRepository;

    /**
     * Admin: create a new meter.
     */
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<MeterDto> createMeter(@Valid @RequestBody CreateMeterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(meterService.createMeter(request));
    }

    /**
     * Admin: list all meters.
     */
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<MeterDto>> getAllMeters() {
        return ResponseEntity.ok(meterService.getAllMeters());
    }

    /**
     * Admin: assign meter to a user.
     */
    @PatchMapping("/{meterId}/assign/{userId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<MeterDto> assignMeter(@PathVariable Long meterId, @PathVariable String userId) {
        return ResponseEntity.ok(meterService.assignMeterToUser(meterId, userId));
    }

    /**
     * Resident: get their own meter info.
     */
    @GetMapping("/my")
    @PreAuthorize("hasRole('RESIDENT')")
    public ResponseEntity<MeterDto> getMyMeter(@AuthenticationPrincipal UserDetails userDetails) {
        String userId = resolveUserId(userDetails);
        return ResponseEntity.ok(meterService.getMeterByUserId(userId));
    }

    private String resolveUserId(UserDetails userDetails) {
        return userRepository.findByUserId(userDetails.getUsername())
                .orElseThrow(() -> new IllegalArgumentException("User not found"))
                .getUserId();
    }
}
