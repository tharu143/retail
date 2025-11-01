import { createSlice } from '@reduxjs/toolkit';

const userSlice = createSlice({
  name: 'user',
  initialState: {
    user: null,
    session: null,
    posProfile: null,
    company: null,
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
      state.message = action.payload.message;
    },
    logout: (state) => {
      state.user = null;
      state.session = null;
      state.posProfile = null;
      state.company = null;
      state.message = {
        allowed_item_groups: [],
        allowed_customer_groups: [],
        filtered_items: [],
        filtered_customers: [],
      };
    },
  },
});

export const { loginSuccess, logout } = userSlice.actions;
export default userSlice.reducer;