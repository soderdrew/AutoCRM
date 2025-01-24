import { OrganizationTicketList } from "./OrganizationTicketList";

export function OrganizationDashboard() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Organization Dashboard</h1>
          <p className="text-lg text-gray-600">Manage your opportunities and connect with volunteers.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="font-semibold mb-2">Active Opportunities</h3>
          <p className="text-3xl font-bold text-blue-600">0</p>
          <p className="text-sm text-gray-600 mt-1">Currently open</p>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="font-semibold mb-2">Total Volunteers</h3>
          <p className="text-3xl font-bold text-blue-600">0</p>
          <p className="text-sm text-gray-600 mt-1">Across all opportunities</p>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="font-semibold mb-2">Service Hours</h3>
          <p className="text-3xl font-bold text-blue-600">0</p>
          <p className="text-sm text-gray-600 mt-1">Total volunteer hours</p>
        </div>
      </div>

      <OrganizationTicketList />
    </div>
  );
} 