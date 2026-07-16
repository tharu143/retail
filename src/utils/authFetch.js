import { useCallback } from 'react';

/**
 * Basic fetch wrapper for Frappe/ERPNext specific authenticated calls.
 * This is a minimal version for use in background tasks and components.
 */
export const authFetchBase = async (url, options = {}) => {
    const fullUrl = url.startsWith('http') ? url : `/api/method/${url.startsWith('/') ? url.slice(1) : url}`;

    const headers = {
        ...options.headers,
        "Accept": "application/json",
    };

    const config = { ...options, headers, credentials: 'include' };

    try {
        const response = await fetch(fullUrl, config);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `HTTP ${response.status}`);
        }
        return response;
    } catch (err) {
        throw err;
    }
};
