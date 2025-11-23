export interface ServerConfig {
    config_version?: string;

    latest_firmware?: string;
    latest_firmware_url?: string;
    latest_firmware_sha256?: string;
    latest_firmware_size?: number;
    latest_firmware_updated_at?: string;

    // Config vecchia del device:
    wifi_ssid?: string;
    wifi_password?: string;

    mqtt_broker?: string;
    mqtt_port?: number;
    mqtt_username?: string;
    mqtt_password?: string;

    sensor_pin?: number;
    pump_pin?: number;
    relay_pin?: number;
    battery_pin?: number;

    moisture_threshold?: number;
    pump_duration?: number;
    measurement_interval?: number;
    debug?: boolean;
    use_pump?: boolean;
    sleep_hours?: number;

    use_dhcp?: boolean;
    ip_address?: string;
    gateway?: string;
    subnet?: string;

    // fallback:
    [key: string]: any;
}
