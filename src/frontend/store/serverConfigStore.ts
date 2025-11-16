import { reactive } from "vue"

export interface ServerConfig {
    latest_firmware?: string
    latest_firmware_url?: string
    latest_firmware_sha256?: string
    latest_firmware_size?: number
    latest_firmware_updated_at?: string
}

export const serverConfig = reactive<ServerConfig>({})
