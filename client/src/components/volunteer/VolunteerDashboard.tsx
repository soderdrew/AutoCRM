import { TicketList } from "../layout/TicketList";

export function VolunteerDashboard() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome Back!</h1>
          <p className="text-lg text-gray-600">Find opportunities and track your community service journey.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="font-semibold mb-2">Total Service Hours</h3>
          <p className="text-3xl font-bold text-blue-600">0</p>
          <p className="text-sm text-gray-600 mt-1">Hours contributed</p>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="font-semibold mb-2">Active Opportunities</h3>
          <p className="text-3xl font-bold text-blue-600">0</p>
          <p className="text-sm text-gray-600 mt-1">Currently participating</p>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="font-semibold mb-2">Completed Services</h3>
          <p className="text-3xl font-bold text-blue-600">0</p>
          <p className="text-sm text-gray-600 mt-1">Successfully completed</p>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-semibold mb-4">Recent Opportunities</h2>
        <TicketList />
      </div>
    </div>
  );
} 