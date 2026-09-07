# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM eclipse-temurin:17-jdk-alpine AS builder
WORKDIR /app

# Copy gradle wrapper and dependency files first (better layer caching)
COPY gradlew .
COPY gradle/ gradle/
COPY build.gradle settings.gradle ./

# Download dependencies (cached unless build.gradle changes)
RUN ./gradlew dependencies --no-daemon 2>/dev/null || true

# Copy source and build
COPY src/ src/
RUN ./gradlew bootJar --no-daemon -x test

# ── Stage 2: Runtime ───────────────────────────────────────────────────────────
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy JAR from builder
COPY --from=builder /app/build/libs/*.jar app.jar

# Log directory
RUN mkdir -p logs && chown -R appuser:appgroup /app

USER appuser

EXPOSE 8080

ENTRYPOINT ["java", \
  "-XX:+UseContainerSupport", \
  "-XX:MaxRAMPercentage=75.0", \
  "-Djava.security.egd=file:/dev/./urandom", \
  "-jar", "app.jar"]
