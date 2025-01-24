import { useEffect, useState, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs";
import { VolunteerTicketCard } from "./VolunteerTicketCard";
import { supabase } from "../../../supabaseClient";
import type { Database } from "../../../types/supabase";
import { Link } from "react-router-dom";
import { Button } from "../../ui/button";

type Ticket = Database['public']['Tables']['tickets']['Row'] & {
  customer: {
    first_name: string;
    last_name: string;
    company: string | null;
  } | null;
  event_date: string;
  duration: number;
  location: string;
  current_volunteers: number;
  max_volunteers: number;
};

export function VolunteerDashboardList() {
  const [activeTickets, setActiveTickets] = useState<Ticket[]>([]);
  const [completedTickets, setCompletedTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const fetchTickets = useCallback(async () => {
    if (!userId) return;
    
    try {
      setError(null);
      setLoading(true);
      
      console.log('Fetching assignments for user:', userId);
      
      // First fetch assignments for the current user
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('ticket_assignments')
        .select('ticket_id')
        .eq('agent_id', userId)
        .eq('active', true);

      if (assignmentsError) {
        console.error('Assignment fetch error:', assignmentsError);
        throw assignmentsError;
      }

      console.log('Assignments data:', assignmentsData);

      // If no assignments, set empty arrays and return early
      if (!assignmentsData || assignmentsData.length === 0) {
        console.log('No assignments found');
        setActiveTickets([]);
        setCompletedTickets([]);
        setLoading(false);
        return;
      }

      const assignedTicketIds = assignmentsData.map(a => a.ticket_id);
      console.log('Assigned ticket IDs:', assignedTicketIds);

      // Then fetch the assigned tickets with new fields
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
          closed_at,
          event_date,
          duration,
          location,
          current_volunteers,
          max_volunteers
        `)
        .in('id', assignedTicketIds)
        .order('created_at', { ascending: false });

      if (ticketsError) {
        console.error('Tickets fetch error:', ticketsError);
        throw ticketsError;
      }

      console.log('Tickets data:', ticketsData);

      if (!ticketsData) {
        setActiveTickets([]);
        setCompletedTickets([]);
        setLoading(false);
        return;
      }

      // Fetch user roles for all customers
      const customerIds = ticketsData.map(t => t.customer_id) || [];
      const { data: userRolesData, error: userRolesError } = await supabase
        .from('user_roles')
        .select('user_id, first_name, last_name, company')
        .in('user_id', customerIds);

      if (userRolesError) {
        console.error('User roles fetch error:', userRolesError);
        throw userRolesError;
      }

      console.log('User roles data:', userRolesData);

      // Create a map of user_id to user role data
      const userRolesMap = new Map(
        userRolesData?.map(role => [role.user_id, role]) || []
      );

      // Combine tickets with their customer data
      const transformedTickets = ticketsData.map(ticket => ({
        ...ticket,
        customer: userRolesMap.get(ticket.customer_id) || null
      }));

      // Split tickets into active and completed
      const active = transformedTickets.filter(ticket => 
        ticket.status !== 'completed' && ticket.status !== 'closed' && ticket.status !== 'resolved'
      );
      const completed = transformedTickets.filter(ticket => 
        ticket.status === 'completed' || ticket.status === 'closed' || ticket.status === 'resolved'
      );

      console.log('Active tickets:', active);
      console.log('Completed tickets:', completed);

      setActiveTickets(active);
      setCompletedTickets(completed);
    } catch (err) {
      console.error('Error fetching opportunities:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch opportunities');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Handle authentication and set userId
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError) {
        setError('Authentication error. Please try logging in again.');
        return;
      }
      if (!session) {
        setError('Please log in to view opportunities.');
        return;
      }
      setUserId(session.user.id);
    };

    checkAuth();
  }, []);

  // Fetch tickets whenever userId changes
  useEffect(() => {
    if (!userId) return;

    fetchTickets();

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
  }, [userId, fetchTickets]);

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
    <Tabs defaultValue="active" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="active">My Opportunities</TabsTrigger>
        <TabsTrigger value="completed">Completed Opportunities</TabsTrigger>
      </TabsList>
      <TabsContent value="active" className="mt-4">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Active Opportunities</h3>
          {activeTickets.map((ticket) => (
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
                createdAt: new Date(ticket.created_at).toLocaleString(),
                eventDate: ticket.event_date ? new Date(ticket.event_date) : null,
                duration: ticket.duration || 0,
                location: ticket.location || 'Location not specified',
                currentVolunteers: ticket.current_volunteers || 0,
                maxVolunteers: ticket.max_volunteers || 0
              }}
              isAssigned={true}
              onAssignmentChange={fetchTickets}
            />
          ))}
          {activeTickets.length === 0 && (
            <p className="text-gray-500 text-center py-4">No active opportunities</p>
          )}
        </div>
      </TabsContent>
      <TabsContent value="completed" className="mt-4">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Completed Services</h3>
          {completedTickets.map((ticket) => (
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
                createdAt: new Date(ticket.created_at).toLocaleString(),
                eventDate: ticket.event_date ? new Date(ticket.event_date) : null,
                duration: ticket.duration || 0,
                location: ticket.location || 'Location not specified',
                currentVolunteers: ticket.current_volunteers || 0,
                maxVolunteers: ticket.max_volunteers || 0
              }}
              isAssigned={true}
              onAssignmentChange={fetchTickets}
            />
          ))}
          {completedTickets.length === 0 && (
            <p className="text-gray-500 text-center py-4">No completed services</p>
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
} 