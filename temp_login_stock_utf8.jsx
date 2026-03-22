import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { loginSuccess } from '../../Redux/Slices/userSlice';
import Swal from 'sweetalert2';

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/method/custom_retailpos.custom_retailpos.retail_api.retail.user_login", {
        method: "POST",
        headers: { "Accept": "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        credentials: window.location.protocol === 'file:' ? "include" : "omit"
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
            const cachedOpening = localStorage.getItem("posOpeningEntry");

            dispatch(loginSuccess({
              user: cachedUser,
              session: cachedSession,
              pos_profile: cachedProfile,
              company: cachedCompany,
              warehouse: cachedWarehouse,
              branch_prefix: cachedBranch
            }));

            Swal.fire({
              icon: 'info',
              title: 'Offline Mode',
              text: 'Logged in using cached credentials.',
              timer: 3000,
              showConfirmButton: false
            });
            navigate("/homepage");
            setIsLoading(false);
            return;
          }
        }

        // Parse actual error if not bypassed offline
        let err;
        try {
          err = await response.json();
        } catch (e) {
          throw new Error(`Our server is unreachable offline. Please connect to internet or use your exact previously logged-in username.`);
        }
        throw new Error(err.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const resp = data.message || data;

      let { user, session, pos_profile, company, warehouse, branch_prefix } = resp;

      // Force cookie onto browser immediately for Electron (context isolation bypass)
      if (window.location.protocol === 'file:') {
        document.cookie = `sid=${session}; path=/;`;
      }

      // === FETCH EMPLOYEE TO GET CORRECT COMPANY ===
      try {
        const filters = encodeURIComponent(JSON.stringify([["user_id", "=", user]]));
        const fields = encodeURIComponent(JSON.stringify(["name", "company"]));
        const empRes = await fetch(`/api/resource/Employee?filters=${filters}&fields=${fields}&sid=${session}`, {
          headers: { "X-Frappe-SID": session },
          credentials: window.location.protocol === 'file:' ? "include" : "omit"
        });
        if (empRes.ok) {
          const empData = await empRes.json();
          if (empData.data && empData.data.length > 0) {
            company = empData.data[0].company || company;
          }
        }
      } catch (ex) {
        console.warn("Failed to fetch employee company:", ex);
      }

      // === CHECK FOR OPEN SHIFT ===
      let existingOpeningEntry = "";
      try {
        const openRes = await fetch(`/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_opening_entries?sid=${session}`, {
          headers: { "X-Frappe-SID": session },
          credentials: window.location.protocol === 'file:' ? "include" : "omit"
        });
        if (openRes.ok) {
          const openData = await openRes.json();
          const openEntry = openData.message?.data?.[0];
          if (openEntry && openEntry.status === "Open") {
            existingOpeningEntry = openEntry.name;
          }
        }
      } catch (ex) {
        console.warn("Failed to check open shift:", ex);
      }

      // === FETCH OFFLINE SEED (SMART ID) ===
      try {
        const healthRes = await fetch(`/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_pos_health_data?sid=${session}`, {
          headers: { "X-Frappe-SID": session },
          credentials: window.location.protocol === 'file:' ? "include" : "omit"
        });
        if (healthRes.ok) {
          const healthData = await healthRes.ok ? await healthRes.json() : {};
          const lastId = healthData.message?.last_offline_id;
          if (lastId && lastId.includes('-OFF-')) {
            const parts = lastId.split('-');
            const lastSeq = parseInt(parts[parts.length - 1]);
            localStorage.setItem("offline_seq", lastSeq + 1);
          } else {
            // Check if we already have a local sequence, if not, start at 1
            if (!localStorage.getItem("offline_seq")) {
              localStorage.setItem("offline_seq", "1");
            }
          }
        }
      } catch (ex) {
        console.warn("Failed to fetch offline seed:", ex);
      }

      // Store in Redux + localStorage
      dispatch(loginSuccess({ user, session, pos_profile, company, warehouse, branch_prefix }));
      localStorage.setItem("session", session);
      if (window.electronAPI?.setSession) {
        window.electronAPI.setSession(session);
      }

      // We no longer need the CSRF/Security cookie ping for Web because we use omit credentials

      localStorage.setItem("user", user);
      localStorage.setItem("pos_profile", pos_profile);
      localStorage.setItem("company", company);
      localStorage.setItem("warehouse", warehouse);
      localStorage.setItem("branch_prefix", branch_prefix);
      localStorage.setItem("posOpeningEntry", existingOpeningEntry); // ΓåÉ Only if exists

      Swal.fire({
        icon: 'success',
        title: 'Login Successful',
        text: 'Welcome to Retail POS',
        timer: 1500,
        showConfirmButton: false
      });

      // === NAVIGATE BASED ON SHIFT ===
      if (existingOpeningEntry) {
        localStorage.setItem("posOpeningEntry", existingOpeningEntry);
        Swal.fire({
          icon: 'info',
          title: 'Active Shift',
          text: 'Your previous shift is still open. Resuming session.',
          timer: 2500,
          showConfirmButton: false
        });
        navigate("/homepage");
      } else {
        navigate("/homepage"); // ΓåÉ Home will show modal
      }

    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.loginBox}>
        <h1 style={styles.title}>Login</h1>
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formGroup}>
            <label style={styles.label} htmlFor="username">Username or Email</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username or email"
              style={styles.input}
              required
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label} htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              style={styles.input}
              required
            />
          </div>
          <button type="submit" style={styles.button} disabled={isLoading}>
            {isLoading ? "Logging in..." : "Login"}
          </button>
          {errorMessage && <div style={styles.errorMessage}>{errorMessage}</div>}
        </form>
      </div>
    </div>
  );
}

const styles = {
  container: { display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", backgroundColor: "#f4f4f9" },
  loginBox: { backgroundColor: "#fff", padding: "20px", borderRadius: "8px", boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)", width: "100%", maxWidth: "400px" },
  title: { fontSize: "1.5em", marginBottom: "20px", color: "#333", textAlign: "center" },
  form: { display: "flex", flexDirection: "column" },
  formGroup: { marginBottom: "15px" },
  label: { fontSize: "14px", marginBottom: "5px", color: "#555" },
  input: { width: "100%", padding: "10px", fontSize: "14px", border: "1px solid #ccc", borderRadius: "5px", outline: "none" },
  button: { width: "100%", padding: "10px", backgroundColor: "#007bff", border: "none", color: "white", fontSize: "16px", borderRadius: "5px", cursor: "pointer" },
  errorMessage: { marginTop: "10px", color: "red", fontSize: "14px", textAlign: "center" },
};

export default Login;

