import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AuthComponent from './components/Auth';
import ProtectedRoute from './components/ProtectedRoute';
import { SidebarProvider } from "./components/ui/sidebar";
import { AppSidebar } from "./components/layout/AppSidebar";
import { Header } from "./components/layout/Header";
import { TicketList } from "./components/layout/TicketList";

// Layout wrapper component
const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex-1">
          <Header />
          <main className="container py-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

// Import your other components here
// import Dashboard from './components/Dashboard';
// import TicketList from './components/TicketList';
// etc...

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route path="/auth" element={<AuthComponent />} />
        
        {/* Protected customer routes */}
        <Route
          path="/customer/tickets"
          element={
            <ProtectedRoute allowedRoles={['customer', 'admin']}>
              <DashboardLayout>
                <TicketList />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        {/* Protected employee routes */}
        <Route
          path="/employee/tickets"
          element={
            <ProtectedRoute allowedRoles={['employee', 'admin']}>
              <DashboardLayout>
                <TicketList />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        {/* Protected admin routes */}
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <DashboardLayout>
                <TicketList />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        {/* Unauthorized access page */}
        <Route 
          path="/unauthorized" 
          element={
            <DashboardLayout>
              <div>Unauthorized Access</div>
            </DashboardLayout>
          } 
        />

        {/* Redirect root to appropriate dashboard based on role */}
        <Route path="/" element={<Navigate to="/auth" replace />} />
      </Routes>
    </Router>
  );
}
