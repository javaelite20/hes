package org.smarttech.repository;

import org.smarttech.entity.Meter;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MeterRepository extends JpaRepository<Meter, Long> {

    Optional<Meter> findByMeterNumber(String meterNumber);

    Optional<Meter> findByUserUserId(String userId);

    List<Meter> findAllByDcuId(String dcuId);

    boolean existsByMeterNumber(String meterNumber);
}
