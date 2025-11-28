import { reactive } from "vue";

export interface ServerConfig {
    // Estratti dal manifest OTA
    latest_firmware?: string;            // firmware.version
    latest_firmware_url?: string;        // firmware.url
    latest_firmware_sha256?: string;     // firmware.sha256
    latest_firmware_size?: number;       // firmware.size
    latest_firmware_created_at?: string; // firmware.created_at

    // Versione di configurazione globale (opzionale)
    config_version?: string;
}

export const serverConfig = reactive<ServerConfig>({});
