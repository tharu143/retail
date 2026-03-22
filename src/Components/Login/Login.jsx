import React, { useState, useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { loginSuccess } from '../../Redux/Slices/userSlice';
import Swal from 'sweetalert2';
import {
  User, Lock, Eye, EyeOff, Loader2, ArrowRight, ShieldCheck
} from 'lucide-react';
import './Login.css';

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const dispatch = useDispatch();

  const togglePasswordVisibility = (e) => {
    e.preventDefault();
    setShowPassword(!showPassword);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) return;

    setIsLoading(true);
    setErrorMessage("");

    try {
      // 1. Core Login Call (using the exact method and parameter names from stockDev1.0)
      const response = await fetch("/api/method/custom_retailpos.custom_retailpos.retail_api.retail.user_login", {
        method: "POST",
        headers: { "Accept": "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        credentials: window.location.protocol === 'file:' ? "include" : "omit"
      });

      if (!response.ok) {
        // Fallback for offline mode or 500 errors
        if (!navigator.onLine || response.status >= 500) {
          const cachedUser = localStorage.getItem("user");
          if (cachedUser && username.trim().toLowerCase() === cachedUser.toLowerCase()) {
            const cachedData = {
              user: cachedUser,
              session: localStorage.getItem("session"),
              pos_profile: localStorage.getItem("pos_profile"),
              company: localStorage.getItem("company"),
              warehouse: localStorage.getItem("warehouse"),
              branch_prefix: localStorage.getItem("branch_prefix")
            };

            dispatch(loginSuccess(cachedData));
            Swal.fire({
              icon: 'info',
              title: 'Offline Mode',
              text: 'Logged in using cached credentials.',
              timer: 3000,
              showConfirmButton: false
            });
            navigate("/homepage");
            return;
          }
        }

        let err;
        try { err = await response.json(); } catch (e) {
          throw new Error(`Server unreachable. Please check connection.`);
        }
        throw new Error(err.message || `Login failed (HTTP ${response.status})`);
      }

      const data = await response.json();
      const resp = data.message || data;

      let { user, session, pos_profile, company, warehouse, branch_prefix } = resp;

      // Force cookie for Electron
      if (window.location.protocol === 'file:') {
        document.cookie = `sid=${session}; path=/;`;
      }

      // 2. Fetch Employee for correct Company (Critical for stockDev1.0)
      try {
        const filters = encodeURIComponent(JSON.stringify([["user_id", "=", user]]));
        const fields = encodeURIComponent(JSON.stringify(["name", "company"]));
        const empRes = await fetch(`/api/resource/Employee?filters=${filters}&fields=${fields}&sid=${session}`, {
          headers: { "X-Frappe-SID": session },
          credentials: window.location.protocol === 'file:' ? "include" : "omit"
        });
        if (empRes.ok) {
          const empData = await empRes.json();
          if (empData.data?.[0]) {
            company = empData.data[0].company || company;
          }
        }
      } catch (ex) { console.warn("Employee fetch failed", ex); }

      // 3. Check for Open Shift
      let existingOpeningEntry = "";
      try {
        const openRes = await fetch(`/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_opening_entries?sid=${session}`, {
          headers: { "X-Frappe-SID": session },
          credentials: window.location.protocol === 'file:' ? "include" : "omit"
        });
        if (openRes.ok) {
          const openData = await openRes.json();
          const openEntry = openData.message?.data?.[0];
          if (openEntry?.status === "Open") {
            existingOpeningEntry = openEntry.name;
          }
        }
      } catch (ex) { console.warn("Shift check failed", ex); }

      // 4. Fetch Offline Seed Data
      try {
        const healthRes = await fetch(`/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_pos_health_data?sid=${session}`, {
          headers: { "X-Frappe-SID": session },
          credentials: window.location.protocol === 'file:' ? "include" : "omit"
        });
        if (healthRes.ok) {
          const healthData = await healthRes.json();
          const lastId = healthData.message?.last_offline_id;
          if (lastId?.includes('-OFF-')) {
            const parts = lastId.split('-');
            const lastSeq = parseInt(parts[parts.length - 1]);
            localStorage.setItem("offline_seq", lastSeq + 1);
          } else if (!localStorage.getItem("offline_seq")) {
            localStorage.setItem("offline_seq", "1");
          }
        }
      } catch (ex) { console.warn("Health data failed", ex); }

      // 5. Finalize Login and Store Roles
      dispatch(loginSuccess({
        user, session, pos_profile, company, warehouse, branch_prefix,
        is_manager: resp.is_manager,
        user_roles: resp.user_roles || []
      }));

      localStorage.setItem("session", session);
      localStorage.setItem("user", user);
      localStorage.setItem("pos_profile", pos_profile);
      localStorage.setItem("company", company);
      localStorage.setItem("warehouse", warehouse);
      localStorage.setItem("branch_prefix", branch_prefix);
      localStorage.setItem("is_manager", resp.is_manager || false);
      localStorage.setItem("user_roles", JSON.stringify(resp.user_roles || []));
      localStorage.setItem("posOpeningEntry", existingOpeningEntry);

      if (window.electronAPI?.setSession) {
        window.electronAPI.setSession(session);
      }

      await Swal.fire({
        icon: 'success',
        title: 'Login Successful',
        text: `Welcome, ${user}`,
        timer: 1500,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });

      navigate("/homepage");

    } catch (err) {
      setErrorMessage(err.message);
      Swal.fire({
        icon: 'error',
        title: 'Login Failed',
        text: err.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo-container">
            <ShieldCheck size={32} strokeWidth={2.5} />
          </div>
          <h1 className="login-title">Welcome Back</h1>
          <p className="login-subtitle">Sign in to your retail dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-form-group">
            <label className="login-label">Username / Email</label>
            <div className="login-input-wrapper">
              <User className="login-input-icon" size={20} />
              <input
                type="text"
                placeholder="Enter your username"
                className="login-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="login-form-group">
            <label className="login-label">Password</label>
            <div className="login-input-wrapper">
              <Lock className="login-input-icon" size={20} />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                className="login-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                className="login-password-toggle"
                onClick={togglePasswordVisibility}
                type="button"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="login-error-message">
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            className="login-submit-btn"
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight size={20} />
              </>
            )}
          </button>
        </form>

        <div className="login-footer">
          <p>© 2024 Kyle Solutions Private Limited</p>
          <p className="login-version">Retail POS v1.0.5</p>
        </div>
      </div>
    </div>
  );
}

export default Login;
