import { useEffect, useState, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Button } from "../ui/button";
import { PlusCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import type { Database } from "../../types/supabase";
import { OrganizationTicketCard } from "./OrganizationTicketCard";
import { OrganizationTicketDetails } from "./OrganizationTicketDetails";

type Ticket = Database['public']['Tables']['tickets']['Row'] & {
  organization: {
    first_name: string;
    last_name: string;
    company: string | null;
  } | null;
};

export function OrganizationTicketList() {
  const [activeTickets, setActiveTickets] = useState<Ticket[]>([]);
  const [completedTickets, setCompletedTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [editingTicketId, setEditingTicketId] = useState<string | null>(null);

  const fetchTickets = useCallback(async () => {
    if (!organizationId) return;
    
    try {
      setError(null);
      
      // First fetch tickets for this organization
      const { data: ticketsData, error: ticketsError } = await supabase
        .from('tickets')
        .select('*')
        .eq('customer_id', organizationId)
        .order('created_at', { ascending: false });

      if (ticketsError) throw ticketsError;

      if (!ticketsData) {
        setActiveTickets([]);
        setCompletedTickets([]);
        return;
      }

      // Then fetch the organization details from user_roles
      const { data: orgData, error: orgError } = await supabase
        .from('user_roles')
        .select('first_name, last_name, company')
        .eq('user_id', organizationId)
        .eq('role', 'customer')
        .single();

      if (orgError) {
        console.error('Error fetching organization details:', orgError);
      }

      // Combine the data
      const ticketsWithOrg = ticketsData.map(ticket => ({
        ...ticket,
        organization: orgData || null
      }));

      // Split tickets into active and completed
      const active = ticketsWithOrg.filter(ticket => 
        !['completed', 'closed', 'resolved'].includes(ticket.status)
      );
      const completed = ticketsWithOrg.filter(ticket => 
        ['completed', 'closed', 'resolved'].includes(ticket.status)
      );

      setActiveTickets(active);
      setCompletedTickets(completed);
    } catch (err) {
      console.error('Error fetching opportunities:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch opportunities');
    }
  }, [organizationId]);

  // Get organization ID and fetch initial data
  useEffect(() => {
    async function initialize() {
      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user) {
          setError('Please log in to view opportunities');
          setLoading(false);
          return;
        }

        // Get the auth.users.id as the organization ID
        const { data: orgData, error: orgError } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('user_id', session.user.id)
          .eq('role', 'customer')  // Organizations are stored as customers
          .single();

        if (orgError) {
          console.error('Error fetching organization:', orgError);
          setError('Failed to load organization data');
          setLoading(false);
          return;
        }

        if (!orgData?.user_id) {
          setError('No organization found for this user');
          setLoading(false);
          return;
        }

        setOrganizationId(orgData.user_id);
        await fetchTickets();
      } catch (err) {
        console.error('Error initializing:', err);
        setError('Failed to initialize organization data');
      } finally {
        setLoading(false);
      }
    }

    initialize();
  }, [fetchTickets]);

  // Set up real-time subscription when organizationId is available
  useEffect(() => {
    if (!organizationId) return;

    const subscription = supabase
      .channel('tickets-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets',
          filter: `customer_id=eq.${organizationId}`
        },
        () => {
          fetchTickets();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [organizationId, fetchTickets]);

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
        <h2 className="text-2xl font-semibold">My Opportunities</h2>
        <Button asChild>
          <Link to="/organization/opportunities/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            Create New Opportunity
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="active">Active Opportunities</TabsTrigger>
          <TabsTrigger value="completed">Completed Opportunities</TabsTrigger>
        </TabsList>
        
        <TabsContent value="active" className="mt-4">
          <div className="space-y-4">
            {activeTickets.map((ticket) => (
              <OrganizationTicketCard
                key={ticket.id}
                ticket={{
                  id: ticket.id,
                  title: ticket.title,
                  customer: ticket.organization ? 
                    ticket.organization.first_name : 
                    'Unknown Organization',
                  status: ticket.status,
                  priority: ticket.priority,
                  createdAt: new Date(ticket.created_at).toLocaleString()
                }}
                isOwner={ticket.customer_id === organizationId}
                onClick={() => {}}  // No-op since we don't want to show details
                onEditClick={() => setEditingTicketId(ticket.id)}
              />
            ))}
            {activeTickets.length === 0 && (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <p className="text-gray-600">No active opportunities</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="completed" className="mt-4">
          <div className="space-y-4">
            {completedTickets.map((ticket) => (
              <OrganizationTicketCard
                key={ticket.id}
                ticket={{
                  id: ticket.id,
                  title: ticket.title,
                  customer: ticket.organization ? 
                    ticket.organization.first_name : 
                    'Unknown Organization',
                  status: ticket.status,
                  priority: ticket.priority,
                  createdAt: new Date(ticket.created_at).toLocaleString()
                }}
                isOwner={ticket.customer_id === organizationId}
                onClick={() => {}}  // No-op since we don't want to show details
                onEditClick={() => setEditingTicketId(ticket.id)}
              />
            ))}
            {completedTickets.length === 0 && (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <p className="text-gray-600">No completed opportunities</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Details Dialog */}
      <OrganizationTicketDetails
        ticketId={editingTicketId}
        isOpen={!!editingTicketId}
        onOpenChange={(open) => !open && setEditingTicketId(null)}
        onTicketUpdate={fetchTickets}
      />
    </div>
  );
} 