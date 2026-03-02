import { useEffect, useState } from "react";
import './NavBar.css';
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logout } from "../../Redux/Slices/userSlice";
import { persistor } from "../../Redux/store";
import { db } from "../../db";
import { RefreshCw, LayoutDashboard } from "lucide-react";

function NavBar() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.user.user);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    const countCheck = setInterval(async () => {
      const count = await db.invoices.where('is_synced').equals(0).count();
      setPendingCount(count);
    }, 5000);

    const handleStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);

    return () => {
      clearInterval(timer);
      clearInterval(countCheck);
      window.removeEventListener('online', handleStatus);
      window.removeEventListener('offline', handleStatus);
    };
  }, []);

  const handleLogout = async () => {
    try {
      if (!navigator.onLine) {
        // Offline local logout
        dispatch(logout());
        await persistor.purge();
        localStorage.clear();
        alert("Logged out locally (Offline Mode)");
        navigate("/");
        return;
      }

      const response = await fetch("/api/method/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (response.ok) {
        dispatch(logout());
        await persistor.purge();
        localStorage.clear();
        alert("Logout successful!");
        navigate("/");
      } else {
        alert("Logout failed from server, but clearing local session.");
        dispatch(logout());
        await persistor.purge();
        localStorage.clear();
        navigate("/");
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

          <div className="d-flex align-items-center gap-4 pe-3">
            {/* Connectivity Status */}
            <div className="d-flex align-items-center gap-2">
              <div
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: isOnline ? '#22c55e' : '#ef4444',
                  boxShadow: `0 0 8px ${isOnline ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`
                }}
              />
              <span style={{
                fontSize: '0.85rem',
                fontWeight: 700,
                color: isOnline ? '#15803d' : '#b91c1c',
                textTransform: 'uppercase'
              }}>
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>

            {/* Pending Sync Count */}
            {pendingCount > 0 && (
              <div
                onClick={() => navigate('/syncmanager')}
                style={{
                  cursor: 'pointer',
                  backgroundColor: '#eff6ff',
                  color: '#2563eb',
                  padding: '4px 10px',
                  borderRadius: '16px',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  border: '1px solid #bfdbfe'
                }}
              >
                <RefreshCw size={12} className="animate-spin" />
                {pendingCount} Pending
              </div>
            )}

            {/* Dashboard Link */}
            <LayoutDashboard
              className="cursor-pointer"
              style={{ fontSize: '1.4rem', color: '#64748b' }}
              onClick={() => navigate('/syncmanager')}
              title="Sync Manager"
            />

            {/* Logout */}
            <i className="bi bi-power cursor-pointer power" style={{ fontSize: '1.5rem', color: '#000' }}
              onClick={handleLogout} title="Logout"></i>

            {/* User Info */}
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