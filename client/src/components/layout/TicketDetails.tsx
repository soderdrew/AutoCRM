import { useEffect, useState } from "react";
import { Badge } from "../ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { supabase } from "../../supabaseClient";
import type { Database } from "../../types/supabase";
import { format } from "date-fns";
import { useToast } from "../../hooks/use-toast";

type Ticket = Database['public']['Tables']['tickets']['Row'] & {
  customer: {
    first_name: string;
    last_name: string;
    company: string | null;
  } | null;
  team: {
    name: string;
  } | null;
};

interface TicketDetailsProps {
  ticketId: string | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusColors = {
  open: "bg-yellow-100 text-yellow-800",
  in_progress: "bg-blue-100 text-blue-800",
  waiting: "bg-purple-100 text-purple-800",
  resolved: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-800",
};

const priorityColors = {
  low: "bg-gray-100 text-gray-800",
  medium: "bg-orange-100 text-orange-800",
  high: "bg-red-100 text-red-800",
  urgent: "bg-red-200 text-red-900",
};

type Status = keyof typeof statusColors;
type Priority = keyof typeof priorityColors;

export function TicketDetails({ ticketId, isOpen, onOpenChange }: TicketDetailsProps) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (ticketId && isOpen) {
      fetchTicketDetails();
      fetchUserRole();
    }
  }, [ticketId, isOpen]);

  const fetchUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (roleData) {
        setUserRole(roleData.role);
      }
    } catch (err) {
      console.error('Error fetching user role:', err);
    }
  };

  const fetchTicketDetails = async () => {
    if (!ticketId) return;

    try {
      setLoading(true);
      setError(null);

      // First, get the ticket details
      const { data: ticketData, error: ticketError } = await supabase
        .from('tickets')
        .select(`
          *,
          team:teams(name)
        `)
        .eq('id', ticketId)
        .single();

      if (ticketError) throw ticketError;

      // Then, get the customer details
      const { data: customerData, error: customerError } = await supabase
        .from('user_roles')
        .select('first_name, last_name, company')
        .eq('user_id', ticketData.customer_id)
        .single();

      if (customerError) throw customerError;

      // Combine the data
      const transformedData = {
        ...ticketData,
        customer: customerData,
        team: ticketData.team?.[0] || null
      };

      setTicket(transformedData);
    } catch (err) {
      console.error('Error fetching ticket details:', err);
      setError(err instanceof Error ? err.message : 'Failed to load ticket details');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: Status) => {
    if (!ticket || updating) return;

    try {
      setUpdating(true);
      const { error: updateError } = await supabase
        .from('tickets')
        .update({ 
          status: newStatus,
          ...(newStatus === 'resolved' ? { resolved_at: new Date().toISOString() } : {}),
          ...(newStatus === 'closed' ? { closed_at: new Date().toISOString() } : {}),
          ...(['open', 'in_progress', 'waiting'].includes(newStatus) ? { 
            resolved_at: null,
            closed_at: null 
          } : {})
        })
        .eq('id', ticket.id);

      if (updateError) throw updateError;

      // Update local state
      setTicket(prev => {
        if (!prev) return null;
        return { 
          ...prev, 
          status: newStatus,
          resolved_at: newStatus === 'resolved' 
            ? new Date().toISOString() 
            : ['open', 'in_progress', 'waiting'].includes(newStatus) 
              ? null 
              : prev.resolved_at,
          closed_at: newStatus === 'closed'
            ? new Date().toISOString()
            : ['open', 'in_progress', 'waiting'].includes(newStatus)
              ? null
              : prev.closed_at
        };
      });
      
      toast({
        title: "Status Updated",
        description: `Ticket status changed to ${newStatus.replace('_', ' ')}.`,
      });

      // Refresh ticket details to get updated timestamps
      fetchTicketDetails();
    } catch (err) {
      console.error('Error updating ticket status:', err);
      toast({
        title: "Error",
        description: "Failed to update ticket status. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  const handlePriorityChange = async (newPriority: Priority) => {
    if (!ticket || updating) return;

    try {
      setUpdating(true);
      const { error: updateError } = await supabase
        .from('tickets')
        .update({ priority: newPriority })
        .eq('id', ticket.id);

      if (updateError) throw updateError;

      // Update local state
      setTicket(prev => {
        if (!prev) return null;
        return { 
          ...prev, 
          priority: newPriority,
        };
      });
      
      toast({
        title: "Priority Updated",
        description: `Ticket priority changed to ${newPriority}.`,
      });

      // Refresh ticket details
      fetchTicketDetails();
    } catch (err) {
      console.error('Error updating ticket priority:', err);
      toast({
        title: "Error",
        description: "Failed to update ticket priority. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  const canEditTicket = userRole === 'admin' || userRole === 'employee';

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        {loading ? (
          <>
            <DialogHeader>
              <DialogTitle>Loading Ticket Details</DialogTitle>
              <DialogDescription>Please wait while we fetch the ticket information.</DialogDescription>
            </DialogHeader>
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          </>
        ) : error ? (
          <>
            <DialogHeader>
              <DialogTitle>Error Loading Ticket</DialogTitle>
              <DialogDescription className="text-red-500">{error}</DialogDescription>
            </DialogHeader>
          </>
        ) : ticket ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold">
                {ticket.title}
              </DialogTitle>
              <DialogDescription>
                Ticket #{ticket.id.slice(-8)}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Status and Priority */}
              <div className="flex items-center gap-6">
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">Status</h3>
                  {canEditTicket ? (
                    <Select
                      value={ticket.status}
                      onValueChange={(value: Status) => handleStatusChange(value)}
                      disabled={updating}
                    >
                      <SelectTrigger className={`w-[140px] ${statusColors[ticket.status]}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="waiting">Waiting</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge className={statusColors[ticket.status]}>
                      {ticket.status.replace("_", " ")}
                    </Badge>
                  )}
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">Priority</h3>
                  {canEditTicket ? (
                    <Select
                      value={ticket.priority}
                      onValueChange={(value: Priority) => handlePriorityChange(value)}
                      disabled={updating}
                    >
                      <SelectTrigger className={`w-[140px] ${priorityColors[ticket.priority]}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge className={priorityColors[ticket.priority]}>
                      {ticket.priority}
                    </Badge>
                  )}
                </div>

                {ticket.team && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-muted-foreground">Team</h3>
                    <Badge variant="outline">
                      {ticket.team.name}
                    </Badge>
                  </div>
                )}
              </div>

              {/* Customer Information */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">Customer</h3>
                <p className="text-sm">
                  {ticket.customer
                    ? `${ticket.customer.first_name} ${ticket.customer.last_name}${
                        ticket.customer.company ? ` · ${ticket.customer.company}` : ''
                      }`
                    : 'Unknown Customer'}
                </p>
              </div>

              {/* Description */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">Description</h3>
                <p className="text-sm whitespace-pre-wrap">{ticket.description}</p>
              </div>

              {/* Tags */}
              {ticket.tags && ticket.tags.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {ticket.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Timestamps */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Created</h3>
                  <p>{format(new Date(ticket.created_at), 'PPpp')}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Last Updated</h3>
                  <p>{format(new Date(ticket.updated_at), 'PPpp')}</p>
                </div>
                {ticket.resolved_at && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Resolved</h3>
                    <p>{format(new Date(ticket.resolved_at), 'PPpp')}</p>
                  </div>
                )}
                {ticket.closed_at && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Closed</h3>
                    <p>{format(new Date(ticket.closed_at), 'PPpp')}</p>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
} 