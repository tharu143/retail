import Dexie from 'dexie';

export const db = new Dexie('POSDatabase');

// Version 1: Original schema
db.version(1).stores({
    items: 'id, name, group, price, actual_qty',
    customers: 'name, customer_name, mobile_no',
    invoices: '++id, offline_id, customer, grand_total, is_synced, posting_date'
});

// Version 2: Enhanced offline-first schema
db.version(2).stores({
    items: 'id, name, group, price, actual_qty',
    customers: 'name, customer_name, mobile_no',
    invoices: '++id, offline_id, customer, grand_total, is_synced, posting_date, synced_at, server_name',
    tax_templates: 'name',
    payment_modes: 'name',
    sync_log: '++id, offline_id, action, timestamp, status, server_name'
}).upgrade(tx => {
    // Migrate existing invoices to have new fields
    return tx.table('invoices').toCollection().modify(inv => {
        if (!inv.synced_at) inv.synced_at = null;
        if (!inv.server_name) inv.server_name = null;
    });
});
