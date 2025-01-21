import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AuthComponent from './components/Auth';
import ProtectedRoute from './components/ProtectedRoute';

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
              {/* <CustomerTickets /> */}
              <div>Customer Tickets Page (Coming Soon)</div>
            </ProtectedRoute>
          }
        />

        {/* Protected employee routes */}
        <Route
          path="/employee/tickets"
          element={
            <ProtectedRoute allowedRoles={['employee', 'admin']}>
              {/* <EmployeeTickets /> */}
              <div>Employee Tickets Page (Coming Soon)</div>
            </ProtectedRoute>
          }
        />

        {/* Protected admin routes */}
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              {/* <AdminDashboard /> */}
              <div>Admin Dashboard (Coming Soon)</div>
            </ProtectedRoute>
          }
        />

        {/* Unauthorized access page */}
        <Route path="/unauthorized" element={<div>Unauthorized Access</div>} />

        {/* Redirect root to appropriate dashboard based on role */}
        <Route path="/" element={<Navigate to="/auth" replace />} />
      </Routes>
    </Router>
  );
}
