import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useState, useEffect, createContext, useCallback } from "react";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Process from "./pages/Process";
import Analysis from "./pages/Analysis";
import Landing from "./pages/Landing";
import NavBar from "./components/NavBar";
import { isLoggedIn, verifySession, logout, fetchLocations } from "./api";

export const LocationsContext = createContext({ locations: [], reload: () => {} });

function RequireAuth({ children }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoggedIn()) {
      navigate("/login", { replace: true });
      return;
    }
    // Verify in background; only evict on explicit 401, not on network errors
    verifySession().then((ok) => {
      if (!ok) {
        logout();
        navigate("/login", { replace: true });
      }
    });
  }, [navigate]);

  // Render immediately if a token exists — avoids blank flash and race conditions
  return isLoggedIn() ? children : <Navigate to="/login" replace />;
}

function AppLayout({ children }) {
  const [locations, setLocations] = useState([]);

  const reload = useCallback(() => {
    fetchLocations().then(setLocations).catch(() => {});
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return (
    <RequireAuth>
      <LocationsContext.Provider value={{ locations, reload }}>
        <NavBar />
        {children}
      </LocationsContext.Provider>
    </RequireAuth>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={isLoggedIn() ? <Navigate to="/app/home" replace /> : <Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/app/home" element={<AppLayout><Home /></AppLayout>} />
        <Route path="/app/process" element={<AppLayout><Process /></AppLayout>} />
        <Route path="/app/analysis" element={<AppLayout><Analysis /></AppLayout>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
