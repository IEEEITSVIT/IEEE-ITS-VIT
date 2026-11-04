import express from 'express';
import cors from 'cors';
import ExcelJS from 'exceljs';
import path from 'path';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 5000;
const EXCEL_FILE = path.join(__dirname, 'IEEE_ITS_DATABASE.xlsx');
const DB_FILE = path.join(__dirname, 'ieeeits.db');

app.use(cors());
app.use(express.json());
app.use('/pic', express.static(path.join(__dirname, 'pic')));

// Database connection
let db;

async function initDB() {
    db = await open({
        filename: DB_FILE,
        driver: sqlite3.Database
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS Profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT,
            time TEXT,
            name TEXT,
            email TEXT,
            mobile TEXT,
            regNo TEXT,
            memberType TEXT
        );

        CREATE TABLE IF NOT EXISTS Community (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT,
            time TEXT,
            email TEXT,
            type TEXT,
            message TEXT
        );

        CREATE TABLE IF NOT EXISTS Bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT,
            time TEXT,
            name TEXT,
            email TEXT,
            item TEXT,
            size TEXT,
            qty INTEGER,
            price REAL,
            total REAL
        );

        CREATE TABLE IF NOT EXISTS Logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT,
            time TEXT,
            email TEXT,
            name TEXT,
            type TEXT
        );
    `);
    console.log("SQLite Database initialized.");
}

// Initialize Excel File with Sheets and Headers
async function ensureExcel() {
    const workbook = new ExcelJS.Workbook();
    try {
        await workbook.xlsx.readFile(EXCEL_FILE);
        console.log("Excel Database found, loading...");
    } catch {
        console.log("Creating new Local Excel Database...");

        // 1. Profiles Sheet
        const profiles = workbook.addWorksheet('Profiles');
        profiles.columns = [
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Time', key: 'time', width: 15 },
            { header: 'Name', key: 'name', width: 25 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'Mobile', key: 'mobile', width: 15 },
            { header: 'Reg No', key: 'regNo', width: 15 },
            { header: 'Member Type', key: 'memberType', width: 20 }
        ];

        // 2. Community Sheet (Suggestions & Subscribers)
        const community = workbook.addWorksheet('Community');
        community.columns = [
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Time', key: 'time', width: 15 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'Type', key: 'type', width: 20 },
            { header: 'Message/Feedback', key: 'message', width: 50 }
        ];

        // 3. Bookings Sheet
        const bookings = workbook.addWorksheet('Bookings');
        bookings.columns = [
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Time', key: 'time', width: 15 },
            { header: 'Name', key: 'name', width: 25 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'Item', key: 'item', width: 20 },
            { header: 'Size', key: 'size', width: 10 },
            { header: 'Qty', key: 'qty', width: 10 },
            { header: 'Price', key: 'price', width: 15 },
            { header: 'Total', key: 'total', width: 15 }
        ];

        // 4. Logs Sheet
        const logs = workbook.addWorksheet('Logs');
        logs.columns = [
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Time', key: 'time', width: 15 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'Name', key: 'name', width: 25 },
            { header: 'Event', key: 'type', width: 20 }
        ];

        // Style headers
        workbook.eachSheet(sheet => {
            sheet.getRow(1).font = { bold: true };
            sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
        });

        await workbook.xlsx.writeFile(EXCEL_FILE);
    }
}

app.post('/api/save', async (req, res) => {
    try {
        const { category, data } = req.body;
        console.log(`[REQ] Received save request for: ${category}`);

        // Save to SQLite
        const sqliteTabeMap = { 'PROFILE': 'Profiles', 'COMMUNITY': 'Community', 'BOOKINGS': 'Bookings', 'LOGS': 'Logs' };
        const tableName = sqliteTabeMap[category];

        if (tableName) {
            const keys = Object.keys(data);
            const placeholders = keys.map(() => '?').join(', ');
            const values = Object.values(data);
            await db.run(`INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders})`, values);
            console.log(`[OK] Data saved to SQLite table "${tableName}"`);
        }

        // Save to Excel (Backup)
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(EXCEL_FILE);
        const sheetMap = { 'PROFILE': 'Profiles', 'COMMUNITY': 'Community', 'BOOKINGS': 'Bookings', 'LOGS': 'Logs' };
        const sheetName = sheetMap[category];
        const sheet = workbook.getWorksheet(sheetName);

        if (sheet) {
            sheet.addRow({ ...data });
            await workbook.xlsx.writeFile(EXCEL_FILE);
            console.log(`[OK] Data saved to Excel sheet "${sheetName}"`);
            res.json({ success: true });
        } else {
            console.error(`[ERR] Sheet not found for: ${category}`);
            res.status(400).json({ error: 'Invalid category' });
        }
    } catch (error) {
        console.error('[CRIT] Save error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// GET endpoint to retrieve data
app.get('/api/data/:category', async (req, res) => {
    try {
        const { category } = req.params;
        const sqliteTabeMap = { 'PROFILE': 'Profiles', 'COMMUNITY': 'Community', 'BOOKINGS': 'Bookings', 'LOGS': 'Logs' };
        const tableName = sqliteTabeMap[category.toUpperCase()];

        if (!tableName) return res.status(404).json({ error: 'Table not found' });

        const rows = await db.all(`SELECT * FROM ${tableName}`);
        res.json(rows);
    } catch (error) {
        console.error('[ERR] Retrieval error:', error.message);
        res.status(500).json({ error: 'Failed to retrieve data' });
    }
});

app.listen(PORT, async () => {
    await initDB();
    await ensureExcel();
    console.log(`🚀 Local Data Server running at http://localhost:${PORT}`);
    console.log(`📁 SQLite DB: ${DB_FILE}`);
    console.log(`📁 Excel Backup: ${EXCEL_FILE}`);
});

