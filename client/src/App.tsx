import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/features/auth/useAuth";
import { LoginPage } from "@/components/login-page";
import DashboardLayout from "@/pages/DashboardLayout";
import DashboardHome from "@/pages/DashboardHome";
import ConsumersListPage from "@/pages/ConsumersListPage";
import ConsumerAddPage from "@/pages/ConsumerAddPage";
import ConsumerDetailPage from "@/pages/ConsumerDetailPage";
import ConsumerEditPage from "@/pages/ConsumerEditPage";

/**
 * The whole app's routing tree. This replaces Next.js's file-based routing
 * (the app/ folder). `next-themes` works in any React app, so the theme
 * provider carries over unchanged from the Next.js RootLayout.
 *
 * Route layout:
 *   /login                 -> LoginPage (public)
 *   /                      -> DashboardLayout (auth-guarded shell) with:
 *     index                -> DashboardHome
 *     consumers            -> ConsumersListPage
 *     consumers/add        -> ConsumerAddPage
 *     consumers/:id        -> ConsumerDetailPage
 */
export default function App() {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      storageKey="fetch-api-demo-theme"
      enableSystem={false}
    >
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<DashboardLayout />}>
              <Route index element={<DashboardHome />} />
              <Route path="consumers" element={<ConsumersListPage />} />
              <Route path="consumers/add" element={<ConsumerAddPage />} />
              <Route path="consumers/:id" element={<ConsumerDetailPage />} />
              <Route path="consumers/:id/edit" element={<ConsumerEditPage />} />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
