import { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import type { Database } from "../../types/supabase";

type Assignment = Database['public']['Tables']['ticket_assignments']['Row'] & {
  agent_details: {
    first_name: string;
    last_name: string;
  } | null;
};

interface TicketAssignmentProps {
  ticketId: string;
}

export function TicketAssignment({ ticketId }: TicketAssignmentProps) {
  const [currentAssignment, setCurrentAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ticketId) {
      fetchCurrentAssignment();
    }
  }, [ticketId]);

  const fetchCurrentAssignment = async () => {
    try {
      setLoading(true);
      setError(null);

      // First get the assignment with the agent_id
      const { data: assignmentData, error: assignmentError } = await supabase
        .from('ticket_assignments')
        .select('*')
        .eq('ticket_id', ticketId)
        .eq('active', true)
        .single();

      if (assignmentError) {
        if (assignmentError.code === 'PGRST116') {
          // No assignment found - this is okay
          setCurrentAssignment(null);
          return;
        }
        throw assignmentError;
      }

      // Then get the user details from user_roles using the agent_id
      if (assignmentData) {
        const { data: userRoleData, error: userRoleError } = await supabase
          .from('user_roles')
          .select('first_name, last_name')
          .eq('user_id', assignmentData.agent_id)
          .single();

        if (userRoleError) throw userRoleError;

        setCurrentAssignment({
          ...assignmentData,
          agent_details: userRoleData
        });
      }
    } catch (err) {
      console.error('Error fetching ticket assignment:', err);
      setError(err instanceof Error ? err.message : 'Failed to load assignment');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading assignment...</div>;
  }

  if (error) {
    return <div className="text-sm text-red-500">Error: {error}</div>;
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-muted-foreground">Assigned To</h3>
      {currentAssignment ? (
        <div className="text-sm">
          {currentAssignment.agent_details?.first_name} {currentAssignment.agent_details?.last_name}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">Unassigned</div>
      )}
    </div>
  );
} 