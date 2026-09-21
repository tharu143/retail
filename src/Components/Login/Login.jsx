import React, { useState } from 'react';
import kyleLogo from '../../assets/reatilkyle.png';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { loginSuccess } from '../../Redux/Slices/userSlice';
import Swal from 'sweetalert2';
import {
  User, Lock, Eye, EyeOff, Loader2, ArrowRight, Package, ShoppingCart, BarChart3, ShieldCheck, Check,
  Barcode, Scan, Receipt, Printer, Coins, Tag, Building2
} from 'lucide-react';
import './Login.css';
import packageJson from '../../../package.json';

const FRAPPE_BASE_URL = (import.meta.env.VITE_FRAPPE_URL || 'http://75.119.130.59:8089').replace(/\/$/, '');
const LOGIN_ENDPOINT = `${FRAPPE_BASE_URL}/api/method/custom_retailpos.custom_retailpos.retail_api.retail.user_login`;

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
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
      const response = await fetch(LOGIN_ENDPOINT, {
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
            const cachedRoles = JSON.parse(localStorage.getItem("user_roles") || "[]");
            if (cachedRoles.includes("Delivery Driver")) {
              navigate("/driver-dashboard");
            } else if (localStorage.getItem("is_manager") === "true") {
              navigate("/dashboard");
            } else {
              navigate("/homepage");
            }
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

      let { user, session, pos_profile, company, warehouse, branch_prefix } = resp;

      // Store in Redux + localStorage
      dispatch(loginSuccess({
        user, session, pos_profile, company, warehouse, branch_prefix,
        is_manager: resp.is_manager,
        user_roles: resp.user_roles
      }));
      localStorage.setItem("session", session || "");
      localStorage.setItem("user", user || "");
      localStorage.setItem("pos_profile", pos_profile || "");
      localStorage.setItem("company", company || "");
      localStorage.setItem("warehouse", (warehouse && warehouse !== "undefined" && warehouse !== "null") ? warehouse : "");
      localStorage.setItem("branch_prefix", branch_prefix || "");
      localStorage.setItem("is_manager", resp.is_manager || false);
      localStorage.setItem("user_roles", JSON.stringify(resp.user_roles || []));
      localStorage.setItem("posOpeningEntry", resp.active_pos_opening || "");

      Swal.fire({
        icon: 'success',
        title: 'Welcome Back!',
        text: `Signed in as ${user}`,
        timer: 1500,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });

      // Navigate based on ROLE
      if (resp.user_roles?.includes("Delivery Driver")) {
        navigate("/driver-dashboard");
      } else if (resp.is_manager) {
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
    <div className="enterprise-login-wrapper">
      {/* LEFT BRANDING SIDE (45%) */}
      <div className="branding-section">
        {/* Abstract waves & soft glowing circles */}
        <div className="floating-circle circle-1"></div>
        <div className="floating-circle circle-2"></div>
        <div className="abstract-wave wave-1"></div>
        <div className="abstract-wave wave-2"></div>
        <div className="grid-overlay"></div>

        <div className="branding-content">
          <div className="branding-logo-wrapper">
            <img src={kyleLogo} alt="Kyle Retail POS Logo" className="branding-logo-img floating-logo" />
          </div>

          <h1 className="branding-title">Kyle Retail POS</h1>
          <p className="branding-tagline">Smart Retail Management for Modern Businesses</p>

          {/* Feature Showcase Cards */}
          <div className="features-list">
            <div className="feature-card">
              <div className="feature-icon-box bg-sky-light">
                <Package size={22} color="#0ea5e9" />
              </div>
              <div className="feature-text">
                <h3>Smart Inventory & Stock</h3>
                <p>Live tracking across warehouses & auto reorder alerts</p>
              </div>
            </div>

            <div className="feature-card">
              <div className="feature-icon-box bg-blue-light">
                <ShoppingCart size={22} color="#2563eb" />
              </div>
              <div className="feature-text">
                <h3>High-Speed POS Checkout</h3>
                <p>Instant print job calculator, barcodes & split payments</p>
              </div>
            </div>

            <div className="feature-card">
              <div className="feature-icon-box bg-indigo-light">
                <BarChart3 size={22} color="#0284c7" />
              </div>
              <div className="feature-text">
                <h3>Analytics & Cashier Reports</h3>
                <p>Detailed daily sales metrics & shift closing entries</p>
              </div>
            </div>
          </div>

          <div className="branding-footer-badge">
            <ShieldCheck size={16} color="#0ea5e9" /> Secured with End-to-End Encryption & Audit Logging
          </div>
        </div>
      </div>

      {/* RIGHT LOGIN CARD SIDE (55%) */}
      <div className="form-section">
        {/* Ambient Floating POS Retail Background Icons */}
        <div className="pos-bg-icon icon-pos-1"><Barcode size={42} /></div>
        <div className="pos-bg-icon icon-pos-2"><Scan size={46} /></div>
        <div className="pos-bg-icon icon-pos-3"><Receipt size={40} /></div>
        <div className="pos-bg-icon icon-pos-4"><Printer size={44} /></div>
        <div className="pos-bg-icon icon-pos-5"><Coins size={38} /></div>
        <div className="pos-bg-icon icon-pos-6"><Tag size={36} /></div>
        <div className="pos-bg-icon icon-pos-7"><Building2 size={48} /></div>

        <div className="login-glass-card">
          <div className="card-top">
            <div className="card-logo-container">
              <img src={kyleLogo} alt="Kyle Retail POS Logo" className="card-logo-img" />
            </div>
            <div className="pos-terminal-badge">
              <span className="terminal-dot"></span>
              <span>NAJMA STATIONERY LLC • POS TERMINAL</span>
            </div>
            <h2 className="welcome-title">Welcome Back</h2>
            <p className="welcome-subtitle">Sign in to manage your retail business & POS cashier session.</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form-content">
            <div className="form-group">
              <label className="field-label">Username</label>
              <div className="input-field-box" style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
                <User size={18} className="input-icon" style={{ position: 'absolute', left: '1.1rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b', zIndex: 10, pointerEvents: 'none' }} />
                <input
                  type="text"
                  className="custom-input"
                  style={{ paddingLeft: '3.2rem', paddingRight: '1rem', width: '100%' }}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Manager / Cashier ID"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="field-label">Password</label>
              <div className="input-field-box" style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
                <Lock size={18} className="input-icon" style={{ position: 'absolute', left: '1.1rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b', zIndex: 10, pointerEvents: 'none' }} />
                <input
                  type={showPassword ? "text" : "password"}
                  className="custom-input"
                  style={{ paddingLeft: '3.2rem', paddingRight: '3.2rem', width: '100%' }}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Secure Access Key"
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={togglePasswordVisibility}
                  title={showPassword ? "Hide Password" : "Show Password"}
                  style={{ position: 'absolute', right: '0.9rem', top: '50%', transform: 'translateY(-50%)', zIndex: 10 }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="form-options">
              <label className="remember-checkbox-label">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="custom-checkbox"
                />
                <span>Remember Me</span>
              </label>

              <a
                href="#forgot"
                onClick={(e) => {
                  e.preventDefault();
                  Swal.fire({
                    title: 'Reset Password',
                    text: 'Please contact your System Administrator or Branch Manager to reset your access key.',
                    icon: 'info',
                    confirmButtonColor: '#0ea5e9'
                  });
                }}
                className="forgot-password-link"
              >
                Forgot Password?
              </a>
            </div>

            <button type="submit" className="login-primary-btn" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="spin-loader" size={20} />
                  <span>VERIFYING...</span>
                </>
              ) : (
                <>
                  <span>LOGIN TO DASHBOARD</span>
                  <ArrowRight size={20} className="btn-arrow-icon" />
                </>
              )}
            </button>

            {errorMessage && (
              <div className="error-banner">
                {errorMessage}
              </div>
            )}
          </form>

          <div className="card-footer-branding">
            <p className="powered-text">Powered by Kyle Solutions</p>
            <span className="version-badge">v{packageJson.version}</span>
          </div>

          <div className="copyright-text">
            © 2026 Kyle Solutions Pvt Ltd • All Rights Reserved
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
