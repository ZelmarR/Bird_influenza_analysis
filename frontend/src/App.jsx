import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Process from "./pages/Process";
import Analysis from "./pages/Analysis";
import NavBar from "./components/NavBar";
import { isLoggedIn } from "./api";

function RequireAuth({ children }) {
  return isLoggedIn() ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/app/process"
          element={
            <RequireAuth>
              <NavBar />
              <Process />
            </RequireAuth>
          }
        />
        <Route
          path="/app/analysis"
          element={
            <RequireAuth>
              <NavBar />
              <Analysis />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/app/process" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
