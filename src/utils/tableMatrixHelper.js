// src/utils/tableMatrixHelper.js
import axios from 'axios';

/**
 * Loads table column configuration with instant LocalStorage fallback,
 * ensuring all system default columns exist in proper order.
 */
export const loadLocalMatrixConfig = (storageKey, defaultColumns) => {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const defaultMap = new Map(defaultColumns.map(c => [c.id, c]));
        const merged = [];

        // 1. Preserve saved user order, custom labels, widths, visibility, alignment
        parsed.forEach(savedCol => {
          if (defaultMap.has(savedCol.id)) {
            const def = defaultMap.get(savedCol.id);
            merged.push({
              ...def,
              ...savedCol,
              label: savedCol.label || def.label,
              width: savedCol.width || def.width,
              visible: savedCol.visible !== undefined ? savedCol.visible : def.visible,
              align: savedCol.align || def.align || 'left'
            });
            defaultMap.delete(savedCol.id);
          }
        });

        // 2. Append any new system columns that were not in user's saved config
        defaultMap.forEach(missingCol => {
          merged.push({ ...missingCol });
        });

        return merged;
      }
    }
  } catch (err) {
    console.warn(`[Matrix Config] Local read error for ${storageKey}:`, err);
  }
  return defaultColumns.map(c => ({ ...c }));
};

/**
 * Fetches user-specific table configuration from backend DB,
 * updates LocalStorage cache and returns the resolved column array.
 */
export const fetchUserMatrixConfig = async (storageKey, defaultColumns) => {
  try {
    const res = await axios.get('/api/method/kyle_retail.retail_api.api.get_user_table_config', {
      params: { key: storageKey },
      withCredentials: true
    });

    const backendConfig = res.data?.message?.config || res.data?.config;
    if (Array.isArray(backendConfig) && backendConfig.length > 0) {
      const defaultMap = new Map(defaultColumns.map(c => [c.id, c]));
      const merged = [];

      backendConfig.forEach(savedCol => {
        if (defaultMap.has(savedCol.id)) {
          const def = defaultMap.get(savedCol.id);
          merged.push({
            ...def,
            ...savedCol,
            label: savedCol.label || def.label,
            width: savedCol.width || def.width,
            visible: savedCol.visible !== undefined ? savedCol.visible : def.visible,
            align: savedCol.align || def.align || 'left'
          });
          defaultMap.delete(savedCol.id);
        }
      });

      defaultMap.forEach(missingCol => {
        merged.push({ ...missingCol });
      });

      localStorage.setItem(storageKey, JSON.stringify(merged));
      return merged;
    }
  } catch (err) {
    // Non-blocking fallback to local storage
  }
  return null;
};

/**
 * Saves updated table configuration to LocalStorage and syncs to backend per user.
 */
export const saveUserMatrixConfig = async (storageKey, config, defaultColumns = null) => {
  try {
    if (config === null && defaultColumns) {
      localStorage.removeItem(storageKey);
      await axios.post('/api/method/kyle_retail.retail_api.api.save_user_table_config', {
        key: storageKey,
        config: JSON.stringify(defaultColumns)
      }, { withCredentials: true }).catch(() => {});
      return defaultColumns;
    }

    if (Array.isArray(config)) {
      localStorage.setItem(storageKey, JSON.stringify(config));
      axios.post('/api/method/kyle_retail.retail_api.api.save_user_table_config', {
        key: storageKey,
        config: JSON.stringify(config)
      }, { withCredentials: true }).catch(err => {
        console.warn(`[Matrix Config] Backend save warning for ${storageKey}:`, err);
      });
      return config;
    }
  } catch (err) {
    console.warn(`[Matrix Config] Save error for ${storageKey}:`, err);
  }
  return config;
};

/**
 * Fetches user list view column configuration directly from backend API.
 */
export const fetchUserListConfig = async (doctype, defaultColumns = []) => {
  const actualKey = (doctype || '').replace(/\s+/g, '_');
  const storageKey = `list_config_${actualKey}`;
  const defaultKeys = defaultColumns.map(c => c.key || c.id);

  try {
    const res = await axios.get('/api/method/kyle_retail.retail_api.api.get_user_table_config', {
      params: { key: storageKey },
      withCredentials: true
    });
    const backendConfig = res.data?.message?.config || res.data?.config;
    if (backendConfig) {
      const parsed = typeof backendConfig === 'string' ? JSON.parse(backendConfig) : backendConfig;
      if (parsed && typeof parsed === 'object') {
        const hidden = Array.isArray(parsed.hiddenDefaults) ? parsed.hiddenDefaults : [];
        const custom = Array.isArray(parsed.customColumns) ? parsed.customColumns : [];
        let ordered = Array.isArray(parsed.orderedColumns) ? parsed.orderedColumns : [];
        if (ordered.length === 0) {
          ordered = [...defaultColumns.map(c => c.key || c.id).filter(k => !hidden.includes(k)), ...custom];
        }
        return {
          orderedColumns: ordered,
          hiddenDefaults: hidden,
          customColumns: custom
        };
      }
    }
  } catch (err) {
    console.warn(`[List Config API] Error fetching user config for ${storageKey}:`, err);
  }

  return {
    orderedColumns: defaultKeys,
    hiddenDefaults: [],
    customColumns: []
  };
};

/**
 * Saves list view column configuration directly to backend API per user in database.
 */
export const saveUserListConfig = async (doctype, config, defaultColumns = []) => {
  const actualKey = (doctype || '').replace(/\s+/g, '_');
  const storageKey = `list_config_${actualKey}`;
  const defOrdered = defaultColumns.map(c => c.key || c.id);

  try {
    if (config === null) {
      const resetConfig = { orderedColumns: defOrdered, hiddenDefaults: [], customColumns: [] };
      await axios.post('/api/method/kyle_retail.retail_api.api.save_user_table_config', {
        key: storageKey,
        config: JSON.stringify(resetConfig)
      }, { withCredentials: true });
      return resetConfig;
    }

    await axios.post('/api/method/kyle_retail.retail_api.api.save_user_table_config', {
      key: storageKey,
      config: JSON.stringify(config)
    }, { withCredentials: true });
    return config;
  } catch (err) {
    console.warn(`[List Config API] Error saving user config for ${storageKey}:`, err);
  }
  return config || { orderedColumns: defOrdered, hiddenDefaults: [], customColumns: [] };
};


