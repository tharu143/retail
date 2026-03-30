import React, { useState } from 'react';
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
      const response = await fetch("/api/method/custom_retailpos.custom_retailpos.retail_api.retail.user_login", {
        method: "POST",
        headers: { "Accept": "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, usr: username, pwd: password }),
        credentials: "omit"
      });

      if (!response.ok) {
        // Fallback for offline mode or proxy unavailability
        if (!navigator.onLine || response.status >= 500) {
          const cachedUser = localStorage.getItem("user");
          if (cachedUser && username.trim().toLowerCase() === cachedUser.toLowerCase()) {
            const cachedSession = localStorage.getItem("session");
            const cachedProfile = localStorage.getItem("pos_profile");
            const cachedCompany = localStorage.getItem("company");
            const cachedWarehouse = localStorage.getItem("warehouse");
            const cachedBranch = localStorage.getItem("branch_prefix");

            dispatch(loginSuccess({
              user: cachedUser,
              session: cachedSession,
              pos_profile: cachedProfile,
              company: cachedCompany,
              warehouse: cachedWarehouse,
              branch_prefix: cachedBranch,
              is_manager: localStorage.getItem("is_manager") === "true",
              user_roles: JSON.parse(localStorage.getItem("user_roles") || "[]")
            }));

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
        try {
          err = await response.json();
        } catch (e) {
          throw new Error("Unable to connect to the server. Please check your internet.");
        }
        throw new Error(err.message || "Invalid credentials provided.");
      }

      const data = await response.json();
      const resp = data.message || data;

      let { user, session, pos_profile, company, warehouse, branch_prefix, active_pos_opening } = resp;

      // Check for Active Shift (Backend now returns this in login response, but we keep fallback for compatibility)
      let existingOpeningEntry = active_pos_opening || "";
      
      if (!existingOpeningEntry && session) {
        try {
          const openRes = await fetch(`/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_opening_entries?sid=${session}`, {
            headers: { "X-Frappe-SID": session },
            credentials: 'omit'
          });
          if (openRes.ok) {
            const openData = await openRes.json();
            const openEntry = openData.message?.data?.[0];
            if (openEntry && openEntry.status === "Open") {
              existingOpeningEntry = openEntry.name;
            }
          }
        } catch (ex) {
          console.warn("Shift check failed:", ex);
        }
      }

      // Store in Redux + localStorage
      dispatch(loginSuccess({
        user, session, pos_profile, company, warehouse, branch_prefix,
        is_manager: resp.is_manager,
        user_roles: resp.user_roles
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

      Swal.fire({
        icon: 'success',
        title: 'Welcome Back!',
        text: `Signed in as ${user}`,
        timer: 1500,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });

      // Navigate based on ROLE or Shift
      if (resp.is_manager) {
        navigate("/dashboard");
      } else {
        navigate("/homepage");
      }

    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo-container">
            <ShieldCheck size={32} />
          </div>
          <h1 className="login-title">POS8 Cloud</h1>
          <p className="login-subtitle">Sign in to manage your retail empire</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-form-group">
            <label className="login-label">Username</label>
            <div className="login-input-wrapper">
              <User className="login-input-icon" size={18} />
              <input
                type="text"
                className="login-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Manager or Cashier ID"
                required
              />
            </div>
          </div>

          <div className="login-form-group">
            <label className="login-label">Password</label>
            <div className="login-input-wrapper">
              <Lock className="login-input-icon" size={18} />
              <input
                type={showPassword ? "text" : "password"}
                className="login-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Secure Access Key"
                required
              />
              <button
                className="password-toggle"
                onClick={togglePasswordVisibility}
                type="button"
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button type="submit" className="login-submit-btn" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                Verifying...
              </>
            ) : (
              <>
                Login to Portal
                <ArrowRight size={18} />
              </>
            )}
          </button>

          {errorMessage && (
            <div className="login-error-message">
              {errorMessage}
            </div>
          )}
        </form>

        <div style={{ marginTop: '2.5rem', textAlign: 'center' }}>
          <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '500' }}>
            Powered by Kyle Solutions v8.2.1
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;