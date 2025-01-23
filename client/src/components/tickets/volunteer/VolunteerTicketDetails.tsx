import { useEffect, useState } from "react";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Textarea } from "../../ui/textarea";
import { ScrollArea } from "../../ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../../ui/dialog";
import { supabase } from "../../../supabaseClient";
import type { Database } from "../../../types/supabase";
import { format } from "date-fns";
import { useToast } from "../../../hooks/use-toast";
import { Trash2 } from "lucide-react";

// Define the status type that matches what's in the database
type DatabaseTicketStatus = 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed' | 'assigned';

type Ticket = Omit<Database['public']['Tables']['tickets']['Row'], 'status'> & {
  status: DatabaseTicketStatus;
  customer: {
    first_name: string;
    last_name: string;
    company: string | null;
  } | null;
  team: {
    name: string;
  } | null;
};

type Comment = Database['public']['Tables']['ticket_comments']['Row'] & {
  user: {
    first_name: string;
    last_name: string;
  } | null;
};

interface TicketDetailsProps {
  ticketId: string | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onAssignmentChange?: () => void;
}

const statusColors: Record<DatabaseTicketStatus, string> = {
  open: "bg-yellow-100 text-yellow-800",
  in_progress: "bg-blue-100 text-blue-800",
  waiting: "bg-purple-100 text-purple-800",
  resolved: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-800",
  assigned: "bg-blue-100 text-blue-800",
};

const priorityColors = {
  low: "bg-gray-100 text-gray-800",
  medium: "bg-orange-100 text-orange-800",
  high: "bg-red-100 text-red-800",
  urgent: "bg-red-200 text-red-900",
};

