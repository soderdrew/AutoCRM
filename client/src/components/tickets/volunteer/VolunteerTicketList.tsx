import { useEffect, useState } from "react";
import { Button } from "../../ui/button";
import { LayoutGrid, List } from "lucide-react";
import { VolunteerTicketCard } from "./VolunteerTicketCard";
import { supabase } from "../../../supabaseClient";
import type { Database } from "../../../types/supabase";

type Ticket = Database['public']['Tables']['tickets']['Row'] & {
  customer: {
    first_name: string;
    last_name: string;
    company: string | null;
  } | null;
};

type ViewMode = 'grid' | 'list';

export function VolunteerTicketList() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Set<string>>(new Set());

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setCurrentUserId(session.user.id);
      }
    };
    checkAuth();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      fetchTickets();
    }
  }, [currentUserId]);

  const fetchTickets = async () => {
    try {
      setError(null);
      console.log('Fetching opportunities...');
      
      // First fetch tickets
      const { data: ticketsData, error: ticketsError } = await supabase
        .from('tickets')
        .select(`
          id,
          title,
          description,
          status,
          priority,
          tags,
          custom_fields,
          customer_id,
          team_id,
          created_at,
          updated_at,
          resolved_at,
          closed_at
        `)
        .not('status', 'eq', 'closed')
        .not('status', 'eq', 'resolved')
        .order('created_at', { ascending: false });

      if (ticketsError) {
        console.error('Supabase error:', ticketsError);
        throw ticketsError;
      }

      // Fetch current user's assignments
      if (currentUserId) {
        const { data: assignmentData, error: assignmentError } = await supabase
          .from('ticket_assignments')
          .select('ticket_id')
          .eq('agent_id', currentUserId)
          .eq('active', true);

        if (assignmentError) {
          console.error('Error fetching assignments:', assignmentError);
        } else {
          setAssignments(new Set(assignmentData.map(a => a.ticket_id)));
        }
      }

      // Then fetch user roles for all customers
      const customerIds = ticketsData?.map(t => t.customer_id) || [];
      const { data: userRolesData, error: userRolesError } = await supabase
        .from('user_roles')
        .select('user_id, first_name, last_name, company')
        .in('user_id', customerIds)
        .eq('role', 'customer');

      if (userRolesError) {
        console.error('Error fetching user roles:', userRolesError);
        throw userRolesError;
      }

      // Create a map of user_id to user role data
      const userRolesMap = new Map(
        userRolesData?.map(role => [
          role.user_id, 
          {
            first_name: role.first_name || '',
            last_name: role.last_name || '',
            company: role.company || role.first_name || null
          }
        ]) || []
      );

      // Combine tickets with their customer data
      const transformedTickets = (ticketsData || []).map(ticket => ({
        ...ticket,
        customer: userRolesMap.get(ticket.customer_id) || null
      }));

      setTickets(transformedTickets);
    } catch (err) {
      console.error('Error fetching opportunities:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch opportunities');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
        <p className="font-medium">Error loading opportunities</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Available Opportunities</h2>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('grid')}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className={viewMode === 'grid' ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3' : 'space-y-4'}>
        {tickets.map((ticket) => (
          <VolunteerTicketCard
            key={ticket.id}
            ticket={{
              id: ticket.id,
              title: ticket.title,
              customer: ticket.customer ? 
                ticket.customer.company || ticket.customer.first_name : 
                'Unknown Organization',
              status: ticket.status,
              priority: ticket.priority,
              createdAt: new Date(ticket.created_at).toLocaleString()
            }}
            isAssigned={assignments.has(ticket.id)}
          />
        ))}
        {tickets.length === 0 && (
          <div className="col-span-full text-center py-12 bg-gray-50 rounded-lg">
            <p className="text-gray-600">No opportunities available at the moment</p>
          </div>
        )}
      </div>
    </div>
  );
} 