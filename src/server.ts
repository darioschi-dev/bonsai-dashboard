// ============================================================================
//  Bonsai MQTT Dashboard – Server backend (OTA + MQTT + storage + config)
//  VERSIONE DEFINITIVA — Firmware unico, config per-device
// ============================================================================

import express, { Request, Response, NextFunction } from "express";
import path from "path";
import dotenv from "dotenv";
import multer from "multer";
import fs from "fs";
import fsp from "fs/promises";
import crypto from "crypto";
import mqtt from "mqtt";
import { fileURLToPath } from "url";
import db from "./db.js";

// ----------------------------------------------------------------------------
//  ENV
// ----------------------------------------------------------------------------

dotenv.config({ path: ".env" });
if (fs.existsSync(".env.local"))
    dotenv.config({ path: ".env.local", override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || "8081", 10);
const HOST = process.env.HOST || "0.0.0.0";
const MQTT_URL = process.env.MQTT_URL || "mqtt://localhost:1883";
const BASE_URL_ENV = process.env.BASE_URL || "";
const OTA_TOKEN = process.env.OTA_TOKEN || "";
const UPDATE_HOST = (process.env.UPDATE_HOST || "bonsai-iot-update.darioschiavano.it").toLowerCase();

// ----------------------------------------------------------------------------
//  DIRECTORIES
// ----------------------------------------------------------------------------

const uploadsDir = path.resolve(__dirname, "..", "uploads");
const firmwareDir = path.join(uploadsDir, "firmware");
const configDir = path.join(uploadsDir, "config");
const tmpDir = path.join(uploadsDir, "tmp");

async function ensureDirectories() {
    await fsp.mkdir(firmwareDir, { recursive: true });
    await fsp.mkdir(configDir, { recursive: true });
    await fsp.mkdir(tmpDir, { recursive: true });
}

function getConfigPath(deviceId: string) {
    return path.join(configDir, `${deviceId}.json`);
}

const MANIFEST_PATH = path.join(firmwareDir, "manifest.json");

// ----------------------------------------------------------------------------
//  HELPERS
// ----------------------------------------------------------------------------

function resolveBaseUrl(req: Request): string {
    if (BASE_URL_ENV) return BASE_URL_ENV.replace(/\/+$/, "");
    const proto =
        (req.headers["x-forwarded-proto"] as string) ||
        req.protocol ||
        "http";
    const host =
        ((req.headers["x-forwarded-host"] as string) ||
            req.headers.host ||
            "").split(",")[0].trim();
    return `${proto}://${host}`;
}

async function sha256File(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash("sha256");
        const stream = fs.createReadStream(filePath);
        stream.on("data", (d) => hash.update(d));
        stream.on("end", () => resolve(hash.digest("hex")));
        stream.on("error", reject);
    });
}

// ----------------------------------------------------------------------------
//  MANIFEST OTA (solo firmware, nessuna config!)
// ----------------------------------------------------------------------------

async function buildFullManifest(baseUrl: string) {

    const binPath = path.join(firmwareDir, "esp32.bin");
    let firmwareSection: any;

    try {
        const stat = await fsp.stat(binPath);
        const sha = await sha256File(binPath);

        firmwareSection = {
            version: process.env.FIRMWARE_VERSION || "v0.0.0",
            url: `${baseUrl}/firmware/esp32.bin`,
            sha256: sha,
            size: stat.size,
            created_at: new Date().toISOString(),
        };
    } catch {
        firmwareSection = {
            version: "v0.0.0",
            url: `${baseUrl}/firmware/esp32.bin`,
            sha256: "",
            size: 0,
            created_at: new Date().toISOString(),
        };
    }

    const manifest = {
        server: {
            node: process.version,
            timestamp: new Date().toISOString(),
            pm_id: process.env.pm_id ?? null,
        },
        firmware: firmwareSection,
        // ⚠️ NESSUNA CONFIG QUI
    };

    await fsp.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
    return manifest;
}

// ----------------------------------------------------------------------------
//  MQTT
// ----------------------------------------------------------------------------

const mqttClient = mqtt.connect(MQTT_URL);

mqttClient.on("connect", () => {
    console.log("📡 MQTT connected");
    mqttClient.subscribe("bonsai/+/status/#");
    mqttClient.subscribe("bonsai/status/#");
});

