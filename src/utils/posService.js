import { frappeCall } from './frappe';
import { v4 as uuidv4 } from 'uuid';

/**
 * POS Service for Frappe/ERPNext
 * strictly follows the retail POS rules.
 */
const POSService = {
    // 1. AUTH & SESSION
    login: async (username, password) => {
        return await frappeCall({
            method: 'custom_retailpos.custom_retailpos.retail_api.retail.user_login',
            args: { usr: username, pwd: password }
        });
    },

    createOpeningEntry: async (payload) => {
        return await frappeCall({
            method: 'custom_retailpos.custom_retailpos.retail_api.retail.create_opening_entry',
            args: payload
        });
    },

    // 2. MASTER CATALOG
    getRetailItems: async (args = {}) => {
        return await frappeCall({
            method: 'custom_retailpos.custom_retailpos.retail_api.retail.get_retail_item_details',
            args: args
        });
    },

    getSalesTaxes: async (args = {}) => {
        return await frappeCall({
            method: 'custom_retailpos.custom_retailpos.retail_api.retail.get_sales_taxes_details',
            args: args
        });
    },

    getItemCategories: async (args = {}) => {
        return await frappeCall({
            method: 'custom_retailpos.custom_retailpos.retail_api.retail.get_item_categories',
            args: args
        });
    },

    getWarehouses: async (args = {}) => {
        return await frappeCall({
            method: 'custom_retailpos.custom_retailpos.retail_api.retail.get_warehouses',
            args: { is_group: 0, ...args },
            type: 'GET'
        });
    },

    getItemPricingHistory: async (itemCode) => {
        return await frappeCall({
            method: 'custom_retailpos.custom_retailpos.retail_api.retail.get_po_history',
            args: { item_codes_json: JSON.stringify([itemCode]) },
            type: 'GET'
        });
    },

    getSuppliers: async (args = {}) => {
        return await frappeCall({
            method: 'custom_retailpos.custom_retailpos.retail_api.retail.get_suppliers_po',
            args: { query: '', ...args },
            type: 'GET'
        });
    },

    // 3. CHECKOUT & DUPLICATE SAFETY
    createInvoice: async (payload) => {
        if (!payload.customer || payload.customer.trim() === '') {
            payload.customer = 'Cash'; // The backend patch handles Cash correctly now
        }

        // Ensure unique offline_id for duplicate safety
        if (!payload.offline_id) {
            payload.offline_id = uuidv4();
        }

        return await frappeCall({
            method: 'custom_retailpos.custom_retailpos.retail_api.retail.create_retail_invoice',
            args: { data: payload }
        });
    },

    // 4. OFFLINE SYNC (Bulk)
    bulkSyncInvoices: async (invoices) => {
        // Ensure customer exists, default to Cash for walk-ins
        const normalizedInvoices = invoices.map(inv => ({
            ...inv,
            customer: (!inv.customer || inv.customer.trim() === '')
                ? 'Cash'
                : inv.customer
        }));

        return await frappeCall({
            method: 'custom_retailpos.custom_retailpos.retail_api.retail.bulk_sync_invoices',
            args: { invoices: normalizedInvoices }
        });
    },

    // 5. MANAGER TOOLS
    submitPurchaseEntry: async (payload) => {
        return await frappeCall({
            method: 'custom_retailpos.custom_retailpos.retail_api.retail.submit_purchase_entry',
            args: payload
        });
    },

    findItemGlobal: async (searchTerm) => {
        return await frappeCall({
            method: 'custom_retailpos.custom_retailpos.retail_api.retail.find_item_global',
            args: { search_term: searchTerm }
        });
    },

    getPurchaseTaxTemplates: async () => {
        return await frappeCall({
            method: 'custom_retailpos.custom_retailpos.retail_api.retail.get_purchase_tax_templates',
            type: 'GET'
        });
    }
};

export default POSService;
