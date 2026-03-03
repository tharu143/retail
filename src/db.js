import Dexie from 'dexie';

export const db = new Dexie('POSDatabase');

// Version 1: Original schema
db.version(1).stores({
    items: 'id, name, group, price, actual_qty',
    customers: 'name, customer_name, mobile_no',
    invoices: '++id, offline_id, customer, grand_total, is_synced, posting_date'
});

// Version 4: Production-Ready Sync & Stock Tracking
db.version(4).stores({
    items: 'id, name, group, price, actual_qty, local_qty',
    customers: 'name, customer_name, mobile_no, is_synced',
    invoices: '++id, offline_id, customer, grand_total, is_synced, posting_date, synced_at, server_name, retry_count, conflicts',
    tax_templates: 'name',
    payment_modes: 'name',
    sync_log: '++id, offline_id, action, timestamp, status, server_name'
}).upgrade(tx => {
    // Migrate items to have local_qty
    tx.table('items').toCollection().modify(item => {
        if (item.local_qty === undefined) item.local_qty = item.actual_qty || 0;
    });
    // Migrate customers to have is_synced
    tx.table('customers').toCollection().modify(cust => {
        if (cust.is_synced === undefined) cust.is_synced = 1; // Existing ones assumed synced
    });
});
