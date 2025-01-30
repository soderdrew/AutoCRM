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

  async findTicketByName(query: string): Promise<string | null> {
    try {
      console.log('Finding ticket by name:', query);
      const now = new Date().toISOString();

      // Clean up the query - remove common words and normalize
      const cleanQuery = query.toLowerCase()
        .replace(/opportunity|event/g, '')
        .trim();
      
      console.log('Cleaned query:', cleanQuery);

      // Search for tickets matching the query in title
      const { data: tickets, error } = await supabase
        .from('tickets')
        .select('id, title, status, current_volunteers, max_volunteers')
        .or(`title.ilike.%${cleanQuery}%,title.ilike.%${query}%`)
        .gte('event_date', now)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) {
        console.error('Error finding tickets:', error);
        throw error;
      }

      console.log('Found matching tickets:', tickets?.map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        volunteers: `${t.current_volunteers}/${t.max_volunteers}`
      })));

      // Filter out closed/resolved tickets and get the first valid match
      const validTickets = tickets?.filter(ticket => 
        !['closed', 'resolved', 'cancelled'].includes(ticket.status.toLowerCase())
      );

      console.log('Valid tickets after status filter:', validTickets?.map(t => ({
        id: t.id,
        title: t.title,
        status: t.status
      })));

      if (!validTickets?.length) {
        console.log('No valid tickets found for query:', query);
        return null;
      }

      // Try to find the best match
      const bestMatch = validTickets.find(ticket => 
        ticket.title.toLowerCase().includes(cleanQuery) ||
        ticket.title.toLowerCase().includes(query.toLowerCase())
      );

      if (bestMatch) {
        console.log('Found best matching ticket:', {
          id: bestMatch.id,
          title: bestMatch.title,
          status: bestMatch.status
        });
        return bestMatch.id;
      }

      // If no best match, return the first valid ticket
      console.log('Using first valid ticket as fallback:', {
        id: validTickets[0].id,
        title: validTickets[0].title,
        status: validTickets[0].status
      });
      return validTickets[0].id;
    } catch (error) {
      console.error('Error in findTicketByName:', error);
      return null;
    }
  },

  async signUpForOpportunity(userId: string, ticketId: string) {
    try {
      console.log('Starting signup process:', { userId, ticketId });

      // If ticketId doesn't look like a UUID, try to find the actual ticket ID first
      if (!ticketId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        console.log('Input is not a UUID, searching for ticket by name...');
        const actualTicketId = await this.findTicketByName(ticketId);
        if (!actualTicketId) {
          throw new Error('Could not find the specified opportunity. Please check the name and try again.');
        }
        console.log('Found actual ticket ID:', actualTicketId);
        ticketId = actualTicketId;
      }

      // Get ticket details
      const { data: ticket, error: ticketError } = await supabase
        .from('tickets')
        .select('*, teams(name)')
        .eq('id', ticketId)
        .single();

      if (ticketError) {
        console.error('Error fetching ticket:', ticketError);
        throw ticketError;
      }

      console.log('Ticket details:', ticket);

      // Check ticket status
      console.log('Checking ticket status:', ticket.status);
      if (ticket.status === 'in_progress') {
        console.log('Signup rejected: Opportunity in progress');
        return {
          success: false,
          message: "This opportunity is already in progress. Please look for other available opportunities."
        };
      }

      if (ticket.status === 'closed' || ticket.status === 'resolved') {
        console.log('Signup rejected: Opportunity no longer available');
        return {
          success: false,
          message: "This opportunity is no longer available."
        };
      }

      // Check if opportunity is full
      console.log('Checking volunteer capacity:', {
        current: ticket.current_volunteers,
        max: ticket.max_volunteers
      });
      if (ticket.current_volunteers >= ticket.max_volunteers) {
        console.log('Signup rejected: Opportunity is full');
        return {
          success: false,
          message: "This opportunity has reached its maximum number of volunteers."
        };
      }

      // Check for existing assignment
      console.log('Checking for existing assignment...');
      const { data: existingAssignment, error: assignmentError } = await supabase
        .from('ticket_assignments')
        .select('*')
        .eq('agent_id', userId)
        .eq('ticket_id', ticket.id)
        .single();

      if (assignmentError && assignmentError.code !== 'PGRST116') {
        console.error('Error checking existing assignment:', assignmentError);
        throw assignmentError;
      }

      console.log('Existing assignment check result:', existingAssignment);

      if (existingAssignment?.active) {
        console.log('Signup rejected: Already signed up');
        return {
          success: false,
          message: "You are already signed up for this opportunity."
        };
      }

      // If there's an inactive assignment, reactivate it
      if (existingAssignment) {
        console.log('Reactivating existing assignment...');
        const { error: updateError } = await supabase
          .from('ticket_assignments')
          .update({ active: true })
          .eq('id', existingAssignment.id);

        if (updateError) {
          console.error('Error reactivating assignment:', updateError);
          throw updateError;
        }
      } else {
        // Create new assignment
        console.log('Creating new assignment...');
        const { error: createError } = await supabase
          .from('ticket_assignments')
          .insert([
            {
              ticket_id: ticket.id,
              agent_id: userId,
              active: true
            }
          ]);

        if (createError) {
          console.error('Error creating assignment:', createError);
          throw createError;
        }
      }

      // Update volunteer count directly
      console.log('Updating volunteer count...');
      const { error: updateCountError } = await supabase
        .from('tickets')
        .update({ 
          current_volunteers: ticket.current_volunteers + 1
        })
        .eq('id', ticket.id);

      if (updateCountError) {
        console.error('Error updating volunteer count:', updateCountError);
        throw updateCountError;
      }

      console.log('Signup successful!');
      return {
        success: true,
        message: `Successfully signed up for ${ticket.title} with ${ticket.teams?.name}!`,
        ticket: {
          ...ticket,
          current_volunteers: ticket.current_volunteers + 1
        }
      };

    } catch (error) {
      console.error("Error signing up for opportunity:", error);
      throw error;
    }
  },

  async findOpportunities(query: string, userId?: string) {
    try {
      console.log('Starting opportunity search with:', { query, userId });
      const now = new Date().toISOString();
      console.log('Searching for events after:', now);

      // Get user's current assignments if userId is provided
      let userAssignments: any[] = [];
      if (userId) {
        const { data: assignments, error: assignmentsError } = await supabase
          .from('ticket_assignments')
          .select('ticket_id')
          .eq('agent_id', userId)
          .eq('active', true);

        if (!assignmentsError && assignments) {
          userAssignments = assignments;
          console.log('Found user assignments:', {
            count: assignments.length,
            assignments: assignments.map(a => a.ticket_id)
          });
        } else if (assignmentsError) {
          console.warn('Error fetching user assignments:', assignmentsError);
        }
      }

      console.log('Searching tickets with query:', {
        titlePattern: `%${query}%`,
        descriptionPattern: `%${query}%`
      });

      // Search for tickets matching the query in title or description
      const { data: tickets, error } = await supabase
        .from('tickets')
        .select(`
          *,
          teams (
            id,
            name,
            description
          )
        `)
        .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
        .gte('event_date', now)
        .not('status', 'in', ['closed', 'resolved', 'cancelled'])
        .order('event_date', { ascending: true });

      if (error) {
        console.error('Error searching for opportunities:', error);
        throw error;
      }

      console.log('Initial search results:', {
        count: tickets?.length || 0,
        tickets: tickets?.map(t => ({
          id: t.id,
          title: t.title,
          status: t.status,
          date: t.event_date,
          volunteers: `${t.current_volunteers}/${t.max_volunteers}`
        }))
      });

      // Filter and format results
      const formattedTickets = tickets
        .filter(ticket => {
          const hasSpace = (ticket.current_volunteers || 0) < (ticket.max_volunteers || 0);
          const alreadySignedUp = userAssignments.some(a => a.ticket_id === ticket.id);
          
          console.log('Filtering ticket:', {
            id: ticket.id,
            title: ticket.title,
            hasSpace,
            currentVolunteers: ticket.current_volunteers,
            maxVolunteers: ticket.max_volunteers,
            alreadySignedUp
          });
          
          return hasSpace && !alreadySignedUp;
        })
        .map(ticket => {
          const formatted = {
            ...ticket,
            formattedTime: formatEventTime(ticket.event_date, ticket.duration)
          };
          console.log('Formatted ticket:', {
            id: formatted.id,
            title: formatted.title,
            time: formatted.formattedTime.fullTimespan
          });
          return formatted;
        });

      console.log('Final filtered and formatted results:', {
        count: formattedTickets.length,
        opportunities: formattedTickets.map(t => ({
          id: t.id,
          title: t.title,
          date: t.formattedTime.startTime,
          duration: t.formattedTime.durationText,
          volunteers: `${t.current_volunteers}/${t.max_volunteers}`
        }))
      });

      return formattedTickets;
    } catch (error) {
      console.error('Error in findOpportunities:', error);
      throw error;
    }
  },

  async leaveOpportunity(userId: string, ticketId: string) {
    try {
      console.log('Starting leave opportunity process:', { userId, ticketId });

      // If ticketId doesn't look like a UUID, try to find it from user's assignments
      if (!ticketId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        console.log('Input is not a UUID, searching in user assignments...');
        
        // Get user's current assignments with ticket details
        const { data: assignments, error: assignmentsError } = await supabase
          .from('ticket_assignments')
          .select(`
            *,
            tickets (
              id,
              title,
              status
            )
          `)
          .eq('agent_id', userId)
          .eq('active', true);

        if (assignmentsError) {
          console.error('Error fetching assignments:', assignmentsError);
          throw assignmentsError;
        }

        // Find the assignment with a matching ticket title
        const matchingAssignment = assignments?.find(assignment => 
          assignment.tickets?.title.toLowerCase().includes(ticketId.toLowerCase())
        );

        if (!matchingAssignment?.tickets?.id) {
          console.log('No matching assignment found');
          throw new Error('Could not find an active assignment matching that opportunity. Please check that you are signed up for this opportunity.');
        }

        console.log('Found matching assignment:', {
          ticketId: matchingAssignment.tickets.id,
          title: matchingAssignment.tickets.title
        });
        
        ticketId = matchingAssignment.tickets.id;
      }

      // Start a Supabase transaction
      const { data: result, error: txError } = await supabase.rpc('leave_opportunity', {
        p_user_id: userId,
        p_ticket_id: ticketId
      });

      if (txError) {
        console.error('Error in leave opportunity transaction:', txError);
        throw txError;
      }

      console.log('Transaction result:', result);

      if (result.success === false) {
        return {
          success: false,
          message: result.message
        };
      }

      return {
        success: true,
        message: `You have successfully left the ${result.ticket_title} opportunity.`,
        ticket: result.ticket
      };

    } catch (error) {
      console.error("Error leaving opportunity:", error);
      throw error;
    }
  }
}; 