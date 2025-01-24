import { useEffect, useState, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Button } from "../ui/button";
import { PlusCircle, MessageSquare } from "lucide-react";
import { supabase } from "../../supabaseClient";
import type { Database } from "../../types/supabase";
import { OrganizationTicketCard } from "./OrganizationTicketCard";
import { OrganizationTicketDetails } from "./OrganizationTicketDetails";
import { CreateOpportunityDialog } from "./CreateOpportunityDialog";
import { VolunteerFeedbackForm } from "./VolunteerFeedbackForm";
import { ScrollArea } from "../ui/scroll-area";

type Ticket = Database['public']['Tables']['tickets']['Row'] & {
  organization: {
    first_name: string;
    last_name: string;
    company: string | null;
  } | null;
  customer_id: string;
  current_volunteers: number;
  max_volunteers: number;
  location: string | null;
  event_date: string | null;
  duration: number | null;
  created_at: string;
  title: string;
  status: 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
};

interface FeedbackState {
  isOpen: boolean;
  ticketId: string;
  volunteers: Array<{ id: string; name: string; }>;
}

interface VolunteerFeedbackStatus {
  [ticketId: string]: {
    total: number;
    completed: number;
  };
}

export function OrganizationTicketList() {
  const [activeTickets, setActiveTickets] = useState<Ticket[]>([]);
  const [completedTickets, setCompletedTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [editingTicketId, setEditingTicketId] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [feedbackState, setFeedbackState] = useState<FeedbackState | null>(null);
  const [volunteerAssignments, setVolunteerAssignments] = useState<Record<string, Array<{id: string, name: string}>>>({});
  const [feedbackStatus, setFeedbackStatus] = useState<VolunteerFeedbackStatus>({});

  const fetchTickets = useCallback(async () => {
    if (!organizationId) return;
    
    try {
      setError(null);
      
      // First fetch tickets for this organization
      const { data: ticketsData, error: ticketsError } = await supabase
        .from('tickets')
        .select('*')
        .eq('customer_id', organizationId)
        .order('created_at', { ascending: false }) as { 
          data: Database['public']['Tables']['tickets']['Row'][] | null; 
          error: any; 
        };

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
        .single() as {
          data: {
            first_name: string;
            last_name: string;
            company: string | null;
          } | null;
          error: any;
        };

      if (orgError) {
        console.error('Error fetching organization details:', orgError);
      }

      // Combine the data
      const ticketsWithOrg = ticketsData.map(ticket => ({
        ...ticket,
        organization: orgData || null
      })) as Ticket[];

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

  // Add function to fetch volunteer assignments
  const fetchVolunteerAssignments = useCallback(async (ticketIds: string[]) => {
    if (!ticketIds.length) return;

    try {
      // First get the assignments
      const { data: assignments, error: assignmentsError } = await supabase
        .from('ticket_assignments')
        .select('ticket_id, agent_id')
        .in('ticket_id', ticketIds)
        .eq('active', true);

      if (assignmentsError) throw assignmentsError;
      if (!assignments) return;

      // Then get the user details for each agent
      const agentIds = assignments.map(a => a.agent_id);
      const { data: userRoles, error: userRolesError } = await supabase
        .from('user_roles')
        .select('user_id, first_name, last_name')
        .in('user_id', agentIds);

      if (userRolesError) throw userRolesError;
      if (!userRoles) return;

      // Create a map of user_id to user details for quick lookup
      const userMap = new Map(userRoles.map(user => [user.user_id, user]));

      // Build the assignments map
      const assignmentMap: Record<string, Array<{id: string, name: string}>> = {};
      assignments.forEach(assignment => {
        const user = userMap.get(assignment.agent_id);
        if (!user) return;

        const volunteer = {
          id: assignment.agent_id,
          name: `${user.first_name} ${user.last_name}`.trim()
        };
        
        if (!assignmentMap[assignment.ticket_id]) {
          assignmentMap[assignment.ticket_id] = [];
        }
        assignmentMap[assignment.ticket_id].push(volunteer);
      });

      setVolunteerAssignments(assignmentMap);
    } catch (err) {
      console.error('Error fetching volunteer assignments:', err);
    }
  }, []);

  // Add function to fetch feedback status
  const fetchFeedbackStatus = useCallback(async (ticketIds: string[]) => {
    if (!ticketIds.length) return;

    try {
      const { data: feedback, error: feedbackError } = await supabase
        .from('volunteer_feedback')
        .select('ticket_id, volunteer_id')
        .in('ticket_id', ticketIds);

      if (feedbackError) throw feedbackError;

      // Create a map of ticket_id to feedback count
      const statusMap: VolunteerFeedbackStatus = {};
      ticketIds.forEach(ticketId => {
        const totalVolunteers = volunteerAssignments[ticketId]?.length || 0;
        const completedFeedback = feedback?.filter(f => f.ticket_id === ticketId).length || 0;
        statusMap[ticketId] = {
          total: totalVolunteers,
          completed: completedFeedback
        };
      });

      setFeedbackStatus(statusMap);
    } catch (err) {
      console.error('Error fetching feedback status:', err);
    }
  }, [volunteerAssignments]);

  // Update useEffect to fetch feedback status
  useEffect(() => {
    const completedTicketIds = completedTickets.map(t => t.id);
    if (completedTicketIds.length > 0) {
      fetchVolunteerAssignments(completedTicketIds);
      fetchFeedbackStatus(completedTicketIds);
    }
  }, [completedTickets, fetchVolunteerAssignments, fetchFeedbackStatus]);

  const handleFeedbackClick = (ticketId: string) => {
    const volunteers = volunteerAssignments[ticketId] || [];
    setFeedbackState({
      isOpen: true,
      ticketId,
      volunteers
    });
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
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Your Opportunities</h2>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
          Create New Opportunity
        </Button>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="active">Active Opportunities</TabsTrigger>
          <TabsTrigger value="completed">Completed Opportunities</TabsTrigger>
        </TabsList>
        
        <TabsContent value="active" className="mt-4">
          <ScrollArea className="h-[60vh]">
            <div className="space-y-4 pr-4">
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
                    createdAt: new Date(ticket.created_at).toLocaleString(),
                    currentVolunteers: ticket.current_volunteers,
                    maxVolunteers: ticket.max_volunteers,
                    location: ticket.location || undefined,
                    eventDate: ticket.event_date ? new Date(ticket.event_date).toLocaleDateString() : undefined,
                    eventTime: ticket.event_date ? new Date(ticket.event_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
                    duration: ticket.duration || undefined
                  }}
                  isOwner={ticket.customer_id === organizationId}
                  onClick={() => {}}
                  onEditClick={() => setEditingTicketId(ticket.id)}
                />
              ))}
              {activeTickets.length === 0 && (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <p className="text-gray-600">No active opportunities</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="completed" className="mt-4">
          <ScrollArea className="h-[60vh]">
            <div className="space-y-4 pr-4">
              {completedTickets.map((ticket) => (
                <div key={ticket.id} className="relative group">
                  <OrganizationTicketCard
                    ticket={{
                      id: ticket.id,
                      title: ticket.title,
                      customer: ticket.organization ? 
                        ticket.organization.first_name : 
                        'Unknown Organization',
                      status: ticket.status,
                      priority: ticket.priority,
                      createdAt: new Date(ticket.created_at).toLocaleString(),
                      currentVolunteers: ticket.current_volunteers,
                      maxVolunteers: ticket.max_volunteers,
                      location: ticket.location || undefined,
                      eventDate: ticket.event_date ? new Date(ticket.event_date).toLocaleDateString() : undefined,
                      eventTime: ticket.event_date ? new Date(ticket.event_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
                      duration: ticket.duration || undefined
                    }}
                    isOwner={ticket.customer_id === organizationId}
                    onClick={() => {}}
                    onEditClick={() => setEditingTicketId(ticket.id)}
                  />
                  {volunteerAssignments[ticket.id]?.length > 0 && (
                    feedbackStatus[ticket.id]?.completed === feedbackStatus[ticket.id]?.total ? (
                      <div className="absolute top-4 right-16 px-3 py-1 text-sm text-green-600 bg-green-50 rounded-md">
                        All feedback submitted
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleFeedbackClick(ticket.id)}
                        className="absolute top-4 right-16 gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MessageSquare className="h-4 w-4" />
                        Provide Feedback ({feedbackStatus[ticket.id]?.completed || 0}/{feedbackStatus[ticket.id]?.total || 0})
                      </Button>
                    )
                  )}
                </div>
              ))}
              {completedTickets.length === 0 && (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <p className="text-gray-600">No completed opportunities</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Edit Details Dialog */}
      <OrganizationTicketDetails
        ticketId={editingTicketId}
        isOpen={!!editingTicketId}
        onOpenChange={(open) => !open && setEditingTicketId(null)}
        onTicketUpdate={fetchTickets}
      />

      <CreateOpportunityDialog
        isOpen={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onOpportunityCreated={() => {
          // Refresh the list when a new opportunity is created
          fetchTickets();
        }}
      />

      {feedbackState && (
        <VolunteerFeedbackForm
          isOpen={feedbackState.isOpen}
          onClose={() => setFeedbackState(null)}
          ticketId={feedbackState.ticketId}
          organizationId={organizationId || ''}
          volunteers={feedbackState.volunteers}
          onFeedbackSubmitted={() => {
            const completedTicketIds = completedTickets.map(t => t.id);
            fetchFeedbackStatus(completedTicketIds);
          }}
        />
      )}
    </div>
  );
} 