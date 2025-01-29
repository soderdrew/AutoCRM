import { supabase } from "../supabaseClient";

interface OpportunityFilters {
  daysAhead?: number;
  location?: string;
  minDuration?: number;
  maxDuration?: number;
}

// Helper function to format date and time in user's timezone
function formatEventTime(isoDate: string, durationMinutes: number) {
  const startDate = new Date(isoDate);
  const endDate = new Date(startDate.getTime() + durationMinutes * 60000);

  // Format start time
  const startTime = startDate.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short'
  });

  // Format end time
  const endTime = endDate.toLocaleString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short'
  });

  // Format duration
  const durationText = durationMinutes >= 60 
    ? `${durationMinutes / 60} hour${durationMinutes === 60 ? '' : 's'}` 
    : `${durationMinutes} minutes`;

  return {
    startTime,
    endTime,
    durationText,
    fullTimespan: `${startTime} - ${endTime} (${durationText})`
  };
}

export const volunteerTools = {
  async getAvailableOpportunities(filters: OpportunityFilters = {}, userId?: string) {
    try {
      const now = new Date().toISOString();
      const futureDate = filters.daysAhead 
        ? new Date(Date.now() + filters.daysAhead * 24 * 60 * 60 * 1000).toISOString()
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // Default to 30 days

      console.log('Fetching opportunities between:', { now, futureDate });

      // First, get user's current assignments if userId is provided
      let userAssignments: any[] = [];
      if (userId) {
        const { data: assignments, error: assignmentsError } = await supabase
          .from('ticket_assignments')
          .select('ticket_id')
          .eq('agent_id', userId)
          .eq('active', true);

        if (!assignmentsError && assignments) {
          userAssignments = assignments;
        }
        console.log('User current assignments:', userAssignments);
      }

      let query = supabase
        .from('tickets')
        .select(`
          *,
          teams (
            id,
            name,
            description
          ),
          customer_id,
          team_id
        `)
        .gte('event_date', now)
        .lte('event_date', futureDate)
        .eq('status', 'open');

      const { data: opportunities, error } = await query;

      console.log('Raw opportunities from database:', opportunities);

      if (error) throw error;

      // Filter opportunities with available slots and not already signed up for
      const availableOpportunities = opportunities?.filter(opp => {
        const hasSpace = (opp.current_volunteers || 0) < (opp.max_volunteers || 0);
        const alreadySignedUp = userAssignments.some(assignment => assignment.ticket_id === opp.id);
        
        console.log('Opportunity check:', {
          id: opp.id,
          title: opp.title,
          current: opp.current_volunteers,
          max: opp.max_volunteers,
          hasSpace,
          alreadySignedUp
        });
        
        return hasSpace && !alreadySignedUp;
      }) || [];

      // Add formatted time information to each opportunity
      const opportunitiesWithFormattedTime = availableOpportunities.map(opp => ({
        ...opp,
        formattedTime: formatEventTime(opp.event_date, opp.duration)
      }));

      console.log('Filtered available opportunities:', opportunitiesWithFormattedTime);

      // Sort by date and priority
      const sortedOpportunities = opportunitiesWithFormattedTime.sort((a, b) => {
        // First sort by priority (higher priority first)
        const priorityDiff = (b.priority || 0) - (a.priority || 0);
        if (priorityDiff !== 0) return priorityDiff;
        // Then sort by date
        return new Date(a.event_date).getTime() - new Date(b.event_date).getTime();
      });

      console.log('Final sorted opportunities:', sortedOpportunities);
      return sortedOpportunities;

    } catch (error) {
      console.error("Error fetching opportunities:", error);
      throw error;
    }
  },

  async getUserAssignments(userId: string) {
    try {
      const now = new Date().toISOString();
      
      console.log('Fetching assignments for user:', userId);
      
      const { data: assignments, error } = await supabase
        .from('ticket_assignments')
        .select(`
          *,
          tickets (
            id,
            title,
            description,
            event_date,
            duration,
            location,
            priority,
            status,
            current_volunteers,
            max_volunteers,
            teams (
              id,
              name,
              description
            )
          )
        `)
        .eq('agent_id', userId)
        .eq('active', true)
        .gte('tickets.event_date', now)
        .not('tickets.status', 'eq', 'cancelled');

      if (error) throw error;

      console.log('Raw assignments data:', assignments);

      // Add formatted time information to assignments
      const assignmentsWithFormattedTime = assignments
        .filter(assignment => assignment.tickets) // Filter out any assignments with missing ticket data
        .map(assignment => ({
          ...assignment,
          formattedTime: formatEventTime(assignment.tickets.event_date, assignment.tickets.duration)
        }));

      console.log('Formatted assignments:', assignmentsWithFormattedTime);

      // Sort by date and priority
      return assignmentsWithFormattedTime.sort((a, b) => {
        // First sort by priority (higher priority first)
        const priorityDiff = (b.tickets?.priority || 0) - (a.tickets?.priority || 0);
        if (priorityDiff !== 0) return priorityDiff;
        // Then sort by date
        return new Date(a.tickets?.event_date || '').getTime() - new Date(b.tickets?.event_date || '').getTime();
      });

    } catch (error) {
      console.error("Error fetching user assignments:", error);
      throw error;
    }
  },

  async signUpForOpportunity(userId: string, ticketId: string) {
    try {
      // Start a transaction
      const { data: ticket, error: ticketError } = await supabase
        .from('tickets')
        .select('*, teams(name)')
        .eq('id', ticketId)
        .single();

      if (ticketError) throw ticketError;

      // Check if ticket is still available
      if (ticket.current_volunteers >= ticket.max_volunteers) {
        return {
          success: false,
          message: "This opportunity is no longer available."
        };
      }

      // Check for existing assignment
      const { data: existingAssignment, error: assignmentError } = await supabase
        .from('ticket_assignments')
        .select('*')
        .eq('agent_id', userId)
        .eq('ticket_id', ticketId)
        .eq('active', true)
        .single();

      if (assignmentError && assignmentError.code !== 'PGRST116') { // PGRST116 is "not found" which is expected
        throw assignmentError;
      }

      if (existingAssignment) {
        return {
          success: false,
          message: "You are already signed up for this opportunity."
        };
      }

      // Create assignment and update ticket in a transaction
      const { data: assignment, error: createError } = await supabase
        .from('ticket_assignments')
        .insert([
          {
            ticket_id: ticketId,
            agent_id: userId,
            active: true
          }
        ])
        .select()
        .single();

      if (createError) throw createError;

      // Update ticket volunteer count
      const { error: updateError } = await supabase
        .from('tickets')
        .update({ 
          current_volunteers: ticket.current_volunteers + 1
        })
        .eq('id', ticketId);

      if (updateError) throw updateError;

      return {
        success: true,
        message: `Successfully signed up for ${ticket.title} with ${ticket.teams?.name}!`,
        assignment
      };

    } catch (error) {
      console.error("Error signing up for opportunity:", error);
      throw error;
    }
  }
}; 