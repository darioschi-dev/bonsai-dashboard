import express, { Request, Response, NextFunction } from "express";
import path from "path";
import dotenv from "dotenv";
import multer from "multer";
import fs from "fs";
import fsp from "fs/promises";
import crypto from "crypto";
import mqtt from "mqtt";
import { fileURLToPath } from "url";

// --- ENVIRONMENT ------------------------------------------------------------

dotenv.config({ path: ".env" });
if (fs.existsSync(".env.local")) dotenv.config({ path: ".env.local", override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || "8081", 10);
const HOST = process.env.HOST || "0.0.0.0";
const MQTT_URL = process.env.MQTT_URL || "mqtt://localhost:1883";
const BASE_URL_ENV = process.env.BASE_URL || "";
const OTA_TOKEN = process.env.OTA_TOKEN || "";
const UPDATE_HOST = (process.env.UPDATE_HOST || "bonsai-iot-update.darioschiavano.it").toLowerCase();

// --- MQTT -------------------------------------------------------------------

const mqttClient = mqtt.connect(MQTT_URL);
mqttClient.on("connect", () => console.log("📡 MQTT connected"));
mqttClient.on("message", (topic, msg) => console.log(`📨 ${topic}: ${msg.toString()}`));

const publishRetained = async (topic: string, payload: string) => {
    mqttClient.publish(topic, payload, { retain: true });
};

// --- EXPRESS APP ------------------------------------------------------------

const app = express();
app.use(express.json());

// --- DIRECTORIES ------------------------------------------------------------

const uploadsDir = path.resolve(__dirname, "..", "uploads");
const firmwareDir = path.join(uploadsDir, "firmware");
const tmpDir = path.join(uploadsDir, "tmp");

await fsp.mkdir(firmwareDir, { recursive: true });
await fsp.mkdir(tmpDir, { recursive: true });

// --- HELPERS ----------------------------------------------------------------

function resolveBaseUrl(req: Request): string {
    if (BASE_URL_ENV) return BASE_URL_ENV.replace(/\/+$/, "");
    const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "http";
    const host = ((req.headers["x-forwarded-host"] as string) || req.headers.host || "").split(",")[0].trim();
    return `${proto}://${host}`;
}

async function sha256File(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const h = crypto.createHash("sha256");
        const s = fs.createReadStream(filePath);
        s.on("data", (d) => h.update(d));
        s.on("end", () => resolve(h.digest("hex")));
        s.on("error", reject);
    });
}

// --- STATIC OTA FILES -------------------------------------------------------

app.use("/firmware", express.static(firmwareDir, {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith("manifest.json")) res.setHeader("Cache-Control", "no-store");
        if (filePath.endsWith(".bin")) res.setHeader("Cache-Control", "no-cache");
    },
}));

// limit access when host matches UPDATE_HOST
app.use((req, res, next) => {
    const rawHost = (req.headers["x-forwarded-host"] as string) || req.headers.host || "";
    const host = rawHost.split(",")[0].trim().toLowerCase();
    if (host === UPDATE_HOST) {
        if (req.path === "/upload-firmware" || req.path.startsWith("/firmware") || req.path === "/api/ota/announce")
            return next();
        return res.status(404).send("Not found");
    }
    return next();
});

// --- OTA UPLOAD -------------------------------------------------------------

let uploading = false;

