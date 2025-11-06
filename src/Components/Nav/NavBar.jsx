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
      const response = await fetch("/api/method/custom_retailpos.custom_retailpos.retail_api.retail.user_logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      const result = await response.json();
      const logoutData = result.message || result;

      if (response.ok && logoutData.status === "success") {
        dispatch(logout());
        await persistor.purge();
        localStorage.clear();
        alert("Logout successful!");
        navigate("/");
      } else {
        alert(`Logout failed: ${logoutData.message || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Logout error:", error);
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
          <div onClick={() => navigate('/homepage')} className="cursor-pointer">
            <h1 style={{
              color: '#21a9ff',
              textShadow: '2px 2px 4px #c0c0c0ff',
              fontSize: '2.5rem',
              textAlign: 'center',
              margin: '20px 0',
              letterSpacing: '1px',
              animation: 'fadeIn 1s ease-in-out',
              fontFamily: 'Carla Sans'
            }}>Retail POS</h1>
          </div>

          <div className="d-flex align-items-center gap-3 pe-3">
            {/* Invoice List Icon */}
            <i
              className="bi bi-receipt cursor-pointer"
              style={{ fontSize: '1.5rem', color: '#21a9ff' }}
              onClick={() => navigate('/invoicelist')}
              title="Invoice List"
            ></i>

            {/* Logout Icon */}
            <i
              className="bi bi-power cursor-pointer power"
              style={{ fontSize: '1.5rem', color: 'black' }}
              onClick={handleLogout}
              title="Logout"
            ></i>

            <div className="text-end">
              <span className="text-black mb-0 d-block">{user || "Guest"}</span>
              <small className="d-block text-muted">{formattedDate}</small>
              <small className="d-block text-muted">{formattedTime}</small>
            </div>
          </div>
        </div>
      </nav>
    </div>
  );
}

export default NavBar;