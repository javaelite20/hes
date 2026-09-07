package org.smarttech.repository;

import org.smarttech.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByLoginId(String loginId);

    boolean existsByLoginId(String loginId);

    // Still used for admin seed lookups
    Optional<User> findByEmail(String email);
}
