import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(__dirname, '..', 'database', 'bonsai.sqlite');
const db = new Database(dbPath);

// Creazione tabelle se non esistono
db.exec(`
CREATE TABLE IF NOT EXISTS device_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT,
    humidity REAL,
    temperature REAL,
    battery REAL,
    rssi REAL,
    firmware TEXT,
    timestamp INTEGER
);

CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT,
    type TEXT,
    payload TEXT,
    timestamp INTEGER
);
`);

export default db;
