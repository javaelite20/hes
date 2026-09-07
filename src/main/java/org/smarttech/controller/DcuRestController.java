package org.smarttech.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.smarttech.dto.dcu.DcuReadingRequest;
import org.smarttech.entity.MeterReading;
import org.smarttech.service.ReadingIngestionService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * REST endpoint for DCU reading ingestion.
 *
 * Active only when:  app.dcu.integration-mode=REST
 *
 * The DCU (or any upstream system) pushes readings by POSTing to:
 *   POST /api/v1/dcu/readings          — single reading
 *   POST /api/v1/dcu/readings/batch    — batch of readings in one call
 *
 * Security: endpoint is open by design so the DCU device can call it
 * without managing a user JWT. In production, protect it with an API key
 * header or IP allowlisting at the network/gateway level.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/dcu")
@RequiredArgsConstructor
@ConditionalOnProperty(name = "app.dcu.integration-mode", havingValue = "REST")
public class DcuRestController {

    private static final String SOURCE = "REST";

    private final ReadingIngestionService ingestionService;

    /**
     * POST /api/v1/dcu/readings
     * Single reading push from DCU.
     */
    @PostMapping("/readings")
    public ResponseEntity<Map<String, Object>> ingestReading(
            @Valid @RequestBody DcuReadingRequest request) {

        MeterReading saved = ingestionService.ingest(request, SOURCE);

        return ResponseEntity.ok(Map.of(
                "status", "accepted",
                "readingId", saved.getId(),
                "meterNumber", request.getMeterNumber(),
                "recordedAt", saved.getRecordedAt().toString()
        ));
    }

    /**
     * POST /api/v1/dcu/readings/batch
     * Batch push — useful when DCU buffers readings and flushes them together.
     * Each reading is processed independently; one failure does not block others.
     */
    @PostMapping("/readings/batch")
    public ResponseEntity<Map<String, Object>> ingestBatch(
            @Valid @RequestBody List<DcuReadingRequest> requests) {

        int accepted = 0;
        int failed = 0;

        for (DcuReadingRequest request : requests) {
            try {
                ingestionService.ingest(request, SOURCE);
                accepted++;
            } catch (Exception e) {
                log.error("[REST] Failed to ingest reading for meter {}: {}",
                        request.getMeterNumber(), e.getMessage());
                failed++;
            }
        }

        return ResponseEntity.ok(Map.of(
                "total", requests.size(),
                "accepted", accepted,
                "failed", failed
        ));
    }

    /**
     * GET /api/v1/dcu/status
     * Simple health-check so the DCU can verify it can reach the server.
     */
    @GetMapping("/status")
    public ResponseEntity<Map<String, String>> status() {
        return ResponseEntity.ok(Map.of(
                "mode", "REST",
                "status", "online"
        ));
    }
}
