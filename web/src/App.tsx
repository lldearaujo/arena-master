import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { useAuthStore } from "./store/auth";
import { LoginPage } from "./features/auth/LoginPage";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { MuralPage } from "./features/mural/MuralPage";
import { DojosPage } from "./features/dojos/DojosPage";
import { SuperAdminProfessoresPage } from "./features/superadmin/SuperAdminProfessoresPage";
import { SuperAdminStudentsPage } from "./features/superadmin/SuperAdminStudentsPage";
import { StudentsPage } from "./features/students/StudentsPage";
import { TurmasPage } from "./features/turmas/TurmasPage";
import { CheckInsPage } from "./features/checkins/CheckInsPage";
import { FaixasPage } from "./features/faixas/FaixasPage";
import { SettingsPage } from "./features/settings/SettingsPage";
import { FinancePage } from "./features/finance/FinancePage";
import { SkillsPage } from "./features/skills/SkillsPage";
import { AppShell } from "./ui/AppShell";
import { PrivacyPolicyPage } from "./features/privacy/PrivacyPolicyPage";
import { HomePage } from "./features/home/HomePage";

type PrivateRouteProps = {
  children: JSX.Element;
  allowedRoles?: Array<"superadmin" | "admin" | "aluno">;
};

function PrivateRoute({ children, allowedRoles }: PrivateRouteProps) {
  const user = useAuthStore((s) => s.user);
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/login" replace />;
  }
  return <AppShell>{children}</AppShell>;
}

function HomeRoute() {
  const user = useAuthStore((s) => s.user);
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }
  return <HomePage />;
}

export function App() {
  const [hydrated, setHydrated] = useState(false);
  const store = useAuthStore as typeof useAuthStore & {
    persist?: { hasHydrated: () => boolean; onFinishHydration: (cb: () => void) => () => void };
  };

  useEffect(() => {
    if (store.persist?.hasHydrated?.()) {
      setHydrated(true);
      return;
    }
    const unsub = store.persist?.onFinishHydration?.(() => setHydrated(true));
    const fallback = setTimeout(() => setHydrated(true), 500);
    return () => {
      clearTimeout(fallback);
      unsub?.();
    };
  }, [store]);

  if (!hydrated) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          fontFamily: "system-ui",
          color: "#6b7280",
        }}
      >
        Carregando...
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<HomeRoute />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/politica-de-privacidade" element={<PrivacyPolicyPage />} />
      <Route
        path="/dashboard"
        element={
          <PrivateRoute>
            <DashboardPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/mural"
        element={
          <PrivateRoute allowedRoles={["admin"]}>
            <MuralPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/dojos"
        element={
          <PrivateRoute allowedRoles={["superadmin"]}>
            <DojosPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/superadmin/professores"
        element={
          <PrivateRoute allowedRoles={["superadmin"]}>
            <SuperAdminProfessoresPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/superadmin/alunos"
        element={
          <PrivateRoute allowedRoles={["superadmin"]}>
            <SuperAdminStudentsPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/faixas"
        element={
          <PrivateRoute allowedRoles={["admin"]}>
            <FaixasPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/students"
        element={
          <PrivateRoute allowedRoles={["admin"]}>
            <StudentsPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/turmas"
        element={
          <PrivateRoute allowedRoles={["admin"]}>
            <TurmasPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/check-ins"
        element={
          <PrivateRoute allowedRoles={["admin"]}>
            <CheckInsPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/configuracoes"
        element={
          <PrivateRoute allowedRoles={["admin"]}>
            <SettingsPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/financeiro"
        element={
          <PrivateRoute allowedRoles={["admin"]}>
            <FinancePage />
          </PrivateRoute>
        }
      />
      <Route
        path="/habilidades"
        element={
          <PrivateRoute allowedRoles={["admin"]}>
            <SkillsPage />
          </PrivateRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

