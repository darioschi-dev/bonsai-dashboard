import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

// risolve il percorso assoluto del file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// directory dist/database in produzione
const dbPath = path.join(__dirname, "database", "bonsai.sqlite");

// crea cartella database se non esiste
import fs from "fs";
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// apre/crea db
const db = new Database(dbPath);

// tabella base
db.exec(`
    CREATE TABLE IF NOT EXISTS device_data (
                                               id INTEGER PRIMARY KEY AUTOINCREMENT,
                                               device_id TEXT NOT NULL,
                                               humidity REAL,
                                               temperature REAL,
                                               battery REAL,
                                               rssi REAL,
                                               firmware TEXT,
                                               created_at TEXT NOT NULL
    );
`);

export default db;
