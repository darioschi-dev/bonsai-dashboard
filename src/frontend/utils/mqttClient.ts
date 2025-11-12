import mqtt, { MqttClient } from 'mqtt'

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
        })

        client.on('connect', () => {
            console.log("[MQTT] Connected to", brokerUrl)
            client.subscribe("bonsai/+/data")
            resolve(client)
        })

        client.on("message", (topic, message) => {
            onMessage(topic, message.toString())
        })

        client.on("error", (err) => reject(err))
    })
}
