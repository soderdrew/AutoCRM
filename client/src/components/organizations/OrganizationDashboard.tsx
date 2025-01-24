import { useEffect, useState } from "react";
import { OrganizationTicketList } from "./OrganizationTicketList";
import { supabase } from "../../supabaseClient";

interface DashboardStats {
  activeOpportunities: number;
  totalVolunteers: number;
  serviceHours: number;
  openSlots: number;
}

export function OrganizationDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    activeOpportunities: 0,
    totalVolunteers: 0,
    serviceHours: 0,
    openSlots: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true);
        setError(null);

        // Get the current user's ID
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setError('Please log in to view dashboard');
          return;
        }

        // Fetch all tickets for this organization
        const { data: tickets, error: ticketsError } = await supabase
          .from('tickets')
          .select('status, current_volunteers, max_volunteers, duration')
          .eq('customer_id', user.id);

        if (ticketsError) throw ticketsError;

        if (tickets) {
          // Calculate active opportunities
          const activeTickets = tickets.filter(ticket => 
            !['completed', 'closed', 'resolved'].includes(ticket.status)
          );
          const activeCount = activeTickets.length;

          // Calculate total volunteers across active opportunities only
          const totalVolunteers = activeTickets.reduce((sum, ticket) => 
            sum + (ticket.current_volunteers || 0), 0
          );

          // Calculate total open slots across active opportunities
          const openSlots = activeTickets.reduce((sum, ticket) => {
            const remainingSpots = (ticket.max_volunteers || 0) - (ticket.current_volunteers || 0);
            return sum + Math.max(0, remainingSpots);
          }, 0);

          // Calculate total service hours from active opportunities
          const serviceHours = activeTickets.reduce((sum, ticket) => 
            sum + ((ticket.duration || 0) / 60), 0
          );

          setStats({
            activeOpportunities: activeCount,
            totalVolunteers: totalVolunteers,
            serviceHours: Number(serviceHours.toFixed(1)),
            openSlots: openSlots
          });
        }
      } catch (err) {
        console.error('Error fetching dashboard stats:', err);
        setError(err instanceof Error ? err.message : 'Failed to load dashboard statistics');
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Organization Dashboard</h1>
          <p className="text-lg text-gray-600">Manage your opportunities and connect with volunteers.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="font-semibold mb-2">Active Opportunities</h3>
          {loading ? (
            <div className="animate-pulse">
              <div className="h-8 w-16 bg-gray-200 rounded"></div>
            </div>
          ) : (
            <>
              <p className="text-3xl font-bold text-blue-600">{stats.activeOpportunities}</p>
              <p className="text-sm text-gray-600 mt-1">Currently open</p>
            </>
          )}
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="font-semibold mb-2">Volunteers Signed Up</h3>
          {loading ? (
            <div className="animate-pulse">
              <div className="h-8 w-16 bg-gray-200 rounded"></div>
            </div>
          ) : (
            <>
              <p className="text-3xl font-bold text-blue-600">{stats.totalVolunteers}</p>
              <p className="text-sm text-gray-600 mt-1">Across all active opportunities</p>
            </>
          )}
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="font-semibold mb-2">Open Volunteer Slots</h3>
          {loading ? (
            <div className="animate-pulse">
              <div className="h-8 w-16 bg-gray-200 rounded"></div>
            </div>
          ) : (
            <>
              <p className="text-3xl font-bold text-blue-600">{stats.openSlots}</p>
              <p className="text-sm text-gray-600 mt-1">Available positions</p>
            </>
          )}
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="font-semibold mb-2">Service Hours</h3>
          {loading ? (
            <div className="animate-pulse">
              <div className="h-8 w-16 bg-gray-200 rounded"></div>
            </div>
          ) : (
            <>
              <p className="text-3xl font-bold text-blue-600">{stats.serviceHours}</p>
              <p className="text-sm text-gray-600 mt-1">Total hours across active opportunities</p>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          <p className="font-medium">Error loading dashboard</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      <OrganizationTicketList />
    </div>
  );
} 