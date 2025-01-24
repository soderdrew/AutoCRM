import { useEffect, useState } from "react";
import { VolunteerDashboardList } from "../tickets/volunteer/VolunteerDashboardList";
import { supabase } from "../../supabaseClient";

interface DashboardStats {
  serviceHours: number;
  activeOpportunities: number;
  completedServices: number;
}

export function VolunteerDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    serviceHours: 0,
    activeOpportunities: 0,
    completedServices: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get the current user's ID
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setError('Please log in to view dashboard');
          return;
        }

        // Fetch all assignments for the current user
        const { data: assignments, error: assignmentsError } = await supabase
          .from('ticket_assignments')
          .select('ticket_id')
          .eq('agent_id', user.id)
          .eq('active', true);

        if (assignmentsError) throw assignmentsError;

        if (!assignments || assignments.length === 0) {
          setStats({
            serviceHours: 0,
            activeOpportunities: 0,
            completedServices: 0
          });
          return;
        }

        const assignedTicketIds = assignments.map(a => a.ticket_id);

        // Fetch all assigned tickets with their details
        const { data: tickets, error: ticketsError } = await supabase
          .from('tickets')
          .select('status, duration, current_volunteers')
          .in('id', assignedTicketIds);

        if (ticketsError) throw ticketsError;

        if (tickets) {
          // Calculate active opportunities
          const activeCount = tickets.filter(ticket => 
            !['completed', 'closed', 'resolved'].includes(ticket.status)
          ).length;

          // Calculate completed services
          const completedCount = tickets.filter(ticket => 
            ['completed', 'closed', 'resolved'].includes(ticket.status)
          ).length;

          // Calculate total service hours (duration is in minutes, convert to hours)
          const totalHours = tickets.reduce((sum, ticket) => {
            // Only count completed tickets for service hours
            if (['completed', 'closed', 'resolved'].includes(ticket.status)) {
              return sum + ((ticket.duration || 0) / 60);
            }
            return sum;
          }, 0);

          setStats({
            serviceHours: Number(totalHours.toFixed(1)), // Show one decimal place
            activeOpportunities: activeCount,
            completedServices: completedCount
          });
        }
      } catch (err) {
        console.error('Error fetching dashboard stats:', err);
        setError(err instanceof Error ? err.message : 'Failed to load dashboard statistics');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

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
          <h3 className="font-semibold mb-2">Active Opportunities</h3>
          {loading ? (
            <div className="animate-pulse">
              <div className="h-8 w-16 bg-gray-200 rounded"></div>
            </div>
          ) : (
            <>
              <p className="text-3xl font-bold text-blue-600">{stats.activeOpportunities}</p>
              <p className="text-sm text-gray-600 mt-1">Currently participating</p>
            </>
          )}
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="font-semibold mb-2">Completed Services</h3>
          {loading ? (
            <div className="animate-pulse">
              <div className="h-8 w-16 bg-gray-200 rounded"></div>
            </div>
          ) : (
            <>
              <p className="text-3xl font-bold text-blue-600">{stats.completedServices}</p>
              <p className="text-sm text-gray-600 mt-1">Successfully completed</p>
            </>
          )}
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="font-semibold mb-2">Total Service Hours</h3>
          {loading ? (
            <div className="animate-pulse">
              <div className="h-8 w-16 bg-gray-200 rounded"></div>
            </div>
          ) : (
            <>
              <p className="text-3xl font-bold text-blue-600">{stats.serviceHours}</p>
              <p className="text-sm text-gray-600 mt-1">Hours contributed</p>
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

      <div>
        <h2 className="text-2xl font-semibold mb-4">My Opportunities</h2>
        <VolunteerDashboardList />
      </div>
    </div>
  );
} 