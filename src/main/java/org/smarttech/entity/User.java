package org.smarttech.entity;

import jakarta.persistence.*;
import lombok.*;
import org.smarttech.entity.enums.Role;

import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * Unique login identifier.
     * - Residents : towerNumber_flatNumber  (e.g. "01_A-101")
     * - Admins    : email address           (e.g. "admin@society.com")
     *
     * Used as the Spring Security username — single lookup path for both roles.
     */
    @Column(name = "login_id", nullable = false, unique = true)
    private String loginId;

    @Column(nullable = false)
    private String password;

    @Column(nullable = false)
    private String name;

    @Column(name = "phone_number")
    private String phoneNumber;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    @Column(name = "tower_number")
    private String towerNumber;

    @Column(name = "flat_number")
    private String flatNumber;

    // Email retained for admins and optional contact info for residents
    @Column
    private String email;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
