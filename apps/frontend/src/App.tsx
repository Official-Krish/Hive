import "./index.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
} from "react-router-dom";
import { AuthPage } from "./pages/AuthPage";
import { LandingPage } from "./pages/LandingPage";
import { AppBar } from "./components/layout/AppBar";
import { Footer } from "./components/layout/Footer";
import { DashboardLayout } from "./components/dashboard/DashboardLayout";
import { Overview } from "./pages/dashboard/Overview";
import { CreateWorkspace } from "./pages/dashboard/CreateWorkspace";
import { InviteUser } from "./pages/dashboard/InviteUser";
import { WorkspaceInvites } from "./pages/dashboard/WorkspaceInvites";
import { WorkspaceDetail } from "./pages/dashboard/WorkspaceDetail";
import { WorkspaceSettings } from "./pages/dashboard/WorkspaceSettings";
import { OrgDetail } from "./pages/dashboard/OrgDetail";
import { OrgMembers } from "./pages/dashboard/OrgMembers";
import { OrgWorkspaces } from "./pages/dashboard/OrgWorkspaces";
import { OrgTeams } from "./pages/dashboard/OrgTeams";
import { AvatarSelection } from "./pages/dashboard/AvatarSelection";
import WorldPage from "./pages/WorldPage";
import { AuthGuard } from "./lib/ProtectedRoute";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <AppBar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1">
        <AuthPage />
      </main>
      <Footer />
    </div>
  );
}

const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: "/", element: <LandingPage /> },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
  { path: "/auth", element: <AuthLayout /> },
  {
    path: "/world",
    element: (
      <AuthGuard>
        <WorldPage />
      </AuthGuard>
    ),
  },
  {
    path: "/dashboard",
    element: (
      <AuthGuard>
        <DashboardLayout />
      </AuthGuard>
    ),
    children: [
      { index: true, element: <Overview /> },
      { path: "create", element: <CreateWorkspace /> },
      { path: "invite", element: <InviteUser /> },
      { path: "invites", element: <WorkspaceInvites /> },
      { path: "avatar", element: <AvatarSelection /> },
      { path: "w/:workspaceId", element: <WorkspaceDetail /> },
      { path: "w/:workspaceId/settings", element: <WorkspaceSettings /> },
      {
        path: "o/:orgId",
        element: <OrgDetail />,
        children: [
          { index: true, element: <Navigate to="members" replace /> },
          { path: "members", element: <OrgMembers /> },
          { path: "workspaces", element: <OrgWorkspaces /> },
          { path: "teams", element: <OrgTeams /> },
        ],
      },
    ],
  },
]);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <ToastContainer
        position="top-right"
        autoClose={3500}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        pauseOnFocusLoss={false}
        draggable
        pauseOnHover
        theme="light"
      />
    </QueryClientProvider>
  );
}

export default App;
