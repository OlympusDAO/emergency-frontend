import { Routes, Route, Navigate } from "react-router-dom";
import EmergencyShutdown from "@/views/EmergencyShutdown";

export function App() {
  return (
    <Routes>
      <Route path="/emergency" element={<EmergencyShutdown />} />
      <Route path="*" element={<Navigate to="/emergency" replace />} />
    </Routes>
  );
}

export default App;
