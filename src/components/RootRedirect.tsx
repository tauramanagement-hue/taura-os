import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export const RootRedirect = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "hsl(var(--background))",
        }}
      >
        <div
          style={{
            width: 20,
            height: 20,
            border: "2px solid hsl(var(--border))",
            borderTopColor: "hsl(var(--primary))",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Navigate to="/auth" replace />;
};
