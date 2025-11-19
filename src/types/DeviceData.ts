export interface DeviceDataRow {
    id: number
    device_id: string
    humidity: number | null
    temperature: number | null
    battery: number | null
    rssi: number | null
    firmware: string | null
    created_at: string // ISO string
}

export type DeviceLatestResponse = DeviceDataRow | null;

export type DevicesListResponse = string[];