const upload = multer({
    dest: tmpDir,
    limits: { fileSize: 4 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (file.fieldname !== "firmware" && file.fieldname !== "version_file") {
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
            if (OTA_TOKEN) {
                const auth = (req.headers.authorization || "").trim();
                if (!auth.startsWith("Bearer ") || auth.slice(7) !== OTA_TOKEN)
                    return res.status(401).json({ error: "Unauthorized" });
            }

            const fw = (req.files as any)?.firmware?.[0];
            if (!fw) return res.status(400).json({ error: "File mancante (campo 'firmware')" });

            // Estrai versione
            let version = "";
            const versionFile = (req.files as any)?.version_file?.[0];
            if (versionFile) version = (await fsp.readFile(versionFile.path, "utf-8")).trim();
            if (!version) version = (req.body?.version || "").toString().trim();

            // Validazione versione
            const reSemver = /^v\d+\.\d+\.\d+$/;
            const reTs = /^\d{12}$/;
            const reComb = /^v\d+\.\d+\.\d+\+\d{12}$/;
            if (!(reSemver.test(version) || reTs.test(version) || reComb.test(version)))
                return res.status(400).json({ error: "Version non valida" });

            if (version.length > 31)
                return res.status(400).json({ error: "Version troppo lunga (max 31)" });

            // SHA e manifest
            const tmpAtomic = path.join(firmwareDir, ".esp32.bin.tmp");
            await fsp.rename(fw.path, tmpAtomic);
            const sha256 = await sha256File(tmpAtomic);
            const stat = await fsp.stat(tmpAtomic);
            const binPath = path.join(firmwareDir, "esp32.bin");
            const manifestPath = path.join(firmwareDir, "manifest.json");

            await fsp.rename(tmpAtomic, binPath);

            const base = resolveBaseUrl(req);
            const url = `${base}/firmware/esp32.bin`;
            const manifest = { version, url, sha256, size: stat.size, created_at: new Date().toISOString() };
            await fsp.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");

            await publishRetained("bonsai/ota/available", JSON.stringify(manifest));

            console.log(`[OTA] ✅ Upload completato: ${version}`);
            res.json({ success: true, manifest });
        } catch (err: any) {
            console.error("❌ Errore OTA:", err.message);
            res.status(500).json({ error: "Errore interno upload OTA" });
        } finally {
            uploading = false;
        }
    }
);

// --- API PER-DEVICE ---------------------------------------------------------

/** Comando pompa */
app.post("/api/pump/:deviceId", (req, res) => {
    const { deviceId } = req.params;
    const action = String(req.body?.action || "").toLowerCase();
    if (!["on", "off"].includes(action))
        return res.status(400).json({ error: "Invalid 'action'. Use 'on' or 'off'." });

    const topic = `bonsai/${deviceId}/command/pump`;
    mqttClient.publish(topic, action.toUpperCase());
    console.log(`💦 [${deviceId}] Pump ${action.toUpperCase()}`);
    res.json({ ok: true, deviceId, action });
});

/** Aggiornamento config (live o mailbox) */
app.post("/api/config/:deviceId", async (req, res) => {
    const { deviceId } = req.params;
    const mode = String(req.query.mode || "both").toLowerCase();
    const cfg = req.body || {};

    const doLive = mode === "live" || mode === "both";
    const doMailbox = mode === "mailbox" || mode === "both";

    if (doLive) {
        mqttClient.publish(`bonsai/config/set/${deviceId}`, JSON.stringify(cfg), { retain: false });
        console.log(`⚙️ [${deviceId}] Config sent (live)`);
    }
    if (doMailbox) {
        mqttClient.publish(`bonsai/config/${deviceId}`, JSON.stringify(cfg), { retain: true });
        console.log(`📬 [${deviceId}] Config sent (mailbox)`);
    }

    res.json({ ok: true, deviceId, mode });
});

/** Ripubblica OTA manifest */
app.post("/api/ota/announce", async (_req, res) => {
    try {
        const manifest = await fsp.readFile(path.join(firmwareDir, "manifest.json"), "utf-8");
        await publishRetained("bonsai/ota/available", manifest);
        res.json({ ok: true });
    } catch {
        res.status(404).json({ error: "Manifest non trovato" });
    }
});

/** Versione firmware attuale */
app.get("/api/firmware/version", async (_req, res) => {
    try {
        const data = JSON.parse(await fsp.readFile(path.join(firmwareDir, "manifest.json"), "utf-8"));
        res.json({ version: data.version, size: data.size, sha256: data.sha256, url: data.url, created_at: data.created_at });
    } catch {
        res.status(404).json({ error: "Manifest non trovato" });
    }
});

// --- FRONTEND ---------------------------------------------------------------
const staticPath = path.resolve(__dirname, "../dist-frontend");

app.use(express.static(staticPath));

app.get("*", (_, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
});

// --- ERROR HANDLER ----------------------------------------------------------

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof multer.MulterError)
        return res.status(400).json({ error: "MulterError", code: err.code });
    res.status(500).json({ error: "Errore interno", details: (err as Error)?.message });
});

// --- STARTUP ----------------------------------------------------------------

app.listen(PORT, HOST, () => console.log(`🌱 Server Bonsai pronto su http://${HOST}:${PORT}`));
