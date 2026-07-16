import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { loginSuccess } from '../../Redux/Slices/userSlice';

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
      const response = await fetch("http://75.119.130.59/api/method/custom_retailpos.custom_retailpos.retail_api.retail.user_login", {
        method: "POST",
        headers: { "Accept": "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        credentials: "include"
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const resp = data.message || data;

      let { user, session, pos_profile, company } = resp;

      // === FETCH EMPLOYEE TO GET CORRECT COMPANY ===
      try {
        const filters = encodeURIComponent(JSON.stringify([["user_id", "=", user]]));
        const fields = encodeURIComponent(JSON.stringify(["name", "company"]));
        const empRes = await fetch(`http://75.119.130.59/api/resource/Employee?filters=${filters}&fields=${fields}`, {
          headers: { "X-Frappe-SID": session },
          credentials: "include"
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
        const openRes = await fetch("http://75.119.130.59/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_opening_entries", {
          headers: { "X-Frappe-SID": session },
          credentials: "include"
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

      // Store in Redux + localStorage
      dispatch(loginSuccess({ user, session, pos_profile, company }));
      localStorage.setItem("session", session);
      localStorage.setItem("user", user);
      localStorage.setItem("pos_profile", pos_profile);
      localStorage.setItem("company", company);
      localStorage.setItem("posOpeningEntry", existingOpeningEntry); // ??? Only if exists

      alert("Login Successful!");

      // === NAVIGATE BASED ON SHIFT ===
      if (existingOpeningEntry) {
        localStorage.setItem("posOpeningEntry", existingOpeningEntry);
        alert("Welcome back! Your shift is still open.");
        navigate("/homepage");
      } else {
        navigate("/homepage"); // ??? Home will show modal
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
