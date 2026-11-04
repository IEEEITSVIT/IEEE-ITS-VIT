import ExcelJS from 'exceljs';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXCEL_FILE = path.join(__dirname, 'IEEE_ITS_DATABASE.xlsx');
const DB_FILE = path.join(__dirname, 'ieeeits.db');

async function migrate() {
    const workbook = new ExcelJS.Workbook();
    try {
        await workbook.xlsx.readFile(EXCEL_FILE);
    } catch (err) {
        console.error("Could not read Excel file:", err.message);
        return;
    }

    const db = await open({
        filename: DB_FILE,
        driver: sqlite3.Database
    });

    console.log("Creating tables...");

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

    // Migrate Profiles
    console.log("Migrating Profiles...");
    const profilesSheet = workbook.getWorksheet('Profiles');
    if (profilesSheet) {
        for (let i = 2; i <= profilesSheet.rowCount; i++) {
            const row = profilesSheet.getRow(i);
            const data = {
                date: row.getCell(1).value?.toString() || '',
                time: row.getCell(2).value?.toString() || '',
                name: row.getCell(3).value?.toString() || '',
                email: row.getCell(4).value?.toString() || '',
                mobile: row.getCell(5).value?.toString() || '',
                regNo: row.getCell(6).value?.toString() || '',
                memberType: row.getCell(7).value?.toString() || ''
            };
            if (data.email) {
                await db.run(
                    'INSERT INTO Profiles (date, time, name, email, mobile, regNo, memberType) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [data.date, data.time, data.name, data.email, data.mobile, data.regNo, data.memberType]
                );
            }
        }
    }

    // Migrate Community
    console.log("Migrating Community...");
    const communitySheet = workbook.getWorksheet('Community');
    if (communitySheet) {
        for (let i = 2; i <= communitySheet.rowCount; i++) {
            const row = communitySheet.getRow(i);
            const data = {
                date: row.getCell(1).value?.toString() || '',
                time: row.getCell(2).value?.toString() || '',
                email: row.getCell(3).value?.toString() || '',
                type: row.getCell(4).value?.toString() || '',
                message: row.getCell(5).value?.toString() || ''
            };
            if (data.email) {
                await db.run(
                    'INSERT INTO Community (date, time, email, type, message) VALUES (?, ?, ?, ?, ?)',
                    [data.date, data.time, data.email, data.type, data.message]
                );
            }
        }
    }

    // Migrate Bookings
    console.log("Migrating Bookings...");
    const bookingsSheet = workbook.getWorksheet('Bookings');
    if (bookingsSheet) {
        for (let i = 2; i <= bookingsSheet.rowCount; i++) {
            const row = bookingsSheet.getRow(i);
            const data = {
                date: row.getCell(1).value?.toString() || '',
                time: row.getCell(2).value?.toString() || '',
                name: row.getCell(3).value?.toString() || '',
                email: row.getCell(4).value?.toString() || '',
                item: row.getCell(5).value?.toString() || '',
                size: row.getCell(6).value?.toString() || '',
                qty: row.getCell(7).value,
                price: row.getCell(8).value,
                total: row.getCell(9).value
            };
            if (data.email) {
                await db.run(
                    'INSERT INTO Bookings (date, time, name, email, item, size, qty, price, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [data.date, data.time, data.name, data.email, data.item, data.size, data.qty, data.price, data.total]
                );
            }
        }
    }

    // Migrate Logs
    console.log("Migrating Logs...");
    const logsSheet = workbook.getWorksheet('Logs');
    if (logsSheet) {
        for (let i = 2; i <= logsSheet.rowCount; i++) {
            const row = logsSheet.getRow(i);
            const data = {
                date: row.getCell(1).value?.toString() || '',
                time: row.getCell(2).value?.toString() || '',
                email: row.getCell(3).value?.toString() || '',
                name: row.getCell(4).value?.toString() || '',
                type: row.getCell(5).value?.toString() || ''
            };
            if (data.email) {
                await db.run(
                    'INSERT INTO Logs (date, time, email, name, type) VALUES (?, ?, ?, ?, ?)',
                    [data.date, data.time, data.email, data.name, data.type]
                );
            }
        }
    }

    console.log("Migration finished successfully!");
    await db.close();
}

migrate();
