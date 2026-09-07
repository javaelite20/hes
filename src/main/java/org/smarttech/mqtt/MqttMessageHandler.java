package org.smarttech.mqtt;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.smarttech.dto.dcu.DcuReadingRequest;
import org.smarttech.service.ReadingIngestionService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "app.dcu.integration-mode", havingValue = "MQTT")
public class MqttMessageHandler {

    private static final String SOURCE = "MQTT";

    private final ReadingIngestionService ingestionService;
    private final ObjectMapper objectMapper;

    public void handleMessage(String topic, String payload) {
        try {
            DcuReadingRequest request = objectMapper.readValue(payload, DcuReadingRequest.class);
            ingestionService.ingest(request, SOURCE);
        } catch (IllegalArgumentException e) {
            // unknown meter — already logged in ingestion service
        } catch (Exception e) {
            log.error("[MQTT] topic={} error={}", topic, e.getMessage());
        }
    }
}
