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
            method: 'kyle_retail.retail_api.api.get_retail_item_details',
            args: args,
            type: 'GET'
        });
    },

    getSalesTaxes: async (args = {}) => {
        return await frappeCall({
            method: 'kyle_retail.retail_api.api.get_sales_taxes_details',
            args: args,
            type: 'GET'
        });
    },

    getDrivers: async () => {
        return await frappeCall({
            method: 'kyle_retail.retail_api.api.get_delivery_drivers',
            type: 'GET'
        });
    },

    getItemCategories: async (args = {}) => {
        return await frappeCall({
            method: 'kyle_retail.retail_api.api.get_item_categories',
            args: args,
            type: 'GET'
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
            method: 'kyle_retail.retail_api.api.get_suppliers_po',
            args: { query: '', ...args },
            type: 'GET'
        });
    },

    createSupplier: async (name) => {
        return await frappeCall({
            method: 'custom_retailpos.custom_retailpos.retail_api.retail.create_supplier',
            args: { supplier_name: name.trim(), supplier_type: "Company" }
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
            method: 'kyle_retail.retail_api.api.create_retail_invoice',
            args: { data: payload }
        });
    },

    verifySecretKey: async (secretKey) => {
        return await frappeCall({
            method: 'custom_retailpos.custom_retailpos.retail_api.retail.verify_cashier_secret_key',
            args: { secret_key: secretKey }
        });
    },

    verifyAuthorizationKey: async (secretKey, action, warehouse) => {
        return await frappeCall({
            method: 'kyle_retail.retail_api.api.verify_authorization_key',
            args: { secret_key: secretKey, action, warehouse }
        });
    },

    getLastOfflineId: async (prefix) => {
        return await frappeCall({
            method: 'kyle_retail.retail_api.api.get_last_offline_id_retail',
            args: { prefix },
            type: 'GET'
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
            method: 'kyle_retail.retail_api.api.submit_purchase_entry',
            args: payload
        });
    },

    findItemGlobal: async (searchTerm) => {
        return await frappeCall({
            method: 'kyle_retail.retail_api.api.find_item_global',
            args: { search_term: searchTerm }
        });
    },

    getPurchaseTaxTemplates: async () => {
        return await frappeCall({
            method: 'kyle_retail.retail_api.api.get_purchase_tax_templates',
            type: 'GET'
        });
    },

    getItemByBarcode: async (barcode) => {
        const res = await frappeCall({
            method: 'kyle_retail.retail_api.api.get_item_by_barcode_retail',
            args: { barcode },
            type: 'GET'
        });
        return Array.isArray(res) ? res[0] : res;
    },

    findItemGlobally: async (searchTerm) => {
        return await frappeCall({
            method: 'kyle_retail.retail_api.api.find_item_globally_retail',
            args: { search_term: searchTerm }
        });
    },

    enableItemForBranch: async (itemCode, warehouse) => {
        return await frappeCall({
            method: 'kyle_retail.retail_api.api.enable_item_for_branch_retail',
            args: { item_code: itemCode, warehouse: warehouse }
        });
    },

    getDraftInvoices: async (posProfile) => {
        return await frappeCall({
            method: 'kyle_retail.retail_api.api.get_draft_invoices',
            args: { pos_profile: posProfile },
            type: 'GET'
        });
    },

    getDraftInvoiceDetails: async (invoiceName) => {
        return await frappeCall({
            method: 'kyle_retail.retail_api.api.get_draft_invoice_details',
            args: { invoice_name: invoiceName },
            type: 'GET'
        });
    },

    deleteDraftInvoice: async (invoiceName) => {
        return await frappeCall({
            method: 'kyle_retail.retail_api.api.delete_draft_invoice',
            args: { invoice_name: invoiceName }
        });
    },

    getStockEntryDetails: async (name) => {
        return await frappeCall({
            method: 'custom_retailpos.custom_retailpos.retail_api.retail.get_stock_entry_details',
            args: { name: name },
            type: 'GET'
        });
    },

    getStockEntries: async (args = {}) => {
        return await frappeCall({
            method: 'custom_retailpos.custom_retailpos.retail_api.retail.get_stock_entries',
            args: args,
            type: 'GET'
        });
    },

    getDriverSalesInvoices: async (userId = null) => {
        return await frappeCall({
            method: 'kyle_retail.retail_api.api.get_driver_sales_invoices',
            args: { user_id: userId },
            type: 'GET'
        });
    },

    updateDeliveryStatus: async (invoiceName, status) => {
        return await frappeCall({
            method: 'kyle_retail.retail_api.api.update_delivery_status',
            args: { invoice_name: invoiceName, status }
        });
    }
};

export default POSService;

