# Prepaid Wallet & Supply Control — Feature Design

This document covers the design and implementation plan for adding prepaid metering capability to SmartMonitoring — allowing balance-based billing, automatic supply disconnection on zero balance, and recharge flow.

---

## Overview

```
Resident recharges → balance increases
DCU pushes reading → system calculates cost → deducts from balance
Balance hits zero  → system sends disconnect command to DCU
DCU cuts relay     → supply off
Resident recharges → system sends reconnect command → supply restored
```

This mirrors how prepaid smart meters work in Indian housing societies (BESCOM, MSEDCL prepaid model).

---

## System Flow Diagram

```
┌─────────────┐     reading      ┌──────────────────────────┐
│  DCU Device │ ───────────────► │  ReadingIngestionService  │
└─────────────┘                  │                           │
       ▲                         │  1. Calculate units used  │
       │                         │  2. units × tariff = cost │
       │  DISCONNECT /           │  3. Deduct from balance   │
       │  CONNECT command        │  4. If balance <= 0:      │
       │                         │     → send DISCONNECT     │
       └─────────────────────────│  5. Log to transactions   │
                                 └──────────────────────────┘
                                              │
                                              ▼
                                     ┌───────────────┐
                                     │  PostgreSQL   │
                                     │  meter_wallet │
                                     │  transactions │
                                     │  tariff       │
                                     └───────────────┘
```

---

## Step 1 — Database Schema

Add three new tables via Liquibase changesets.

### `tariff`
Stores the electricity rate per unit. Configurable per society or billing period.

| Column | Type | Notes |
|---|---|---|
| id | BIGSERIAL | PK |
| name | VARCHAR(100) | e.g. "Standard Rate 2024" |
| rate_per_kwh | NUMERIC(8,4) | e.g. 6.5000 (₹6.50 per kWh) |
| effective_from | DATE | Rate applicable from this date |
| created_at | TIMESTAMP | |

### `meter_wallet`
One row per meter. Holds the current prepaid balance.

| Column | Type | Notes |
|---|---|---|
| id | BIGSERIAL | PK |
| meter_id | BIGINT | FK → meters (UNIQUE) |
| balance | NUMERIC(10,2) | Current balance in ₹ |
| last_deducted_at | TIMESTAMP | Last time consumption was deducted |
| updated_at | TIMESTAMP | |

### `wallet_transactions`
Full audit trail of every balance change.

| Column | Type | Notes |
|---|---|---|
| id | BIGSERIAL | PK |
| meter_id | BIGINT | FK → meters |
| type | VARCHAR(20) | `RECHARGE`, `DEDUCTION`, `ADJUSTMENT` |
| amount | NUMERIC(10,2) | Positive = credit, negative = debit |
| balance_before | NUMERIC(10,2) | Balance before this transaction |
| balance_after | NUMERIC(10,2) | Balance after this transaction |
| units_consumed | NUMERIC(10,4) | Filled for DEDUCTION type only |
| description | VARCHAR(255) | e.g. "Recharge via UPI" / "Consumption 2.40 kWh" |
| created_at | TIMESTAMP | |

---

## Step 2 — Balance Deduction Logic

Hook into `ReadingIngestionService` — every incoming reading triggers a cost calculation.

```
New reading arrives (kWh value = cumulative odometer)
    ↓
Get previous reading for this meter
    ↓
units_consumed = current_kwh - previous_kwh
    ↓
Get active tariff rate
    ↓
cost = units_consumed × rate_per_kwh
    ↓
Deduct cost from meter_wallet.balance
    ↓
Log to wallet_transactions (type = DEDUCTION)
    ↓
Check balance:
    If balance <= low_balance_threshold → send LOW_BALANCE alert
    If balance <= 0 → trigger disconnect flow
```

**Key rule:** deduction happens per reading interval, not per day. If the DCU pushes every 15 minutes, cost is calculated every 15 minutes.

---

## Step 3 — DCU Disconnect / Reconnect Command

Your server needs to send commands back to the DCU to open/close the relay (cut/restore supply).

### REST Mode

The DCU exposes an HTTP endpoint. Your server POSTs to it:

```http
POST http://{dcu-ip}/api/relay
Content-Type: application/json

{
  "meter_number": "MTR-001",
  "action": "DISCONNECT"
}
```

For reconnect, same endpoint with `"action": "CONNECT"`.

The DCU IP needs to be stored against the `meters` table or `DCU` config.

### MQTT Mode (recommended for production)

Your server **publishes** to a command topic. The DCU **subscribes** and acts on it.

```
Topic:   dcu/{dcuId}/meter/{meterNumber}/command
Payload: { "action": "DISCONNECT" }
         { "action": "CONNECT" }
```

Spring Boot publishes using `MqttPahoMessageDrivenChannelAdapter` outbound channel — the same MQTT connection used for inbound readings.

### New `MeterStatus` values needed

