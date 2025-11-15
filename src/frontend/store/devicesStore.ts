import { reactive } from 'vue'

export interface DeviceInfo {
    humidity?: number
    temperature?: number
    battery?: number
    rssi?: number
    firmware?: string
    lastSeen?: string
    lastUpdate?: number
    status?: 'online' | 'offline'
}

export const devicesStore = reactive<Record<string, DeviceInfo>>({})