mqttClient.on("message", (topic, payloadBuffer) => {
    const payload = payloadBuffer.toString();

    const match = topic.match(/^bonsai\/([^/]+)\/status\/([^/]+)$/);
    if (!match) return;

    const deviceId = match[1];
    const field    = match[2];

    const stmt = db.prepare(
        `INSERT INTO device_data 
         (device_id, humidity, temperature, battery, rssi, firmware, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
    );

    const value = payload;

    const record: any = {
        humidity: null,
        temperature: null,
        battery: null,
        rssi: null,
        firmware: null
    };

    switch (field) {
        case "humidity":   record.humidity   = Number(value); break;
        case "temp":       record.temperature = Number(value); break;
        case "battery":    record.battery    = Number(value); break;
        case "wifi":       record.rssi       = Number(value); break;
        case "firmware":   record.firmware   = value; break;
        default:
            return;
    }

    stmt.run(
        deviceId,
        record.humidity,
        record.temperature,
        record.battery,
        record.rssi,
        record.firmware,
        new Date().toISOString()
    );

    console.log("💾 [DB] Inserito", deviceId, field, value);
});

function publishRetained(topic: string, payload: string) {
    mqttClient.publish(topic, payload, { retain: true });
}

// ----------------------------------------------------------------------------
//  EXPRESS
// ----------------------------------------------------------------------------

const app = express();
app.use(express.json());

// ----------------------------------------------------------------------------
//  STATIC PATHS
// ----------------------------------------------------------------------------

app.use(
    "/firmware",
    express.static(firmwareDir, {
        setHeaders: (res, fp) => {
            if (fp.endsWith("manifest.json"))
                res.setHeader("Cache-Control", "no-store");
            if (fp.endsWith(".bin"))
                res.setHeader("Cache-Control", "no-cache");
        },
    })
);

app.use("/config", express.static(configDir));

// ----------------------------------------------------------------------------
//  BLOCK routes from UPDATE_HOST
// ----------------------------------------------------------------------------

app.use((req, res, next) => {
    const rawHost =
        (req.headers["x-forwarded-host"] as string) ||
        req.headers.host ||
        "";
    const host = rawHost.split(",")[0].trim().toLowerCase();

    if (host === UPDATE_HOST) {
        const ok =
            req.path === "/upload-firmware" ||
            req.path.startsWith("/firmware") ||
            req.path === "/api/ota/announce" ||
            req.path.startsWith("/config");

        if (!ok) return res.status(404).send("Not found");
    }

    next();
});

// ----------------------------------------------------------------------------
//  DEBUG INFO
// ----------------------------------------------------------------------------

app.get("/debug/build", async (_req, res) => {
    try {
        let manifest = null;
        try {
            const raw = await fsp.readFile(MANIFEST_PATH, "utf8");
            manifest = JSON.parse(raw);
        } catch {}

        res.json({
            ok: true,
            server: {
                node: process.version,
                uptime_seconds: Math.round(process.uptime()),
                pm_id: process.env.pm_id ?? null,
            },
            build: {
                timestamp: process.env.BUILD_TIMESTAMP || "unknown"
            },
            manifest
        });
    } catch (err) {
        res.status(500).json({ ok: false, error: "debug_failed" });
    }
});

// ----------------------------------------------------------------------------
//  OTA UPLOAD (solo firmware)
// ----------------------------------------------------------------------------

let uploading = false;

const upload = multer({
    dest: tmpDir,
    limits: { fileSize: 4 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (file.fieldname !== "firmware" &&
            file.fieldname !== "version_file") {
            return cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE"));
        }
        cb(null, true);
    },
});

app.post(
    "/upload-firmware",
    upload.fields([{ name: "firmware", maxCount: 1 }, { name: "version_file", maxCount: 1 }]),
    async (req: Request, res: Response) => {

        if (uploading) return res.status(409).json({ error: "Upload già in corso" });
        uploading = true;

        try {
            // --- Auth ---
            if (OTA_TOKEN) {
                const auth = (req.headers.authorization || "").trim();
                if (!auth.startsWith("Bearer ") || auth.slice(7) !== OTA_TOKEN)
                    return res.status(401).json({ error: "Unauthorized" });
            }

            // --- File firmware ---
            const fw = (req.files as any)?.firmware?.[0];
            if (!fw) return res.status(400).json({ error: "File mancante (campo 'firmware')" });

            // --- Version extraction ---
            let version = "";
            const versionFile = (req.files as any)?.version_file?.[0];
            if (versionFile) version = (await fsp.readFile(versionFile.path, "utf-8")).trim();
            if (!version) version = (req.body?.version || "").toString().trim();

            const reSemver = /^v\d+\.\d+\.\d+$/;
            const reTs = /^\d{12}$/;
            const reComb = /^v\d+\.\d+\.\d+\+\d{12}$/;

            if (!(reSemver.test(version) || reTs.test(version) || reComb.test(version)))
                return res.status(400).json({ error: "Version non valida" });

            if (version.length > 31)
                return res.status(400).json({ error: "Version troppo lunga" });

            // --- Sposta atomicamente il firmware ---
            const tmpAtomic = path.join(firmwareDir, ".esp32.bin.tmp");
            await fsp.rename(fw.path, tmpAtomic);

            const binPath = path.join(firmwareDir, "esp32.bin");
            await fsp.rename(tmpAtomic, binPath);

            // --- Ricostruisci manifest ---
            const base = resolveBaseUrl(req);
            process.env.FIRMWARE_VERSION = version;
            const manifest = await buildFullManifest(base);

            publishRetained("bonsai/ota/available", JSON.stringify(manifest));

            console.log(`[OTA] Firmware aggiornato: ${version}`);
            res.json({ success: true, manifest });

        } catch (err) {
            console.error("❌ Errore OTA:", err);
            res.status(500).json({ error: "Errore interno upload OTA" });
        } finally {
            uploading = false;
        }
    }
);

// ----------------------------------------------------------------------------
//  CONFIG PER-DEVICE
// ----------------------------------------------------------------------------

app.get("/api/device/:deviceId/config", async (req, res) => {
    const file = getConfigPath(req.params.deviceId);
    try {
        const data = JSON.parse(await fsp.readFile(file, "utf8"));
        res.json(data);
    } catch {
        res.json({});
    }
});

app.post("/api/device/:deviceId/config", async (req, res) => {
    const file = getConfigPath(req.params.deviceId);
    const cfg = req.body ?? {};

    cfg.config_version = new Date()
        .toISOString()
        .replace(/[-:.TZ]/g, "")
        .slice(0, 14);

    await fsp.writeFile(file, JSON.stringify(cfg, null, 2));

    res.json({ ok: true, config_version: cfg.config_version });
});

// ----------------------------------------------------------------------------
//  OTA MANIFEST RE-PUBLISH
// ----------------------------------------------------------------------------

app.post("/api/ota/announce", async (req, res) => {
    try {
        const base = resolveBaseUrl(req);
        const manifest = await buildFullManifest(base);
        publishRetained("bonsai/ota/available", JSON.stringify(manifest));
        res.json({ ok: true });
    } catch {
        res.status(500).json({ error: "manifest_error" });
    }
});

// ----------------------------------------------------------------------------
//  FIRMWARE VERSION
// ----------------------------------------------------------------------------

app.get("/api/firmware/version", async (_req, res) => {
    try {
        const raw = JSON.parse(await fsp.readFile(MANIFEST_PATH, "utf-8"));
        res.json(raw.firmware);
    } catch {
        res.status(404).json({ error: "Manifest non trovato" });
    }
});

// ----------------------------------------------------------------------------
//  DATABASE API
// ----------------------------------------------------------------------------

app.get("/api/history/:deviceId", (req, res) => {
    const stmt = db.prepare(
        `SELECT * FROM device_data 
         WHERE device_id = ? 
         ORDER BY created_at DESC 
         LIMIT 200`
    );
    res.json(stmt.all(req.params.deviceId));
});

app.get("/api/device/:deviceId/latest", (req, res) => {
    const stmt = db.prepare(
        `SELECT * FROM device_data 
         WHERE device_id = ? 
         ORDER BY created_at DESC 
         LIMIT 1`
    );
    res.json(stmt.get(req.params.deviceId));
});

app.get("/api/devices", (_req, res) => {
    const stmt = db.prepare(
        `SELECT DISTINCT device_id
         FROM device_data
         ORDER BY device_id ASC`
    );
    res.json(stmt.all().map((r: any) => r.device_id));
});

// ----------------------------------------------------------------------------
//  FRONTEND
// ----------------------------------------------------------------------------

const staticPath = path.resolve(__dirname, "../dist-frontend");
app.use(express.static(staticPath));

app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
});

// ----------------------------------------------------------------------------
//  ERROR HANDLER
// ----------------------------------------------------------------------------

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof multer.MulterError)
        return res.status(400).json({ error: "MulterError", code: err.code });

    res.status(500).json({
        error: "Errore interno",
        details: (err as Error)?.message,
    });
});

// ----------------------------------------------------------------------------
//  STARTUP
// ----------------------------------------------------------------------------

await ensureDirectories();

app.listen(PORT, HOST, () =>
    console.log(`🌱 Server Bonsai pronto su http://${HOST}:${PORT}`)
);
