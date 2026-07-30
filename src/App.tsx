import { Navigate, Route, Routes } from "react-router";
import EmergencyShutdown from "@/views/EmergencyShutdown";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<EmergencyShutdown />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
