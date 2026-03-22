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
    },
    logout: (state) => {
      state.user = null;
      state.session = null;
      state.posProfile = null;
      state.company = null;
      state.warehouse = null;
      state.branchPrefix = null;
      state.theme = 'modern';
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
      state.theme = state.theme === 'modern' ? 'legacy' : 'modern';
    },
  },
});

export const { loginSuccess, logout, setWarehouse, toggleTheme } = userSlice.actions;
export default userSlice.reducer;