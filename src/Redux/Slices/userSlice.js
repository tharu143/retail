import { createSlice } from '@reduxjs/toolkit';

const userSlice = createSlice({
  name: 'user',
  initialState: {
    user: null,
    session: null,
    posProfile: null,
    company: null,
    warehouse: null,
    branchPrefix: null,
    is_manager: false,
    user_roles: [],
    theme: 'modern', // 'modern' or 'legacy'
    secret_key: '1234', // Default cashier secret key
    notifications: [], // Store inter-branch notifications
    message: {
      allowed_item_groups: [],
      allowed_customer_groups: [],
      filtered_items: [],
      filtered_customers: [],
    },
  },
  reducers: {
    loginSuccess: (state, action) => {
      state.user = action.payload.user;
      state.session = action.payload.session;
      state.posProfile = action.payload.pos_profile;
      state.company = action.payload.company;
      state.warehouse = action.payload.warehouse;
      state.branchPrefix = action.payload.branch_prefix;
      state.is_manager = action.payload.is_manager || false;
      state.user_roles = action.payload.user_roles || [];
      state.message = action.payload.message;
      state.secret_key = action.payload.secret_key || action.payload.user?.custom_secret_key || '1234';
      state.notifications = [];
    },
    logout: (state) => {
      state.user = null;
      state.session = null;
      state.posProfile = null;
      state.company = null;
      state.warehouse = null;
      state.branchPrefix = null;
      state.theme = 'modern';
      state.secret_key = '1234';
      state.notifications = [];
      state.message = {
        allowed_item_groups: [],
        allowed_customer_groups: [],
        filtered_items: [],
        filtered_customers: [],
      };
    },
    setWarehouse: (state, action) => {
      state.warehouse = action.payload;
    },
    toggleTheme: (state) => {
      if (state.theme === 'modern') {
        state.theme = 'modern_no_image';
      } else if (state.theme === 'modern_no_image') {
        state.theme = 'legacy';
      } else {
        state.theme = 'modern';
      }
    },
    setTheme: (state, action) => {
      state.theme = action.payload;
    },
    setSecretKey: (state, action) => {
      state.secret_key = action.payload;
    },
    setNotifications: (state, action) => {
      state.notifications = action.payload;
    },
    addNotification: (state, action) => {
      const exists = state.notifications.some(n => n.name === action.payload.name);
      if (!exists) {
        state.notifications = [action.payload, ...state.notifications];
      }
    },
    markRead: (state, action) => {
      state.notifications = state.notifications.map(n =>
        n.name === action.payload ? { ...n, read: 1 } : n
      );
    },
    markAllRead: (state) => {
      state.notifications = state.notifications.map(n => ({ ...n, read: 1 }));
    },
  },
});

export const {
  loginSuccess,
  logout,
  setWarehouse,
  toggleTheme,
  setTheme,
  setSecretKey,
  setNotifications,
  addNotification,
  markRead,
  markAllRead
} = userSlice.actions;
export default userSlice.reducer;