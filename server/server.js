import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Serve static files from the React app
app.use(express.static(join(__dirname, '../dist')));

// Database setup
const db = new sqlite3.Database('./timetracker.db', (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to the timetracker database.');
});

// Create tables
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS time_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER,
        type TEXT,
        timestamp DATETIME,
        latitude REAL,
        longitude REAL,
        note TEXT
    )`);
});

// Routes

// Get all time entries for an employee
app.get('/api/punches/:employeeId', (req, res) => {
    const { employeeId } = req.params;
    db.all(
        'SELECT * FROM time_entries WHERE employee_id = ? ORDER BY timestamp DESC',
        [employeeId],
        (err, rows) => {
            if (err) {
                res.status(400).json({ error: err.message });
                return;
            }
            res.json(rows);
        }
    );
});

// Create a new time entry
app.post('/api/punch', (req, res) => {
    const { employeeId, type, timestamp, latitude, longitude, note } = req.body;
    db.run(
        `INSERT INTO time_entries (employee_id, type, timestamp, latitude, longitude, note)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [employeeId, type, timestamp, latitude, longitude, note],
        function(err) {
            if (err) {
                res.status(400).json({ error: err.message });
                return;
            }
            res.json({
                id: this.lastID,
                message: "Time entry added successfully"
            });
        }
    );
});

// Get weekly summary for an employee
app.get('/api/weekly-summary/:employeeId', (req, res) => {
    const { employeeId } = req.params;
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    db.all(
        `SELECT * FROM time_entries 
         WHERE employee_id = ? AND timestamp >= ? 
         ORDER BY timestamp ASC`,
        [employeeId, oneWeekAgo],
        (err, rows) => {
            if (err) {
                res.status(400).json({ error: err.message });
                return;
            }

            let totalHours = 0;
            for (let i = 0; i < rows.length; i += 2) {
                if (i + 1 < rows.length) {
                    const start = new Date(rows[i].timestamp);
                    const end = new Date(rows[i + 1].timestamp);
                    totalHours += (end - start) / (1000 * 60 * 60);
                }
            }

            res.json({ totalHours: totalHours.toFixed(2) });
        }
    );
});

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '../dist/index.html'));
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});