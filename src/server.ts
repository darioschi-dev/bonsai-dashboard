// ============================================================================
//  Bonsai MQTT Dashboard – Server backend (OTA + MQTT + storage + config)
//  VERSIONE FINALE, COMPLETA E COERENTE
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
import {ServerConfig} from "./types/ServerConfig";

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
//  DIRECTORIES (modello A)
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

const CONFIG_PATH = path.join(configDir, "config.json");
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

async function buildFullManifest(baseUrl: string) {
    // ---- CONFIG ----
    let cfg: any = {};
    try {
        cfg = JSON.parse(await fsp.readFile(CONFIG_PATH, "utf8"));
    } catch {
        cfg = { config_version: "000000000000" };
    }

    const configJson = JSON.stringify(cfg);
    const configSha = crypto.createHash("sha256").update(configJson).digest("hex");

    // ---- FIRMWARE ----
    let firmwareSection = null;
    const binPath = path.join(firmwareDir, "esp32.bin");

    try {
        const stat = await fsp.stat(binPath);
        const sha = await sha256File(binPath);

        firmwareSection = {
            version: cfg.firmware_version ?? "v0.0.0",
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

    // ---- CONFIG SECTION ----
    const configSection = {
        version: cfg.config_version ?? "000000000000",
        url: `${baseUrl}/config/config.json`,
        sha256: configSha,
        size: Buffer.byteLength(configJson),
        created_at: new Date().toISOString(),
    };

    // ---- SERVER SECTION ----
    const serverSection = {
        node: process.version,
        timestamp: new Date().toISOString(),
        pm_id: process.env.pm_id ?? null,
    };

    const manifest = {
        server: serverSection,
        firmware: firmwareSection,
        config: configSection,
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
    mqttClient.subscribe("bonsai/+/data");
});

mqttClient.on("message", (topic, payload) => {
    try {
        const match = topic.match(/^bonsai\/([^/]+)\/data$/);
        if (!match) return;

        const deviceId = match[1];
        const data = JSON.parse(payload.toString());

        const stmt = db.prepare(`
            INSERT INTO device_data (device_id, humidity, temperature, battery, rssi, firmware, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            deviceId,
            data.humidity ?? null,
            data.temperature ?? null,
            data.battery ?? null,
            data.rssi ?? null,
            data.firmware ?? null,
            new Date().toISOString()
        );

        console.log("💾 [DB] Inserito nuovo dato da", deviceId);
    } catch (e) {
        console.error("[DB] Errore parsing MQTT:", e);
    }
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
        setHeaders: (res, filePath) => {
            if (filePath.endsWith("manifest.json"))
                res.setHeader("Cache-Control", "no-store");
            if (filePath.endsWith(".bin"))
                res.setHeader("Cache-Control", "no-cache");
        },
    })
);

app.use("/config", express.static(configDir));

// BLOCK routes if request comes from UPDATE_HOST
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
//   DEBUG – BUILD INFORMATION
//
// ----------------------------------------------------------------------------
app.get("/debug/build", async (_req, res) => {
    try {
        // Versione Node
        const nodeVersion = process.version;

        // Tempo di avvio server (PM2)
        const uptimeSec = process.uptime();

        // Timestamp build (iniettato da Vite/TS durante build)
        // Se vuoi un vero timestamp, sostituisco con uno generato in fase build.
        const buildTs = process.env.BUILD_TIMESTAMP || "unknown";

        // Leggi manifest (se esiste)
        let manifest = null;
        try {
            const raw = await fsp.readFile(MANIFEST_PATH, "utf8");
            manifest = JSON.parse(raw);
        } catch (_) {
            manifest = null;
        }

        // Informazioni PM2 (se disponibili)
        const pm_id = process.env.pm_id || null;
        const pm2_env = process.env.pm2_env || null;

        res.json({
            ok: true,
            server: {
                node: nodeVersion,
                uptime_seconds: Math.round(uptimeSec),
                pm_id,
                pm2_env
            },
            build: {
                timestamp: buildTs
            },
            manifest
        });
    } catch (err) {
        console.error("DEBUG ERROR:", err);
        res.status(500).json({ ok: false, error: "debug_failed" });
    }
});

// ----------------------------------------------------------------------------
//  OTA UPLOAD (FIRMWARE)
// ----------------------------------------------------------------------------

let uploading = false;

const upload = multer({
    dest: tmpDir,
    limits: { fileSize: 4 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (
            file.fieldname !== "firmware" &&
            file.fieldname !== "version_file"
        ) {
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
            // --- Auth ---------------------------------------------------------
            if (OTA_TOKEN) {
                const auth = (req.headers.authorization || "").trim();
                if (!auth.startsWith("Bearer ") || auth.slice(7) !== OTA_TOKEN)
                    return res.status(401).json({ error: "Unauthorized" });
            }

            // --- File firmware ------------------------------------------------
            const fw = (req.files as any)?.firmware?.[0];
            if (!fw) return res.status(400).json({ error: "File mancante (campo 'firmware')" });

            // --- Version extraction -------------------------------------------
            let version = "";
            const versionFile = (req.files as any)?.version_file?.[0];
            if (versionFile) version = (await fsp.readFile(versionFile.path, "utf-8")).trim();
            if (!version) version = (req.body?.version || "").toString().trim();

            // Validazione
            const reSemver = /^v\d+\.\d+\.\d+$/;
            const reTs = /^\d{12}$/;
            const reComb = /^v\d+\.\d+\.\d+\+\d{12}$/;

            if (!(reSemver.test(version) || reTs.test(version) || reComb.test(version)))
                return res.status(400).json({ error: "Version non valida" });

            if (version.length > 31)
                return res.status(400).json({ error: "Version troppo lunga (max 31)" });

            // --- Aggiorna config.json con la nuova versione firmware ---
            try {
                let cfg: ServerConfig = {};
                try {
                    cfg = JSON.parse(await fsp.readFile(CONFIG_PATH, "utf8"));
                } catch {}

                cfg.firmware_version = version;

                await fsp.writeFile(CONFIG_PATH, JSON.stringify(cfg, null, 2));
            } catch (err) {
                console.error("❌ Errore aggiornando firmware_version in config:", err);
            }

            // --- Atomic move & SHA -------------------------------------------
            const tmpAtomic = path.join(firmwareDir, ".esp32.bin.tmp");
            await fsp.rename(fw.path, tmpAtomic);

            const binPath = path.join(firmwareDir, "esp32.bin");

            await fsp.rename(tmpAtomic, binPath);
            // --- BASE URL -----------------------------------------------------
            const base = resolveBaseUrl(req);

            // --- RICOSTRUISCI MANIFEST COMPLETO ---
            const manifest = await buildFullManifest(base);

            // --- OTA ANNOUNCE --------------------------------------------------
            publishRetained("bonsai/ota/available", JSON.stringify(manifest));

            console.log(`[OTA] Firmware aggiornato: ${version}`);
            res.json({ success: true, manifest });

        } catch (err: any) {
            console.error("❌ Errore OTA:", err);
            res.status(500).json({ error: "Errore interno upload OTA" });
        } finally {
            uploading = false;
        }
    }
);

// ----------------------------------------------------------------------------
//  CONFIG API (CONFIG GLOBALE)
// ----------------------------------------------------------------------------

app.get("/api/config", async (_req, res) => {
    try {
        const data = JSON.parse(await fsp.readFile(CONFIG_PATH, "utf-8"));
        res.json(data);
    } catch {
        res
            .status(404)
            .json({ error: "config.json non trovato" });
    }
});

app.post("/api/config", async (req, res) => {
    try {
        const cfg = req.body ?? {};

        // Genera nuova versione config
        const ts = new Date()
            .toISOString()
            .replace(/[-:.TZ]/g, "")
            .slice(0, 14);

        cfg.config_version = ts;

        await fsp.writeFile(CONFIG_PATH, JSON.stringify(cfg, null, 2));

        publishRetained("bonsai/config", JSON.stringify(cfg));

        const base = resolveBaseUrl(req);
        await buildFullManifest(base);

        console.log("⚙️ Config aggiornata → manifest OTA rigenerato");
        res.json({ ok: true, config_version: cfg.config_version });
    } catch (err) {
        console.error("❌ Errore aggiornamento config:", err);
        res.status(500).json({ error: "write_failed" });
    }
});

// Respinge config corrente tramite MQTT retained
app.post("/api/config/push", async (_req, res) => {
    try {
        const data = JSON.parse(await fsp.readFile(CONFIG_PATH, "utf-8"));
        publishRetained("bonsai/config", JSON.stringify(data));
        res.json({ ok: true });
    } catch {
        res.status(404).json({ error: "config.json non trovato" });
    }
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
    } catch (err) {
        console.error("❌ OTA announce error:", err);
        res.status(500).json({ error: "manifest_error" });
    }
});

// ----------------------------------------------------------------------------
//  FIRMWARE VERSION API
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
    const { deviceId } = req.params;
    const stmt = db.prepare(
        `SELECT * FROM device_data WHERE device_id = ? ORDER BY created_at DESC LIMIT 200`
    );
    res.json(stmt.all(deviceId));
});

app.get("/api/device/:deviceId/latest", (req, res) => {
    const { deviceId } = req.params;
    const stmt = db.prepare(
        `SELECT * FROM device_data WHERE device_id = ? ORDER BY created_at DESC LIMIT 1`
    );
    res.json(stmt.get(deviceId));
});

app.get("/api/devices", (_req, res) => {
    const stmt = db.prepare(
        `SELECT DISTINCT device_id FROM device_data ORDER BY device_id ASC`
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
