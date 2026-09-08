# SmartMonitoring — Backend Architecture & API Reference

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Package Structure](#package-structure)
4. [Data Model](#data-model)
5. [DCU Integration](#dcu-integration)
6. [Security](#security)
7. [Background Jobs](#background-jobs)
8. [API Reference](#api-reference)
   - [Auth](#auth-endpoints)
   - [Meter Management](#meter-management-endpoints)
   - [Analytics](#analytics-endpoints)
   - [DCU Ingestion](#dcu-ingestion-endpoints)
9. [Error Responses](#error-responses)
10. [Configuration Reference](#configuration-reference)
11. [Local Setup](#local-setup)

---

## Overview

SmartMonitoring is a Spring Boot backend for tracking electricity consumption in a residential society. It collects power readings from DCU (Data Concentrator Unit) devices — the same units used with prepaid smart meters — and exposes analytics APIs for residents and society admins.

**Tech stack:**
- Java 17, Spring Boot 3.2.5
- PostgreSQL (schema managed by Liquibase)
- Spring Security + JWT (stateless auth)
- Spring Integration MQTT (optional, toggled via config)
- Scheduled aggregation jobs

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        DCU Device                            │
│   Smart Meter 1 ─┐                                           │
│   Smart Meter 2 ─┤─► DCU ──► REST POST  (MVP mode)          │
│   Smart Meter N ─┘      └──► MQTT Broker (production mode)  │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                   Spring Boot Application                     │
│                                                              │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐    │
│  │DcuRestCtrl  │  │MqttMessage   │  │  JwtAuthFilter   │    │
│  │(REST mode)  │  │Handler       │  │  (every request) │    │
│  └──────┬──────┘  │(MQTT mode)   │  └──────────────────┘    │
│         │         └──────┬───────┘                           │
│         └────────────────┘                                   │
│                      │                                       │
│              ReadingIngestionService                         │
│                      │                                       │
│                      ▼                                       │
│               ┌─────────────┐   ┌──────────────────────┐    │
│               │ MeterReading│   │DailyConsumption      │    │
│               │ Repository  │   │Aggregator (hourly)   │    │
│               └──────┬──────┘   └──────────┬───────────┘    │
│                      │                     │                 │
│                      ▼                     ▼                 │
│               ┌──────────────────────────────────┐          │
│               │          PostgreSQL               │          │
│               │  users | meters | meter_readings  │          │
│               │  daily_consumption                │          │
│               └──────────────────────────────────┘          │
│                                                              │
│  ┌──────────────┐  ┌─────────────────┐                      │
│  │MeterController│ │AnalyticsController│                     │
│  │(admin setup) │  │(resident/admin)  │                      │
│  └──────────────┘  └─────────────────┘                      │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    Frontend / Mobile App
```

---

## Package Structure

```
src/main/java/org/example/
├── SmartMonitoringApplication.java   ← entry point
│
├── config/
│   ├── JacksonConfig.java            ← ObjectMapper with JavaTimeModule
│   ├── MqttConfig.java               ← MQTT broker connection (MQTT mode only)
│   └── SecurityConfig.java           ← JWT filter chain, role config
│
├── controller/
│   ├── AuthController.java           ← /api/v1/auth
│   ├── MeterController.java          ← /api/v1/meters
│   ├── AnalyticsController.java      ← /api/v1/analytics
│   └── DcuRestController.java        ← /api/v1/dcu (REST mode only)
│
├── dto/
│   ├── auth/                         ← LoginRequest, RegisterRequest, AuthResponse
│   ├── meter/                        ← CreateMeterRequest, MeterDto
│   ├── analytics/                    ← RealTimeReadingDto, DailyConsumptionDto, ConsumptionSummaryDto
│   └── dcu/                          ← DcuReadingRequest (shared by REST & MQTT)
│
├── entity/
│   ├── User.java
│   ├── Meter.java
│   ├── MeterReading.java
│   ├── DailyConsumption.java
│   └── enums/                        ← Role, MeterStatus, DcuIntegrationMode
│
├── exception/
│   └── GlobalExceptionHandler.java   ← centralised error responses
│
├── mqtt/
│   └── MqttMessageHandler.java       ← MQTT payload handler (MQTT mode only)
│
├── repository/
│   ├── UserRepository.java
│   ├── MeterRepository.java
│   ├── MeterReadingRepository.java
│   └── DailyConsumptionRepository.java
│
├── scheduler/
│   └── DailyConsumptionAggregator.java  ← hourly aggregation job
│
├── security/
│   ├── JwtService.java               ← token generation & validation
│   └── JwtAuthFilter.java            ← per-request JWT extraction
│
└── service/
    ├── AuthService.java              ← register & login
    ├── MeterService.java             ← meter CRUD
    ├── AnalyticsService.java         ← reading & consumption queries
    └── ReadingIngestionService.java  ← shared ingestion logic (REST + MQTT)
```

---

## Data Model

### Entity Relationships

```
users ──────────────── meters ──────────────── meter_readings
  1                      1                          N
  └── (one user has  └── (one meter has         (raw readings
       one meter)         many readings)          from DCU)
                          │
                          └──────────────── daily_consumption
                                                   N
                                           (one row per meter
                                            per calendar day)
```

### Table Definitions

#### `users`
| Column | Type | Notes |
|---|---|---|
| id | BIGSERIAL | PK |
| user_id | VARCHAR(100) | Unique login identifier — residents: `towerNumber_flatNumber` (e.g. `01_A-101`), admins: email address |
| password | VARCHAR(255) | BCrypt hashed |
| name | VARCHAR(255) | Full name |
| phone_number | VARCHAR(20) | Optional |
| role | VARCHAR(20) | `RESIDENT` or `ADMIN` |
| tower_number | VARCHAR(50) | Tower/block identifier for residents (e.g. `01`, `A`) |
| flat_number | VARCHAR(50) | Flat or unit identifier |
| email | VARCHAR(255) | Contact email — required for admins, optional for residents |
| created_at | TIMESTAMP | Auto-set on insert |
| updated_at | TIMESTAMP | Auto-set on insert/update |

#### `meters`
| Column | Type | Notes |
|---|---|---|
| id | BIGSERIAL | PK |
| meter_number | VARCHAR(100) | Unique, matches DCU payload |
| dcu_id | VARCHAR(100) | Which DCU this meter belongs to |
| flat_number | VARCHAR(50) | Physical location |
| status | VARCHAR(20) | `ACTIVE`, `INACTIVE`, `FAULTY` |
| user_id | BIGINT | FK → users (nullable, SET NULL on delete) |
| installed_at | TIMESTAMP | Physical installation date |
| created_at | TIMESTAMP | Auto-set on insert |

#### `meter_readings`
| Column | Type | Notes |
|---|---|---|
| id | BIGSERIAL | PK |
| meter_id | BIGINT | FK → meters (CASCADE on delete) |
| kwh_value | NUMERIC(12,4) | Cumulative odometer-style kWh |
| instant_power_watts | NUMERIC(10,2) | Current load in watts |
| recorded_at | TIMESTAMP | Device timestamp from DCU |
| received_at | TIMESTAMP | Server ingestion timestamp |

> Index: `(meter_id, recorded_at)` — primary query pattern

#### `daily_consumption`
| Column | Type | Notes |
|---|---|---|
| id | BIGSERIAL | PK |
| meter_id | BIGINT | FK → meters (CASCADE on delete) |
| date | DATE | Calendar date |
| units_consumed | NUMERIC(10,4) | `last_kwh - first_kwh` for the day |
| updated_at | TIMESTAMP | Last aggregation time |

> Unique constraint on `(meter_id, date)` — one row per meter per day

### Schema Management

Schema is fully managed by **Liquibase**. Hibernate `ddl-auto` is set to `none`.

```
src/main/resources/db/changelog/
├── db.changelog-master.xml
└── changesets/
    ├── 001-create-users-table.xml
    ├── 002-create-meters-table.xml
    ├── 003-create-meter-readings-table.xml
    └── 004-create-daily-consumption-table.xml
```

Liquibase runs on every application startup and applies only new changesets. Already-applied changesets are tracked in the `DATABASECHANGELOG` table and never re-run.

---

## DCU Integration

The integration mode is controlled by a single config flag:

```yaml
app:
  dcu:
    integration-mode: REST   # or MQTT
```

Or via environment variable: `DCU_INTEGRATION_MODE=MQTT`

### REST Mode (default / MVP)

The DCU pushes readings by calling your server's HTTP endpoint. No broker needed.

```
DCU ──► POST /api/v1/dcu/readings ──► ReadingIngestionService ──► PostgreSQL
```

Active when: `app.dcu.integration-mode=REST`  
The `DcuRestController` bean is loaded; `MqttConfig` and `MqttMessageHandler` are **not** instantiated.

### MQTT Mode (production)

An MQTT broker (e.g. Mosquitto) sits between the DCU and the server. The DCU publishes readings as JSON messages to a topic; the server subscribes and ingests them.

```
DCU ──► MQTT Broker ──► MqttMessageHandler ──► ReadingIngestionService ──► PostgreSQL
```

Active when: `app.dcu.integration-mode=MQTT`  
Topic pattern: `dcu/{dcuId}/meter/{meterId}/reading`

### Shared Ingestion Logic

Both modes call the same `ReadingIngestionService.ingest()` method, so validation, meter lookup, and persistence logic is never duplicated.

```
DcuRestController ──┐
                    ├──► ReadingIngestionService.ingest()
MqttMessageHandler ─┘
```

---

## Security

### Authentication

All user-facing APIs (except `/api/v1/auth/**` and `/api/v1/dcu/**`) require a JWT bearer token.

**Token format:** `Authorization: Bearer <token>`

**JWT claims:**
```json
{
  "sub": "01_A-101",
  "iat": 1714560000,
  "exp": 1714646400
}
```

> The `sub` claim contains the `user_id` value — `towerNumber_flatNumber` for residents, email address for admins.

Algorithm: HS256  
Expiry: 24 hours (configurable via `app.jwt.expiration-ms`)  
Secret: configurable via `JWT_SECRET` env variable

### Request Filter Chain

```
Incoming Request
      │
      ▼
JwtAuthFilter (OncePerRequestFilter)
      │
      ├── No/invalid token → continues without auth → Spring Security blocks protected routes
      │
      └── Valid token → sets Authentication in SecurityContext → request proceeds
```

### Authorization

Role-based access using Spring Security's `@PreAuthorize`:

| Role | Permissions |
|---|---|
| `RESIDENT` | View own meter, view own analytics |
| `ADMIN` | Create/list meters, assign meters to users, view any meter's analytics |

### Public Endpoints

| Path | Reason |
|---|---|
| `POST /api/v1/auth/register` | User self-registration |
| `POST /api/v1/auth/login` | Credential exchange for token |
| `POST /api/v1/dcu/**` | DCU device push — no user context |

> **Note:** DCU endpoints are open to avoid managing JWT on embedded devices. In production, protect them at the network level with IP allowlisting or an API gateway.

### Password Storage

Passwords are hashed with BCrypt before storage. Raw passwords are never logged or returned in any response.

---

## Background Jobs

### DailyConsumptionAggregator

Aggregates raw `meter_readings` into `daily_consumption` records.

**Why it exists:** `meter_readings` stores raw odometer-style kWh snapshots. To get daily usage you need `last_reading - first_reading` for the day. Pre-aggregating this hourly keeps analytics queries fast and simple.

**Schedule:**
| Job | Cron | Purpose |
|---|---|---|
| `aggregateToday()` | `0 0 * * * *` (top of every hour) | Keep today's record current |
| `aggregateYesterday()` | `0 5 0 * * *` (00:05 daily) | Close out yesterday fully |

**Logic per meter:**
1. Find first and last reading of the target day
2. `units_consumed = last.kwh_value - first.kwh_value`
3. Floor to 0 (handles meter resets)
4. Upsert into `daily_consumption` — safe to re-run

---

## API Reference

**Base URL:** `http://localhost:8080/api/v1`

---

### Auth Endpoints

#### `POST /auth/register`

Register a new resident user.

**Access:** Public (admin token required to create admin users)

**Request:**
```json
{
  "name": "Ramesh Kumar",
  "towerNumber": "01",
  "flatNumber": "A-101",
  "password": "secret123",
  "phoneNumber": "9876543210"
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| name | String | Yes | Non-blank |
| towerNumber | String | Yes | Non-blank (used to derive `user_id`) |
| flatNumber | String | Yes | Non-blank (used to derive `user_id`) |
| password | String | Yes | Minimum 8 characters |
| phoneNumber | String | No | — |

**Response `200 OK`:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "loginId": "01_A-101",
  "name": "Ramesh Kumar",
  "role": "RESIDENT",
  "towerNumber": "01",
  "flatNumber": "A-101"
}
```

**Error `400`:** Login ID already registered or validation failure.

---

#### `POST /auth/login`

Authenticate and receive a JWT.

**Access:** Public

**Request:**
```json
{
  "loginId": "01_A-101",
  "password": "secret123"
}
```

> For admins, `loginId` is their email address (e.g. `admin@society.com`).

**Response `200 OK`:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "loginId": "01_A-101",
  "name": "Ramesh Kumar",
  "role": "RESIDENT",
  "towerNumber": "01",
  "flatNumber": "A-101"
}
```

**Error `401`:** Invalid credentials.

---

### Meter Management Endpoints

#### `POST /meters`

Register a new physical meter in the system.

**Access:** `ADMIN` only

**Request:**
```json
{
  "meterNumber": "MTR-001",
  "dcuId": "DCU-A1",
  "flatNumber": "A-101",
  "userId": 5
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| meterNumber | String | Yes | Must match what DCU sends in readings |
| dcuId | String | Yes | DCU device identifier |
| flatNumber | String | Yes | Physical location |
| userId | Long | No | Can assign later via PATCH |

**Response `201 Created`:**
```json
{
  "id": 1,
  "meterNumber": "MTR-001",
  "dcuId": "DCU-A1",
  "flatNumber": "A-101",
  "status": "ACTIVE",
  "userId": 5,
  "userName": "Ramesh Kumar",
  "installedAt": "2024-05-01T10:00:00"
}
```

---

#### `GET /meters`

List all meters in the society.

**Access:** `ADMIN` only

**Response `200 OK`:**
```json
[
  {
    "id": 1,
    "meterNumber": "MTR-001",
    "dcuId": "DCU-A1",
    "flatNumber": "A-101",
    "status": "ACTIVE",
    "userId": 5,
    "userName": "Ramesh Kumar",
    "installedAt": "2024-05-01T10:00:00"
  },
  {
    "id": 2,
    "meterNumber": "MTR-002",
    "dcuId": "DCU-A1",
    "flatNumber": "A-102",
    "status": "ACTIVE",
    "userId": null,
    "userName": null,
    "installedAt": "2024-05-01T10:00:00"
  }
]
```

---

#### `PATCH /meters/{meterId}/assign/{userId}`

Assign an existing meter to a resident user.

**Access:** `ADMIN` only

**Path params:**
- `meterId` — ID of the meter
- `userId` — ID of the user to assign

**Response `200 OK`:** Updated `MeterDto` (same shape as above)

---

#### `GET /meters/my`

Get the calling resident's own meter details.

**Access:** `RESIDENT` only

**Response `200 OK`:**
```json
{
  "id": 1,
  "meterNumber": "MTR-001",
  "dcuId": "DCU-A1",
  "flatNumber": "A-101",
  "status": "ACTIVE",
  "userId": 5,
  "userName": "Ramesh Kumar",
  "installedAt": "2024-05-01T10:00:00"
}
```

---

### Analytics Endpoints

#### `GET /analytics/my/realtime`

Get the most recent reading for the calling resident's meter.

**Access:** `RESIDENT` only

**Response `200 OK`:**
```json
{
  "meterNumber": "MTR-001",
  "flatNumber": "A-101",
  "kwhValue": 1234.5678,
  "instantPowerWatts": 450.00,
  "recordedAt": "2024-05-01T10:30:00"
}
```

---

#### `GET /analytics/my/daily`

Daily consumption breakdown for the resident's meter.

**Access:** `RESIDENT` only

**Query params:**

| Param | Type | Required | Default |
|---|---|---|---|
| from | `YYYY-MM-DD` | No | 6 days ago |
| to | `YYYY-MM-DD` | No | Today |

**Example:** `GET /analytics/my/daily?from=2024-05-01&to=2024-05-07`

**Response `200 OK`:**
```json
{
  "meterNumber": "MTR-001",
  "flatNumber": "A-101",
  "from": "2024-05-01",
  "to": "2024-05-07",
  "totalUnitsConsumed": 42.3500,
  "dailyBreakdown": [
    { "date": "2024-05-01", "unitsConsumed": 5.8200 },
    { "date": "2024-05-02", "unitsConsumed": 6.1000 },
    { "date": "2024-05-03", "unitsConsumed": 7.2500 },
    { "date": "2024-05-04", "unitsConsumed": 4.9800 },
    { "date": "2024-05-05", "unitsConsumed": 6.4500 },
    { "date": "2024-05-06", "unitsConsumed": 5.7500 },
    { "date": "2024-05-07", "unitsConsumed": 6.0000 }
  ]
}
```

---

#### `GET /analytics/my/weekly`

Convenience alias — returns the last 7 days. Same response shape as `/daily`.

**Access:** `RESIDENT` only

---

#### `GET /analytics/meters/{meterId}/realtime`

Real-time reading for any meter by ID.

**Access:** `ADMIN` only

**Response:** Same shape as `/my/realtime`

---

#### `GET /analytics/meters/{meterId}/daily`

Daily consumption for any meter by ID.

**Access:** `ADMIN` only

**Query params:** Same as `/my/daily` — `from` and `to` (both optional, default last 7 days)

**Response:** Same shape as `/my/daily`

---

### DCU Ingestion Endpoints

> Active only when `app.dcu.integration-mode=REST`

#### `POST /dcu/readings`

Single reading push from the DCU device.

**Access:** Public (no JWT required)

**Request:**
```json
{
  "meter_number": "MTR-001",
  "kwh_value": 1234.5678,
  "instant_power_watts": 450.0,
  "recorded_at": "2024-05-01T10:30:00"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| meter_number | String | Yes | Must match a registered meter |
| kwh_value | Decimal | Yes | Cumulative kWh, non-negative |
| instant_power_watts | Decimal | No | Current load in watts |
| recorded_at | String | No | ISO-8601 `YYYY-MM-DDTHH:mm:ss`; defaults to server time if absent |

**Response `200 OK`:**
```json
{
  "status": "accepted",
  "readingId": 1042,
  "meterNumber": "MTR-001",
  "recordedAt": "2024-05-01T10:30:00"
}
```

**Error `400`:** Unknown meter number or validation failure.

---

#### `POST /dcu/readings/batch`

Batch push — useful when the DCU buffers readings and flushes them together.

**Access:** Public (no JWT required)

**Request:** Array of reading objects (same schema as single reading)
```json
[
  { "meter_number": "MTR-001", "kwh_value": 1234.56, "instant_power_watts": 450.0, "recorded_at": "2024-05-01T10:15:00" },
  { "meter_number": "MTR-002", "kwh_value": 876.12, "instant_power_watts": 320.0, "recorded_at": "2024-05-01T10:15:00" }
]
```

**Response `200 OK`:**
```json
{
  "total": 2,
  "accepted": 2,
  "failed": 0
}
```

Each reading is processed independently — one failure does not block others.

---

#### `GET /dcu/status`

Health check for the DCU to verify server connectivity.

**Access:** Public

**Response `200 OK`:**
```json
{
  "mode": "REST",
  "status": "online"
}
```

---

## Error Responses

All errors follow a consistent envelope:

```json
{
  "timestamp": "2024-05-01T10:30:00",
  "status": 400,
  "message": "Validation failed",
  "details": {
    "email": "Invalid email format",
    "password": "Password must be at least 8 characters"
  }
}
```

| HTTP Status | Scenario |
|---|---|
| `400 Bad Request` | Validation failure, unknown meter, duplicate email |
| `401 Unauthorized` | Missing/invalid/expired JWT, wrong credentials |
| `403 Forbidden` | Valid token but insufficient role |
| `500 Internal Server Error` | Unexpected server error |

---

## Configuration Reference

```yaml
server:
  port: 8080                          # HTTP port

spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/smart_monitoring
    username: ${DB_USERNAME:postgres}
    password: ${DB_PASSWORD:postgres}

  jpa:
    hibernate:
      ddl-auto: none                  # Liquibase owns the schema

  liquibase:
    change-log: classpath:db/changelog/db.changelog-master.xml

mqtt:                                 # Only used when mode=MQTT
  broker-url: ${MQTT_BROKER_URL:tcp://localhost:1883}
  client-id: smart-monitoring-server
  username: ${MQTT_USERNAME:}
  password: ${MQTT_PASSWORD:}
  topic:
    meter-reading: dcu/+/meter/+/reading

app:
  jwt:
    secret: ${JWT_SECRET:...}         # Base64-encoded HMAC-SHA256 key
    expiration-ms: 86400000           # 24 hours
  dcu:
    integration-mode: ${DCU_INTEGRATION_MODE:REST}  # REST or MQTT
```

**Environment variables to set in production:**

| Variable | Description |
|---|---|
| `DB_USERNAME` | PostgreSQL username |
| `DB_PASSWORD` | PostgreSQL password |
| `JWT_SECRET` | Base64-encoded JWT signing key (min 256-bit) |
| `DCU_INTEGRATION_MODE` | `REST` or `MQTT` |
| `MQTT_BROKER_URL` | MQTT broker URL (if using MQTT mode) |
| `MQTT_USERNAME` | MQTT broker username (if auth enabled) |
| `MQTT_PASSWORD` | MQTT broker password (if auth enabled) |

---

## Local Setup

### Prerequisites

- Java 17+
- PostgreSQL 14+
- Mosquitto (only if using MQTT mode)

### Steps

**1. Create the database:**
```sql
CREATE DATABASE smart_monitoring;
```

**2. Run the application:**
```bash
./gradlew bootRun
```

Liquibase will automatically create all tables on first run.

**3. Create an admin user directly in DB** (no admin self-registration endpoint by design):
```sql
-- Password below is BCrypt hash of "admin123"
INSERT INTO users (user_id, email, password, name, role, tower_number, flat_number, created_at, updated_at)
VALUES (
  'admin@society.com',
  'admin@society.com',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhe2',
  'Society Admin',
  'ADMIN',
  NULL,
  'OFFICE',
  NOW(), NOW()
);
```

**4. Test DCU push (REST mode):**
```bash
# First register a meter via admin
curl -X POST http://localhost:8080/api/v1/meters \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"meterNumber":"MTR-001","dcuId":"DCU-A1","flatNumber":"A-101"}'

# Then simulate a DCU reading push
curl -X POST http://localhost:8080/api/v1/dcu/readings \
  -H "Content-Type: application/json" \
  -d '{"meter_number":"MTR-001","kwh_value":1234.56,"instant_power_watts":450.0,"recorded_at":"2024-05-01T10:30:00"}'
```

**5. For MQTT mode**, start Mosquitto and set the env variable:
```bash
brew services start mosquitto
DCU_INTEGRATION_MODE=MQTT ./gradlew bootRun

# Simulate DCU push via mosquitto_pub
mosquitto_pub -t "dcu/DCU-A1/meter/MTR-001/reading" \
  -m '{"meter_number":"MTR-001","kwh_value":1234.56,"instant_power_watts":450.0,"recorded_at":"2024-05-01T10:30:00"}'
```
