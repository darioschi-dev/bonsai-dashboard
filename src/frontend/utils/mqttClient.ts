import mqtt, { MqttClient } from "mqtt";

export function mqttConnect(
    brokerUrl: string,
    clientId: string,
    onMessage: (topic: string, message: string) => void
): Promise<MqttClient> {
    return new Promise((resolve, reject) => {
        const client: MqttClient = mqtt.connect(brokerUrl, {
            clientId,
            username: import.meta.env.VITE_MQTT_USERNAME,
            password: import.meta.env.VITE_MQTT_PASSWORD,
            clean: true,
            reconnectPeriod: 2000,
        });

        client.on("connect", () => {
            console.log("[MQTT] Connected to", brokerUrl);

            // Sottoscrizione a TUTTI i messaggi di stato:
            // bonsai/<device_id>/status/<field>
            client.subscribe("bonsai/+/status/#", (err) => {
                if (err) {
                    console.error("[MQTT] Subscribe error:", err);
                } else {
                    console.log("[MQTT] Subscribed to bonsai/+/status/#");
                }
            });

            resolve(client);
        });

        client.on("message", (topic, payload) => {
            onMessage(topic, payload.toString());
        });

        client.on("error", (err) => {
            console.error("[MQTT] Connection error:", err);
            reject(err);
        });
    });
}