export function VolunteerTicketDetails({ ticketId, isOpen, onOpenChange, onAssignmentChange }: TicketDetailsProps) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAssigned, setIsAssigned] = useState(false);
  const [updating, setUpdating] = useState(false);
  const { toast } = useToast();

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
    if (!ticketId) return;

    const fetchTicketDetails = async () => {
      try {
        setLoading(true);
        setError(null);

        // First fetch the ticket
        const { data: ticketData, error: ticketError } = await supabase
          .from('tickets')
          .select(`
            *,
            team:teams(*)
          `)
          .eq('id', ticketId)
          .single();

        if (ticketError) throw ticketError;

        // Then fetch the customer details from user_roles
        if (ticketData.customer_id) {
            console.log('Fetching customer details for customer_id:', ticketData.customer_id);
            const { data: customerData, error: customerError } = await supabase
                .from('user_roles')
                .select('first_name, last_name, company')
                .eq('user_id', ticketData.customer_id)
                .eq('role', 'customer')  // Only get customer role
                .single();

            console.log('Customer query result:', { customerData, customerError });

            if (customerError) {
                console.error('Error fetching customer details:', customerError);
                console.log('Setting ticket with null customer due to error');
                setTicket({
                    ...ticketData,
                    customer: null
                });
            } else {
                console.log('Setting ticket with customer data:', customerData);
                setTicket({
                    ...ticketData,
                    customer: {
                        first_name: customerData.first_name || '',  // Use first_name as company if needed
                        last_name: customerData.last_name || '',
                        company: customerData.company || customerData.first_name || null  // Fall back to first_name for company
                    }
                });
            }
        } else {
            console.log('No customer_id found in ticket data:', ticketData);
            setTicket({
                ...ticketData,
                customer: null
            });
        }

        // Check if user is assigned
        if (currentUserId) {
          const { data: assignmentData } = await supabase
            .from('ticket_assignments')
            .select('*')
            .eq('ticket_id', ticketId)
            .eq('agent_id', currentUserId)
            .eq('active', true)  // Only consider active assignments
            .single();

          setIsAssigned(!!assignmentData);
        }

        // Fetch comments with user details
        const { data: commentsData, error: commentsError } = await supabase
          .from('ticket_comments')
          .select('*')
          .eq('ticket_id', ticketId)
          .order('created_at', { ascending: true });

        if (commentsError) throw commentsError;

        // Fetch user details for all comments
        if (commentsData && commentsData.length > 0) {
          const userIds = [...new Set(commentsData.map(comment => comment.user_id))];
          const { data: usersData, error: usersError } = await supabase
            .from('user_roles')
            .select('user_id, first_name, last_name')
            .in('user_id', userIds);

          if (usersError) {
            console.error('Error fetching comment user details:', usersError);
          }

          // Create a map of user_id to user details
          const userMap = new Map(
            usersData?.map(user => [user.user_id, user]) || []
          );

          // Combine comments with user details
          const commentsWithUsers = commentsData.map(comment => ({
            ...comment,
            user: userMap.get(comment.user_id) || null
          }));

          setComments(commentsWithUsers);
        } else {
          setComments([]);
        }

      } catch (err) {
        console.error('Error fetching ticket details:', err);
        setError(err instanceof Error ? err.message : 'Failed to load ticket details');
      } finally {
        setLoading(false);
      }
    };

    fetchTicketDetails();
  }, [ticketId, currentUserId]);

  const handleAssignment = async () => {
    if (!ticket || !currentUserId) return;

    try {
      setUpdating(true);
      console.log('Handling assignment, status:', ticket.status);
      
      if (isAssigned) {
        // Check if ticket is in progress before allowing unassignment
        if (ticket.status === 'in_progress') {
          console.log('Attempting to leave in-progress opportunity');
          setUpdating(false);  // Reset updating state before showing toast
          toast({
            title: "Cannot Leave Opportunity",
            description: "You cannot leave an opportunity that is in progress. Please contact the organization if you need to make changes.",
            variant: "destructive",
            duration: 5000,  // Show for longer
          });
          return;
        }

        // Update assignment to inactive instead of deleting
        const { error: updateError } = await supabase
          .from('ticket_assignments')
          .update({ active: false })
          .eq('ticket_id', ticket.id)
          .eq('agent_id', currentUserId);

        if (updateError) throw updateError;

        setIsAssigned(false);
        toast({
          title: "Left opportunity",
          description: "You have been removed from this opportunity.",
        });

        // Update ticket status if it was assigned to you
        if (ticket.status === 'assigned') {
          const { error: updateTicketError } = await supabase
            .from('tickets')
            .update({ status: 'open' })
            .eq('id', ticket.id);

          if (updateTicketError) {
            console.error('Error updating ticket status:', updateTicketError);
          }
        }
      } else {
        // Check if ticket is still available
        const { data: currentTicket, error: checkError } = await supabase
          .from('tickets')
          .select('status')
          .eq('id', ticket.id)
          .single();

        if (checkError) throw checkError;

        if (currentTicket.status === 'closed' || currentTicket.status === 'resolved') {
          toast({
            title: "Opportunity unavailable",
            description: "This opportunity is no longer available.",
            variant: "destructive",
          });
          return;
        }

        // Add check for in-progress status
        if (currentTicket.status === 'in_progress') {
          toast({
            title: "Cannot Join Opportunity",
            description: "This opportunity is already in progress. Please look for other available opportunities.",
            variant: "destructive",
            duration: 5000,
          });
          return;
        }

        // Add assignment
        const { error: insertError } = await supabase
          .from('ticket_assignments')
          .insert([
            {
              ticket_id: ticket.id,
              agent_id: currentUserId,
              active: true
            },
          ]);

        if (insertError) {
          // Check if it's a duplicate assignment
          if (insertError.code === '23505') {  // Unique violation
            toast({
              title: "Already signed up",
              description: "You are already signed up for this opportunity.",
              variant: "destructive",
            });
            return;
          }
          throw insertError;
        }

        setIsAssigned(true);
        toast({
          title: "Signed up successfully",
          description: "You have been assigned to this opportunity.",
        });
      }

      // Notify parent component to refresh
      if (onAssignmentChange) {
        onAssignmentChange();
      }
    } catch (err) {
      console.error('Error updating assignment:', err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update assignment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleCommentSubmit = async () => {
    if (!ticket || !currentUserId || !newComment.trim()) return;

    try {
      setUpdating(true);
      const { error: commentError } = await supabase
        .from('ticket_comments')
        .insert([
          {
            ticket_id: ticket.id,
            user_id: currentUserId,
            content: newComment.trim(),
            is_internal: false,
          },
        ]);

      if (commentError) throw commentError;

      // Refresh comments
      const { data: commentsData, error: refreshError } = await supabase
        .from('ticket_comments')
        .select('*, user:user_roles!user_id(*)')
        .eq('ticket_id', ticket.id)
        .order('created_at', { ascending: true });

      if (refreshError) throw refreshError;
      setComments(commentsData);
      setNewComment("");
      
      toast({
        title: "Comment added",
        description: "Your comment has been added successfully.",
      });
    } catch (err) {
      console.error('Error adding comment:', err);
      toast({
        title: "Error",
        description: "Failed to add comment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[90vh] flex flex-col">
        <DialogHeader className="flex-none px-6 py-4">
          <DialogTitle>Opportunity Details</DialogTitle>
          <DialogDescription>
            View opportunity details and sign up to volunteer
          </DialogDescription>
        </DialogHeader>
        
        {loading && (
          <div className="flex-none flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        )}

        {error && (
          <div className="flex-none text-red-500 text-center py-8">
            {error}
          </div>
        )}

        {ticket && !loading && (
          <div className="flex-1 min-h-0">
            <ScrollArea className="h-full px-6">
              <div className="space-y-6 pr-4 pb-6">
                <div>
                  <h2 className="text-xl font-semibold mb-1">{ticket.title}</h2>
                  <p className="text-sm text-muted-foreground">
                    Created {format(new Date(ticket.created_at), "PPP")}
                  </p>
                </div>
                
                {/* Status and Priority */}
                <div className="flex items-center gap-6">
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-muted-foreground">Status</h3>
                    <Badge className={statusColors[ticket.status as DatabaseTicketStatus]}>
                      {ticket.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-muted-foreground">Priority</h3>
                    <Badge className={priorityColors[ticket.priority]}>
                      {ticket.priority}
                    </Badge>
                  </div>
                </div>

                {/* Organization Information */}
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Organization</h3>
                  <p className="text-sm">
                    {ticket.customer
                      ? ticket.customer.company || ticket.customer.first_name
                      : 'Unknown Organization'}
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

                {/* Assignment Section */}
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">Status</h3>
                  <div className="flex items-center justify-between">
                    <p className="text-sm">
                      {isAssigned ? (
                        <span className="text-green-600 font-medium">
                          You are signed up for this opportunity
                        </span>
                      ) : (
                        <span className="text-gray-600">
                          You haven't signed up yet
                        </span>
                      )}
                    </p>
                    <Button
                      variant={isAssigned ? "destructive" : "default"}
                      onClick={handleAssignment}
                      disabled={updating || ticket.status === 'closed' || ticket.status === 'resolved'}
                      size="sm"
                      className={isAssigned && ticket.status === 'in_progress' ? 'opacity-80 hover:opacity-100 cursor-pointer' : ''}
                    >
                      {updating ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      ) : isAssigned ? (
                        "Leave"
                      ) : (
                        "Sign Up"
                      )}
                    </Button>
                  </div>
                </div>

                {/* Comments */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-muted-foreground">Comments</h3>
                  <div className="space-y-4">
                    {comments.map((comment) => (
                      <div
                        key={comment.id}
                        className="p-4 rounded-lg border border-gray-200 bg-white"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">
                            {comment.user
                              ? `${comment.user.first_name} ${comment.user.last_name}`                            : 'Unknown User'}
                          </span>
                          <div className="flex items-center gap-4">
                            <span className="text-sm text-gray-500">
                              {format(new Date(comment.created_at), 'PPp')}
                            </span>
                            {comment.user_id === currentUserId && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={async () => {
                                  try {
                                    await supabase
                                      .from('ticket_comments')
                                      .delete()
                                      .eq('id', comment.id);
                                    setComments(comments.filter(c => c.id !== comment.id));
                                    toast({
                                      title: "Comment deleted",
                                      description: "Your comment has been deleted.",
                                    });
                                  } catch (err) {
                                    toast({
                                      title: "Error",
                                      description: "Failed to delete comment.",
                                      variant: "destructive",
                                    });
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                      </div>
                    ))}
                  </div>

                  {/* New Comment */}
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Add a comment..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      className="min-h-[100px]"
                    />
                    <Button
                      onClick={handleCommentSubmit}
                      disabled={updating || !newComment.trim()}
                    >
                      {updating ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      ) : (
                        "Add Comment"
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
} 
