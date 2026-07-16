import axios from 'axios';

/**
 * frappeCall mimics the standard ERPNext frappe.call for the React POS.
 * It uses the global axios configuration from main.jsx which already handles
 * Base URL, X-Frappe-SID, and CSRF bypass.
 */
export const frappeCall = async ({ method, args = {}, type = 'POST' }) => {
    try {
        const url = `/api/method/${method}`;
        const config = {
            method: type,
            url,
        };

        if (type === 'POST') {
            config.data = args;
        } else {
            config.params = args;
        }

        const response = await axios(config);
        
        // Handle standard Frappe response format
        if (response.data && response.data.hasOwnProperty('message')) {
            return response.data.message;
        }
        
        return response.data;
    } catch (error) {
        console.error(`frappe.call error: ${method}`, error);
        throw error.response?.data?.message || error.message || "Unknown error";
    }
};
