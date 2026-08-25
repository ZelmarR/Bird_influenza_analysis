import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Process from "./pages/Process";
import Analysis from "./pages/Analysis";
import Landing from "./pages/Landing";
import NavBar from "./components/NavBar";
import { isLoggedIn } from "./api";

function RequireAuth({ children }) {
  return isLoggedIn() ? children : <Navigate to="/login" replace />;
}

function AppLayout({ children }) {
  return (
    <RequireAuth>
      <NavBar />
      {children}
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
