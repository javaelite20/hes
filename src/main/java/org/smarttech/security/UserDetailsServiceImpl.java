package org.smarttech.security;

import lombok.RequiredArgsConstructor;
import org.smarttech.repository.UserRepository;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class UserDetailsServiceImpl implements UserDetailsService {

    private final UserRepository userRepository;

    /**
     * Spring Security calls this with whatever was passed as "username".
     * For residents that is towerNumber_flatNumber (e.g. "01_A-101").
     * For admins that is their email address.
     * Both are stored in the login_id column.
     */
    @Override
    public UserDetails loadUserByUsername(String loginId) throws UsernameNotFoundException {
        return userRepository.findByLoginId(loginId)
                .map(user -> User.builder()
                        .username(user.getLoginId())
                        .password(user.getPassword())
                        .roles(user.getRole().name())
                        .build())
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + loginId));
    }
}
