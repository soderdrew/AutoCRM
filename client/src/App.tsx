import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AuthComponent from './components/Auth';
import ProtectedRoute from './components/ProtectedRoute';
import { SidebarProvider } from "./components/ui/sidebar";
import { AppSidebar } from "./components/layout/AppSidebar";
import { Header } from "./components/layout/Header";
import { TicketList } from "./components/layout/TicketList";
import { LandingPage } from "./components/layout/LandingPage";
import { VolunteerDashboard } from "./components/volunteer/VolunteerDashboard";
import { volunteerMenuItems } from "./components/volunteer/volunteerConfig";
import { OrganizationDashboard } from "./components/organizations/OrganizationDashboard";
import { organizationMenuItems } from "./components/organizations/organizationConfig";

// Layout wrapper component
interface DashboardLayoutProps {
  children: React.ReactNode;
  userType?: 'volunteer' | 'organization' | 'admin';
}

const DashboardLayout = ({ children, userType = 'volunteer' }: DashboardLayoutProps) => {
  // Get menu items based on user type
  const getMenuItems = () => {
    switch (userType) {
      case 'volunteer':
        return volunteerMenuItems;
      case 'organization':
        return organizationMenuItems;
      // Add other user types here when we create their configs
      default:
        return volunteerMenuItems; // Fallback to volunteer menu for now
    }
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar menuItems={getMenuItems()} />
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

// Empty placeholder components for other routes
const ServiceHours = () => (
  <div className="space-y-6">
    <h1 className="text-3xl font-bold tracking-tight">My Service Hours</h1>
    <p className="text-lg text-gray-600">Track and verify your volunteer hours.</p>
  </div>
);

const Profile = () => (
  <div className="space-y-6">
    <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>
    <p className="text-lg text-gray-600">Manage your volunteer profile and preferences.</p>
  </div>
);

const Settings = () => (
  <div className="space-y-6">
    <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
    <p className="text-lg text-gray-600">Manage your account settings and notifications.</p>
  </div>
);

const OrganizationProfile = () => (
  <div className="space-y-6">
    <h1 className="text-3xl font-bold tracking-tight">Organization Profile</h1>
    <p className="text-lg text-gray-600">Manage your organization's information and preferences.</p>
  </div>
);

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<AuthComponent />} />
        
        {/* Protected volunteer routes */}
        <Route
          path="/volunteer/dashboard"
          element={
            <ProtectedRoute allowedRoles={['employee', 'admin']}>
              <DashboardLayout userType="volunteer">
                <VolunteerDashboard />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/volunteer/opportunities"
          element={
            <ProtectedRoute allowedRoles={['employee', 'admin']}>
              <DashboardLayout userType="volunteer">
                <TicketList />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/volunteer/hours"
          element={
            <ProtectedRoute allowedRoles={['employee', 'admin']}>
              <DashboardLayout userType="volunteer">
                <ServiceHours />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/volunteer/profile"
          element={
            <ProtectedRoute allowedRoles={['employee', 'admin']}>
              <DashboardLayout userType="volunteer">
                <Profile />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/volunteer/settings"
          element={
            <ProtectedRoute allowedRoles={['employee', 'admin']}>
              <DashboardLayout userType="volunteer">
                <Settings />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        {/* Protected organization routes */}
        <Route
          path="/organization/dashboard"
          element={
            <ProtectedRoute allowedRoles={['customer', 'admin']}>
              <DashboardLayout userType="organization">
                <OrganizationDashboard />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/organization/opportunities"
          element={
            <ProtectedRoute allowedRoles={['customer', 'admin']}>
              <DashboardLayout userType="organization">
                <TicketList />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/organization/opportunities/new"
          element={
            <ProtectedRoute allowedRoles={['customer', 'admin']}>
              <DashboardLayout userType="organization">
                <div>Create New Opportunity</div>
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/organization/profile"
          element={
            <ProtectedRoute allowedRoles={['customer', 'admin']}>
              <DashboardLayout userType="organization">
                <OrganizationProfile />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/organization/settings"
          element={
            <ProtectedRoute allowedRoles={['customer', 'admin']}>
              <DashboardLayout userType="organization">
                <Settings />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        {/* Protected admin routes */}
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <DashboardLayout userType="admin">
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

        {/* Catch all route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
