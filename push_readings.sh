#!/bin/bash

# Push 30 days of realistic meter readings for MTR-001
# Each day gets 4 readings (every 6 hours) simulating real DCU push interval
# kWh value is cumulative (odometer style) — starts at 1200 and grows daily

BASE_URL="http://localhost:8080/api/v1/dcu/readings"
METER="MTR-001"

# Starting cumulative kWh
KWH=1200.0000

echo "Pushing readings for meter: $METER"
echo "---"

for DAY in $(seq 29 -1 0); do
  # Random daily consumption between 4.5 and 9.5 kWh
  DAILY=$(python3 -c "import random; print(round(random.uniform(4.5, 9.5), 4))")

  # Spread across 4 readings per day (each ~25% of daily)
  QUARTER=$(python3 -c "print(round($DAILY / 4, 4))")

  DATE=$(date -v -${DAY}d +%Y-%m-%d 2>/dev/null || date -d "$DAY days ago" +%Y-%m-%d)

  for HOUR in 00 06 12 18; do
    KWH=$(python3 -c "print(round($KWH + $QUARTER, 4))")
    TIMESTAMP="${DATE}T${HOUR}:00:00"

    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL" \
      -H "Content-Type: application/json" \
      -d "{\"meter_number\":\"$METER\",\"kwh_value\":$KWH,\"instant_power_watts\":$(python3 -c "import random; print(round(random.uniform(200, 900), 1))"),\"recorded_at\":\"$TIMESTAMP\"}")

    if [ "$RESPONSE" = "200" ]; then
      echo "✓ $TIMESTAMP → $KWH kWh"
    else
      echo "✗ $TIMESTAMP → HTTP $RESPONSE"
    fi
  done

done

echo "---"
echo "Done. Final meter reading: $KWH kWh"
