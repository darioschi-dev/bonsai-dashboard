import { reactive } from "vue";

export interface DeviceInfo {
    humidity?: number | null;
    temperature?: number | null;
    battery?: number | null;
    rssi?: number | null;
    firmware?: string | null;

    /** timestamp ISO dell’ultima lettura */
    created_at?: string | null;

    /** per la UI */
    lastSeen?: string;
    lastUpdate?: number;
    status?: "online" | "offline";

    /** storico completo del DB (HistorySection) */
    history?: HistoryRow[];
}

export interface HistoryRow {
    id: number;
    device_id: string;
    humidity: number | null;
    temperature: number | null;
    battery: number | null;
    rssi: number | null;
    firmware: string | null;
    created_at: string; // ISO string
}

export const devicesStore = reactive<Record<string, DeviceInfo>>({});
