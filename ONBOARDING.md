# SmartMonitoring — Onboarding Guide

This document walks through every step required to get a new society up and running on SmartMonitoring — from first boot to a resident viewing their consumption on the dashboard.

---

## Prerequisites

- Java 17 installed
- PostgreSQL running (local or RDS)
- `smart_monitoring` database created
- Backend running on port `8080`
- Frontend running on port `3000`

---

## Step 1 — First Boot

Start the Spring Boot backend. On first run, Liquibase automatically creates all tables.

```bash
./gradlew bootRun
```

You should see in the logs:
```
Liquibase: Running Changeset: 001-create-users-table
Liquibase: Running Changeset: 002-create-meters-table
Liquibase: Running Changeset: 003-create-meter-readings-table
Liquibase: Running Changeset: 004-create-daily-consumption-table
Liquibase: Running Changeset: 005-alter-users-add-login-id
Started SmartMonitoringApplication
```

---

## Step 2 — Create Admin Account

Admin cannot self-register. Insert directly into the database.

```sql
-- Password below is BCrypt hash of "admin123"
-- Change this before going to production
INSERT INTO users (login_id, email, password, name, role, flat_number, created_at, updated_at)
VALUES (
  'admin@society.com',
  'admin@society.com',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhe2',
  'Society Admin',
  'ADMIN',
  'OFFICE',
  NOW(), NOW()
);
```

To generate a BCrypt hash for a different password:
```bash
# Using htpasswd (macOS)
htpasswd -bnBC 10 "" yourpassword | tr -d ':\n'
```

---

## Step 3 — Admin Login

Open `http://localhost:3000` and sign in with:

```
Login ID : admin@society.com
Password : admin123
```

You will be redirected to the Admin Dashboard.

Alternatively via API:
```bash
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"loginId":"admin@society.com","password":"admin123"}'
```

Save the token from the response — you need it for all admin operations.

---

## Step 4 — Register a Meter

Before any resident can be onboarded, their physical meter must be registered. The meter number must match exactly what the DCU device sends in its readings.

```bash
POST /api/v1/meters
Authorization: Bearer <admin-token>

{
  "meterNumber": "MTR-001",
  "dcuId": "DCU-A1",
  "flatNumber": "A-101"
}
```

**Response:**
```json
{
  "id": 1,
  "meterNumber": "MTR-001",
  "dcuId": "DCU-A1",
  "flatNumber": "A-101",
  "status": "ACTIVE",
  "userId": null
}
```

Repeat this for every flat/unit in the society.

---

## Step 5 — Register a Resident

Admin creates the resident account. The `loginId` is auto-derived as `towerNumber_flatNumber`.

```bash
POST /api/v1/auth/register
Authorization: Bearer <admin-token>

{
  "name": "Ramesh Kumar",
  "towerNumber": "01",
  "flatNumber": "A-101",
  "password": "welcome123",
  "phoneNumber": "9876543210"
}
```

**Response:**
```json
{
  "token": "eyJ...",
  "loginId": "01_A-101",
  "name": "Ramesh Kumar",
  "role": "RESIDENT",
  "towerNumber": "01",
  "flatNumber": "A-101"
}
```

The resident's login credentials are:
```
Login ID : 01_A-101
Password : welcome123   (set by admin, share with resident)
```

---

## Step 6 — Assign Meter to Resident

Link the registered meter to the resident using the meter ID and user ID from previous steps.

```bash
PATCH /api/v1/meters/{meterId}/assign/{userId}
Authorization: Bearer <admin-token>
```

Example — meter ID 1, user ID 2:
```bash
curl -X PATCH http://localhost:8080/api/v1/meters/1/assign/2 \
  -H "Authorization: Bearer <admin-token>"
```

**Response:**
```json
{
  "id": 1,
  "meterNumber": "MTR-001",
  "flatNumber": "A-101",
  "status": "ACTIVE",
  "userId": 2,
  "userName": "Ramesh Kumar"
}
```

---

## Step 7 — Connect DCU

The DCU device needs to be configured to push readings to the backend.

### REST Mode (default / MVP)

Configure the DCU firmware to POST to:
```
POST http://<your-server>:8080/api/v1/dcu/readings
Content-Type: application/json
```

Payload format:
```json
{
  "meter_number": "MTR-001",
  "kwh_value": 1234.5678,
  "instant_power_watts": 450.0,
  "recorded_at": "2024-05-01T10:30:00"
}
```

Test connectivity first:
```bash
curl http://<your-server>:8080/api/v1/dcu/status
# Expected: {"mode":"REST","status":"online"}
```

Test a manual reading push:
```bash
curl -X POST http://localhost:8080/api/v1/dcu/readings \
  -H "Content-Type: application/json" \
  -d '{"meter_number":"MTR-001","kwh_value":1200.00,"instant_power_watts":350.0,"recorded_at":"2024-05-01T10:00:00"}'
```

### MQTT Mode (production)

Set `DCU_INTEGRATION_MODE=MQTT` and configure the DCU to publish to:
```
Topic   : dcu/{dcuId}/meter/{meterNumber}/reading
Broker  : <your-mqtt-broker>:1883
Payload : same JSON format as above
```

---

## Step 8 — Trigger Initial Aggregation

After pushing historical readings, trigger the daily aggregation so charts populate immediately (instead of waiting for the hourly scheduler).

```bash
POST /api/v1/admin/aggregate?days=30
Authorization: Bearer <admin-token>
```

**Response:**
```json
{
  "status": "done",
  "daysProcessed": 30
}
```

---

## Step 9 — Resident Login

The resident opens `http://localhost:3000` and signs in with:

```
Login ID : 01_A-101        (towerNumber_flatNumber)
Password : welcome123      (set by admin in Step 5)
```

They are redirected to their personal dashboard showing:
- Current power load (watts) — live
- Cumulative meter reading (kWh)
- Total consumption for selected period
- Daily consumption chart (7D / 14D / 30D)
- Daily breakdown table

---

## Summary — Onboarding Checklist

```
[ ] 1. Backend started, Liquibase applied all changesets
[ ] 2. Admin user inserted into DB
[ ] 3. Admin logged in, token obtained
[ ] 4. Meter registered for each flat   (POST /api/v1/meters)
[ ] 5. Resident account created          (POST /api/v1/auth/register)
[ ] 6. Meter assigned to resident        (PATCH /api/v1/meters/{id}/assign/{userId})
[ ] 7. DCU configured and pushing data   (POST /api/v1/dcu/readings)
[ ] 8. Aggregation triggered             (POST /api/v1/admin/aggregate?days=30)
[ ] 9. Resident logs in, views dashboard
```

---

## Login ID Reference

| User Type | Login ID Format | Example |
|---|---|---|
| Admin | Email address | `admin@society.com` |
| Resident | `towerNumber_flatNumber` | `01_A-101` |

---

## Troubleshooting

**Resident can't log in**
- Confirm meter is assigned (`GET /api/v1/meters` — check userId is set)
- Confirm loginId format is exactly `towerNumber_flatNumber` (case-sensitive)

**Dashboard shows no data**
- Confirm DCU is pushing readings (`GET /api/v1/analytics/meters/{id}/realtime`)
- Trigger aggregation: `POST /api/v1/admin/aggregate?days=30`

**DCU readings rejected (400)**
- Confirm `meter_number` in DCU payload matches exactly what was registered in Step 4

**Token expired (401 on all requests)**
- Sign in again to get a fresh token — JWT is valid for 24 hours
