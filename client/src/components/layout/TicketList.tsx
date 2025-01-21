import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { LayoutGrid, List } from "lucide-react";
import { TicketCard } from "./TicketCard";
import { supabase } from "../../supabaseClient";
import type { Database } from "../../types/supabase";

type Ticket = Database['public']['Tables']['tickets']['Row'] & {
  customer: {
    first_name: string;
    last_name: string;
    company: string | null;
  } | null;
};

type ViewMode = 'grid' | 'list';

export function TicketList() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  useEffect(() => {
    // Check auth state
    const checkAuth = async () => {
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError) {
        console.error('Auth error:', authError);
        setError('Authentication error. Please try logging in again.');
        return false;
      }
      if (!session) {
        console.error('No active session');
        setError('Please log in to view tickets.');
        return false;
      }
      console.log('Authenticated as:', session.user.email);
      return true;
    };

    const initializeTickets = async () => {
      const isAuthenticated = await checkAuth();
      if (isAuthenticated) {
        fetchTickets();
      } else {
        setLoading(false);
      }
    };

    initializeTickets();

    // Set up real-time subscription
    const subscription = supabase
      .channel('tickets-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets'
        },
        () => {
          fetchTickets();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchTickets = async () => {
    try {
      setError(null);
      console.log('Fetching tickets...');
      
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
        .order('created_at', { ascending: false });

      if (ticketsError) {
        console.error('Supabase error:', ticketsError);
        throw ticketsError;
      }

      // Then fetch user roles for all customers
      const customerIds = ticketsData?.map(t => t.customer_id) || [];
      const { data: userRolesData, error: userRolesError } = await supabase
        .from('user_roles')
        .select('user_id, first_name, last_name, company')
        .in('user_id', customerIds);

      if (userRolesError) {
        console.error('Error fetching user roles:', userRolesError);
        throw userRolesError;
      }

      // Create a map of user_id to user role data
      const userRolesMap = new Map(
        userRolesData?.map(role => [role.user_id, role]) || []
      );

      // Combine tickets with their customer data
      const transformedTickets = (ticketsData || []).map(ticket => ({
        ...ticket,
        customer: userRolesMap.get(ticket.customer_id) || null
      }));

      console.log('Transformed tickets:', transformedTickets);
      setTickets(transformedTickets);
    } catch (err) {
      console.error('Error fetching tickets:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch tickets');
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
        <p className="font-medium">Error loading tickets</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Tickets</h2>
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
          <TicketCard
            key={ticket.id}
            ticket={{
              id: ticket.id,
              title: ticket.title,
              customer: ticket.customer ? 
                `${ticket.customer.first_name} ${ticket.customer.last_name}${ticket.customer.company ? ` · ${ticket.customer.company}` : ''}` : 
                'Unknown Customer',
              status: ticket.status,
              priority: ticket.priority,
              createdAt: new Date(ticket.created_at).toLocaleString()
            }}
          />
        ))}
        {tickets.length === 0 && (
          <div className="col-span-full text-center py-12 bg-gray-50 rounded-lg">
            <p className="text-gray-600">No tickets found</p>
          </div>
        )}
      </div>
    </div>
  );
}