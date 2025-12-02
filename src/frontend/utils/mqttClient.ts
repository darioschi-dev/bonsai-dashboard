import mqtt, { MqttClient } from "mqtt";

let cachedClient: MqttClient | null = null;
let isConnected = false;
let isSubscribed = false;

export function mqttConnect(
    brokerUrl: string,
    clientId: string,
    onMessage: (topic: string, message: string) => void
): Promise<MqttClient> {

    // 1️⃣ Se il client esiste, non creo una nuova connessione
    if (cachedClient) {
        // mi assicuro che il listener sia registrato solo UNA volta
        cachedClient.removeAllListeners("message");
        cachedClient.on("message", (topic, payload) =>
            onMessage(topic, payload.toString())
        );
        return Promise.resolve(cachedClient);
    }

    return new Promise((resolve, reject) => {
        const client: MqttClient = mqtt.connect(brokerUrl, {
            clientId,
            username: import.meta.env.VITE_MQTT_USERNAME,
            password: import.meta.env.VITE_MQTT_PASSWORD,
            clean: true,
            reconnectPeriod: 2000,
        });

        cachedClient = client;

        client.on("connect", () => {
            if (!isConnected) {
                console.log("[MQTT] Connected to", brokerUrl);
                isConnected = true;
            }

            // 2️⃣ Subscribe eseguita UNA volta sola
            if (!isSubscribed) {
                client.subscribe("bonsai/+/status/#", (err) => {
                    if (err) {
                        console.error("[MQTT] Subscribe error:", err);
                    } else {
                        console.log("[MQTT] Subscribed to bonsai/+/status/#");
                        isSubscribed = true;
                    }
                });
            }

            resolve(client);
        });

        // 3️⃣ Un solo listener message
        client.on("message", (topic, payload) => {
            onMessage(topic, payload.toString());
        });

        client.on("error", (err) => {
            console.error("[MQTT] Connection error:", err);
            reject(err);
        });
    });
}
