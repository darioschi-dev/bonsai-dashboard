import { reactive } from "vue";

/**
 * Riga dello storico letta dal database SQLite
 */
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

/**
 * Dati runtime del dispositivo, popolati da:
 * - /api/device/:id/latest
 * - MQTT live bonsai/<id>/status/#
 */
export interface DeviceInfo {
    humidity?: number | null;
    temperature?: number | null;
    battery?: number | null;
    rssi?: number | null;
    firmware?: string | null;

    /** Timestamp ISO dell’ultima lettura dal DB */
    created_at?: string | null;

    /** UI: ultimo messaggio ricevuto (stringa locale hh:mm:ss) */
    lastSeen?: string;

    /** ms (Date.now) dell’ultimo aggiornamento */
    lastUpdate?: number | null;

    /** Calcolato dal poller interno */
    status?: "online" | "offline";

    /** Storico delle ultime letture */
    history?: HistoryRow[];
}

/**
 * Store reattivo che contiene TUTTI i device visti:
 * - da MQTT
 * - dal backend (lista iniziale)
 * - da /api/device/:id/latest
 */
export const devicesStore = reactive<Record<string, DeviceInfo>>({});
