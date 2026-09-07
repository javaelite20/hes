package org.smarttech.entity.enums;

public enum DcuIntegrationMode {
    /** DCU pushes readings to a REST endpoint exposed by this server (MVP). */
    REST,

    /** Readings are ingested via MQTT broker subscription (production). */
    MQTT
}
