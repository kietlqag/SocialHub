import { Navigate } from "react-router-dom";
import { AuthUser } from "../services/auth";

export default function RequireAdmin({ user, children }) {
  if (!user) return <Navigate to="/home" replace />;
  if (user.role !== "admin") return <Navigate to="/managedash" replace />;
  return children;
}
