import { useEffect, useState } from "react";
import './NavBar.css';
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logout } from "../../Redux/Slices/userSlice";
import { persistor } from "../../Redux/store";

function NavBar() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.user.user);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = async () => {
    try {
      // Use relative URL + credentials for cookie-based logout
      const response = await fetch("/api/method/custom_retailpos.custom_retailpos.retail_api.retail.user_logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",  // Sends sid cookie
      });

      const result = await response.json();
      const logoutData = result.message || result;

      if (response.ok && logoutData.status === "success") {
        dispatch(logout());
        await persistor.purge();
        localStorage.clear();  // Clear localStorage session too
        alert("Logout successful!");
        navigate("/");
      } else {
        alert(`Logout failed: ${logoutData.message || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Logout error:", error);
      // Force clear on error
      dispatch(logout());
      await persistor.purge();
      localStorage.clear();
      navigate("/");
    }
  };

  const formattedDate = currentTime.toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' });
  const formattedTime = currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div>
      <nav className="navbar navbar-expand-lg nav-div">
        <div className="container-fluid justify-content-between">
          <div>
            <h1 style={{
              color: '21a9ff',
              textShadow: '2px 2px 4px #c0c0c0ff',
              fontSize: '2.5rem',
              textAlign: 'center',
              margin: '20px 0',
              letterSpacing: '1px',
              animation: 'fadeIn 1s ease-in-out',
              fontFamily: 'Carla Sans'
            }}>Retail POS</h1>
          </div>
          <div className="user-info ms-auto pe-3">
            <div className="d-flex align-items-center">
              <i className="bi bi-power Logout-nav-link cursor-pointer power" style={{ width: "50px", fill: "black" }} onClick={handleLogout} title="Logout"></i>
              <span className="ms-2 text-black mb-0">{user || "Guest"}</span>
            </div>
            <small className="d-block text-muted text-end mt-1">{formattedDate}</small>
            <small className="d-block text-muted text-end">{formattedTime}</small>
          </div>
        </div>
      </nav>
    </div>
  );
}

export default NavBar;