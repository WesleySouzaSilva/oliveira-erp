import { Navigate } from "react-router-dom";

/** O Radar agora vive dentro de Vencimentos & Notificações. */
export default function Radar() {
  return <Navigate to="/vencimentos#radar" replace />;
}