Add to the existing `MeterStatus` enum:
```java
ACTIVE           // supply on, balance positive
LOW_BALANCE      // balance below threshold — warning state
DISCONNECTED     // supply cut, balance <= 0
INACTIVE         // meter decommissioned
FAULTY           // hardware issue
```

---

## Step 4 — Recharge Flow

```
Admin or payment gateway calls recharge endpoint
    ↓
Add amount to meter_wallet.balance
    ↓
Log to wallet_transactions (type = RECHARGE)
    ↓
If meter status was DISCONNECTED:
    → send CONNECT command to DCU
    → update meter status to ACTIVE
    ↓
Return updated balance
```

### Payment Gateway Integration (Razorpay / PayU)

For resident self-recharge via UPI/card:

```
Resident initiates payment on frontend
    ↓
Frontend calls Razorpay SDK
    ↓
Razorpay processes payment
    ↓
Razorpay sends webhook → POST /api/v1/wallet/webhook/razorpay
    ↓
Backend verifies webhook signature
    ↓
Calls recharge logic with verified amount
```

For MVP, admin can recharge manually via admin panel without payment gateway.

---

## Step 5 — Low Balance Alert

Before cutting supply, notify the resident so they have time to recharge.

```yaml
app:
  wallet:
    low-balance-alert-threshold: 50.00   # ₹ — send warning below this
    disconnect-threshold: 0.00           # ₹ — cut supply at or below this
```

Alert delivery options (pick one or combine):
- **SMS** via Twilio / AWS SNS
- **Push notification** via Firebase FCM (if mobile app exists)
- **In-app alert** — API flag `lowBalance: true` in dashboard response

---

## Step 6 — New API Endpoints

### Resident

```
GET  /api/v1/wallet/my
     → current balance, last recharge, last deduction

GET  /api/v1/wallet/my/transactions?page=0&size=20
     → paginated transaction history
```

### Admin

```
GET  /api/v1/wallet/meters/{meterId}
     → wallet summary for any meter

POST /api/v1/wallet/meters/{meterId}/recharge
     Body: { "amount": 500.00, "description": "Cash recharge" }

POST /api/v1/wallet/meters/{meterId}/adjust
     Body: { "amount": -50.00, "description": "Correction entry" }

GET  /api/v1/wallet/meters/{meterId}/transactions
     → full transaction history for a meter
```

### Webhook (payment gateway)

```
POST /api/v1/wallet/webhook/razorpay
     → called by Razorpay after successful payment
     → must verify HMAC signature before processing
```

---

## Step 7 — Dashboard Changes

### Resident dashboard additions
- Current balance (₹) — prominent display
- Units remaining estimate (balance ÷ rate_per_kwh)
- Last recharge amount and date
- Recharge button (triggers payment flow)
- Transaction history tab

### Admin dashboard additions
- All meters with balance column
- Red highlight on LOW_BALANCE / DISCONNECTED meters
- Manual recharge form per meter
- Bulk recharge option

---

## Implementation Order

Build in this sequence — each step is independently deployable:

```
[ ] 1. Liquibase changesets — tariff, meter_wallet, wallet_transactions tables
[ ] 2. Tariff management — seed default rate, admin API to update
[ ] 3. Deduction logic in ReadingIngestionService
[ ] 4. Wallet APIs — balance view + manual recharge (admin)
[ ] 5. DCU command sender — disconnect/reconnect (REST or MQTT)
[ ] 6. Low balance alert — SMS or in-app
[ ] 7. Resident wallet view on dashboard
[ ] 8. Payment gateway webhook (Razorpay) — for self-recharge
[ ] 9. Automated reconnect on recharge
```

---

## What Is Already in Place

The current codebase makes this straightforward to add:

| Existing | How it helps |
|---|---|
| `ReadingIngestionService` — single entry point | Deduction logic plugs in here without touching controllers |
| `DailyConsumptionAggregator` scheduler pattern | Cost deduction scheduler follows same pattern |
| `MeterStatus` enum | Just add `LOW_BALANCE`, `DISCONNECTED` values |
| MQTT config with `@ConditionalOnProperty` | Outbound MQTT command channel uses same broker connection |
| `DcuRestController` pattern | Reverse REST call to DCU follows same structure |
| Liquibase changelog | Just add changeset 006, 007, 008 |
| `GlobalExceptionHandler` | Wallet-specific exceptions handled automatically |

---

## Configuration Reference

```yaml
app:
  wallet:
    low-balance-alert-threshold: ${WALLET_LOW_BALANCE_THRESHOLD:50.00}
    disconnect-threshold: ${WALLET_DISCONNECT_THRESHOLD:0.00}
    default-tariff-rate: ${WALLET_DEFAULT_TARIFF:6.50}   # ₹ per kWh

  dcu:
    command-topic: dcu/{dcuId}/meter/{meterNumber}/command  # MQTT mode
    relay-endpoint: /api/relay                              # REST mode
```
