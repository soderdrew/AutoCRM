import { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import type { Database } from "../../types/supabase";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { useToast } from "../../hooks/use-toast";

type Assignment = Database['public']['Tables']['ticket_assignments']['Row'] & {
  agent_details: {
    first_name: string;
    last_name: string;
  } | null;
};

type Employee = {
  user_id: string;
  first_name: string;
  last_name: string;
};

interface TicketAssignmentProps {
  ticketId: string;
}

export function TicketAssignment({ ticketId }: TicketAssignmentProps) {
  const [currentAssignment, setCurrentAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [updating, setUpdating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (ticketId) {
      fetchCurrentAssignment();
      fetchUserRole();
    }
  }, [ticketId]);

  useEffect(() => {
    if (userRole === 'admin') {
      fetchEmployees();
    }
  }, [userRole]);

  const fetchEmployees = async () => {
    try {
      const { data: employeeData, error: employeeError } = await supabase
        .from('user_roles')
        .select(`
          user_id:user_id,
          first_name,
          last_name
        `)
        .in('role', ['admin', 'employee'])
        .eq('is_active', true)
        .order('first_name', { ascending: true });

      if (employeeError) throw employeeError;

      setEmployees(employeeData || []);
    } catch (err) {
      console.error('Error fetching employees:', err);
      toast({
        title: "Error",
        description: "Failed to load employee list",
        variant: "destructive",
      });
    }
  };

  const handleAssignmentChange = async (newAgentId: string | null) => {
    if (!ticketId || updating) return;

    try {
      setUpdating(true);

      // If there's a current assignment, mark it as inactive
      if (currentAssignment) {
        const { error: updateError } = await supabase
          .from('ticket_assignments')
          .update({ active: false })
          .eq('id', currentAssignment.id);

        if (updateError) throw updateError;
        
        // If we're unassigning (newAgentId is null), set currentAssignment to null
        if (!newAgentId) {
          setCurrentAssignment(null);
        }
      }

      // If we're assigning to someone (not unassigning)
      if (newAgentId) {
        // Explicitly insert only to ticket_assignments
        const { error: insertError } = await supabase
          .from('ticket_assignments')
          .insert({
            ticket_id: ticketId,
            agent_id: newAgentId,
            active: true
          });

        if (insertError) throw insertError;
        
        // Then fetch the current assignment which we know works
        await fetchCurrentAssignment();
      }

      toast({
        title: "Success",
        description: newAgentId 
          ? "Ticket assigned successfully" 
          : "Ticket unassigned successfully",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to update ticket assignment",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  const fetchUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setCurrentUserId(user.id);

      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (roleError) throw roleError;

      if (roleData) {
        setUserRole(roleData.role);
      }
    } catch (err) {
      console.error('Error fetching user role:', err);
      // Don't set error state here as it's not critical for display
    }
  };

  const fetchCurrentAssignment = async () => {
    try {
      setLoading(true);
      setError(null);

      // First get the assignment
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

      // Then get the agent details if we have an assignment
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

  // Helper function to check if user can modify assignments
  const canModifyAssignment = () => {
    return userRole === 'admin' || (userRole === 'employee' && !currentAssignment);
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
      {userRole === 'admin' ? (
        <Select
          value={currentAssignment?.agent_id || "unassigned"}
          onValueChange={(value) => handleAssignmentChange(value === "unassigned" ? null : value)}
          disabled={updating}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select agent..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {employees.map((employee) => (
              <SelectItem key={employee.user_id} value={employee.user_id}>
                {employee.first_name} {employee.last_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <div className="text-sm">
          {currentAssignment ? (
            <span>
              {currentAssignment.agent_details?.first_name} {currentAssignment.agent_details?.last_name}
            </span>
          ) : (
            <span className="text-muted-foreground">Unassigned</span>
          )}
        </div>
      )}
    </div>
  );
} 