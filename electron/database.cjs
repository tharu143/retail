const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Ensure db directory exists
const dbPath = path.join(require('os').homedir(), '.retailpos', 'localpos.sqlite');
if (!fs.existsSync(path.dirname(dbPath))) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error("Database connection error: ", err.message);
    else console.log("Connected to local SQLite database at", dbPath);
});

// INITIALIZE TABLES
db.serialize(() => {
    // 1. ITEMS Cache
    db.run(`CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    name TEXT,
    group_name TEXT,
    price REAL,
    image TEXT,
    barcodes TEXT
  )`);

    // 2. USERS Cache (For Auth)
    db.run(`CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    email TEXT,
    password_hash TEXT,
    pos_profile TEXT,
    company TEXT
  )`);

    // 3. EMPLOYEES Cache (To map user -> company locally)
    db.run(`CREATE TABLE IF NOT EXISTS employees (
    employee_id TEXT PRIMARY KEY,
    user_id TEXT,
    employee_name TEXT,
    company TEXT
  )`);

    // 4. POS OPENING ENTRIES
    db.run(`CREATE TABLE IF NOT EXISTS pos_opening_entries (
    id TEXT PRIMARY KEY,
    user TEXT,
    company TEXT,
    pos_profile TEXT,
    period_start_date TEXT,
    status TEXT,
    is_synced INTEGER DEFAULT 1
  )`);

    // 5. POS CLOSING ENTRIES
    db.run(`CREATE TABLE IF NOT EXISTS pos_closing_entries (
    id TEXT PRIMARY KEY,
    pos_opening_entry TEXT,
    grand_total REAL,
    net_total REAL,
    period_end_date TEXT,
    is_synced INTEGER DEFAULT 0
  )`);

    // 6. POS INVOICES
    db.run(`CREATE TABLE IF NOT EXISTS pos_invoices (
    id TEXT PRIMARY KEY,
    customer TEXT,
    contact_mobile TEXT,
    company TEXT,
    pos_profile TEXT,
    pos_opening_entry TEXT,
    discount_amount REAL,
    tax_template TEXT,
    grand_total REAL,
    posting_date TEXT,
    is_synced INTEGER DEFAULT 0
  )`);

    // 7. POS INVOICE ITEMS
    db.run(`CREATE TABLE IF NOT EXISTS pos_invoice_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id TEXT,
    item_code TEXT,
    item_name TEXT,
    qty REAL,
    base_price REAL,
    FOREIGN KEY(invoice_id) REFERENCES pos_invoices(id)
  )`);

    // 8. POS PAYMENTS
    db.run(`CREATE TABLE IF NOT EXISTS pos_invoice_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id TEXT,
    mode_of_payment TEXT,
    amount REAL,
    FOREIGN KEY(invoice_id) REFERENCES pos_invoices(id)
  )`);
});

module.exports = {
    db,
    // Helper to fetch Items
    getItems: () => {
        return new Promise((resolve, reject) => {
            db.all("SELECT * FROM items", [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    },

    // Helper to save Offline Invoice
    saveInvoice: (invoiceData) => {
        return new Promise((resolve, reject) => {
            const invoiceId = `OFFLINE-INV-${Date.now()}`;
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');

                try {
                    db.run(
                        `INSERT INTO pos_invoices (id, customer, contact_mobile, company, pos_profile, pos_opening_entry, discount_amount, tax_template, grand_total, posting_date, is_synced) VALUES (?,?,?,?,?,?,?,?,?,?,0)`,
                        [invoiceId, invoiceData.customer, invoiceData.contact_mobile, invoiceData.company, invoiceData.pos_profile, invoiceData.pos_opening_entry, invoiceData.discount_amount, invoiceData.tax_template, invoiceData.grand_total, invoiceData.posting_date]
                    );

                    invoiceData.items.forEach(item => {
                        db.run(
                            `INSERT INTO pos_invoice_items (invoice_id, item_code, item_name, qty, base_price) VALUES (?,?,?,?,?)`,
                            [invoiceId, item.item_code, item.item_name, item.quantity, item.basePrice]
                        );
                    });

                    invoiceData.payments.forEach(payment => {
                        db.run(
                            `INSERT INTO pos_invoice_payments (invoice_id, mode_of_payment, amount) VALUES (?,?,?)`,
                            [invoiceId, payment.mode_of_payment, payment.amount]
                        );
                    });

                    db.run('COMMIT', (err) => {
                        if (err) throw err;
                        resolve({ success: true, invoiceId: invoiceId });
                    });
                } catch (e) {
                    db.run('ROLLBACK');
                    reject(e);
                }
            });
        });
    },

    syncLocalDatabase: async (syncPayload) => {
        // Sync Logic implementation down the line!
        return { status: 'success', message: 'Sync triggered' };
    }
};
