package org.smarttech.service;

import lombok.RequiredArgsConstructor;
import org.smarttech.dto.meter.CreateMeterRequest;
import org.smarttech.dto.meter.MeterDto;
import org.smarttech.entity.Meter;
import org.smarttech.entity.User;
import org.smarttech.entity.enums.MeterStatus;
import org.smarttech.repository.MeterRepository;
import org.smarttech.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class MeterService {

    private final MeterRepository meterRepository;
    private final UserRepository userRepository;

    /**
     * Admin: create a new meter.
     */
    @Transactional
    public MeterDto createMeter(CreateMeterRequest request) {
        if (meterRepository.existsByMeterNumber(request.getMeterNumber())) {
            throw new IllegalArgumentException("Meter number already exists: " + request.getMeterNumber());
        }

        Meter meter = Meter.builder()
                .meterNumber(request.getMeterNumber())
                .dcuId(request.getDcuId())
                .flatNumber(request.getFlatNumber())
                .status(MeterStatus.ACTIVE)
                .installedAt(LocalDateTime.now())
                .build();

        if (request.getUserId() != null) {
            User user = userRepository.findByUserId(request.getUserId())
                    .orElseThrow(() -> new IllegalArgumentException("User not found: " + request.getUserId()));
            meter.setUser(user);
        }

        return toDto(meterRepository.save(meter));
    }

    /**
     * Admin: list all meters.
     */
    @Transactional(readOnly = true)
    public List<MeterDto> getAllMeters() {
        return meterRepository.findAll().stream()
                .map(this::toDto)
                .toList();
    }

    /**
     * Resident: get their own meter.
     */
    @Transactional(readOnly = true)
    public MeterDto getMeterByUserId(String userId) {
        Meter meter = meterRepository.findByUserUserId(userId)
                .orElseThrow(() -> new IllegalArgumentException("No meter assigned to user: " + userId));
        return toDto(meter);
    }

    /**
     * Admin: assign a meter to a user.
     */
    @Transactional
    public MeterDto assignMeterToUser(Long meterId, String userId) {
        Meter meter = meterRepository.findById(meterId)
                .orElseThrow(() -> new IllegalArgumentException("Meter not found: " + meterId));
        User user = userRepository.findByUserId(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        meter.setUser(user);
        return toDto(meterRepository.save(meter));
    }

    private MeterDto toDto(Meter meter) {
        return MeterDto.builder()
                .id(meter.getId())
                .meterNumber(meter.getMeterNumber())
                .dcuId(meter.getDcuId())
                .flatNumber(meter.getFlatNumber())
                .status(meter.getStatus())
                .userId(meter.getUser() != null ? meter.getUser().getUserId() : null)
                .userName(meter.getUser() != null ? meter.getUser().getName() : null)
                .installedAt(meter.getInstalledAt())
                .build();
    }
}
