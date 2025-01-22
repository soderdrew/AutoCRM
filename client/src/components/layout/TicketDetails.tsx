import { useEffect, useState } from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { ScrollArea } from "../ui/scroll-area";
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
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";

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
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isInternalComment, setIsInternalComment] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [commentToDelete, setCommentToDelete] = useState<Comment | null>(null);

  useEffect(() => {
    if (ticketId && isOpen) {
      fetchTicketDetails();
      fetchUserRole();
      fetchComments();
      fetchCurrentUser();
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

  const fetchComments = async () => {
    if (!ticketId) return;

    try {
      const { data: commentsData, error: commentsError } = await supabase
        .from('ticket_comments')
        .select(`
          id,
          ticket_id,
          user_id,
          content,
          is_internal,
          created_at,
          updated_at
        `)
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (commentsError) throw commentsError;

      // Fetch user details for each comment
      const commentsWithUsers = await Promise.all((commentsData || []).map(async (comment) => {
        const { data: userData, error: userError } = await supabase
          .from('user_roles')
          .select('first_name, last_name')
          .eq('user_id', comment.user_id)
          .single();

        if (userError) {
          console.error('Error fetching user details:', userError);
          return {
            ...comment,
            user: null
          };
        }

        return {
          ...comment,
          user: userData
        };
      }));

      setComments(commentsWithUsers);
    } catch (err) {
      console.error('Error fetching comments:', err);
      toast({
        title: "Error",
        description: "Failed to load ticket comments",
        variant: "destructive",
      });
    }
  };

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
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

  const handleCommentSubmit = async () => {
    if (!ticket || !newComment.trim() || submittingComment) return;

    try {
      setSubmittingComment(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const { error: commentError } = await supabase
        .from('ticket_comments')
        .insert({
          ticket_id: ticket.id,
          user_id: user.id,
          content: newComment.trim(),
          is_internal: isInternalComment
        });

      if (commentError) throw commentError;

      // Clear form and refresh comments
      setNewComment("");
      setIsInternalComment(false);
      fetchComments();

      toast({
        title: "Comment Added",
        description: "Your comment has been successfully added to the ticket.",
      });
    } catch (err) {
      console.error('Error adding comment:', err);
      toast({
        title: "Error",
        description: "Failed to add comment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async () => {
    console.log('Delete comment function called', { commentToDelete });
    if (!commentToDelete) {
      console.log('No comment to delete');
      return;
    }

    try {
      console.log('Attempting to delete comment:', commentToDelete.id);
      const { error: deleteError } = await supabase
        .from('ticket_comments')
        .delete()
        .eq('id', commentToDelete.id)
        .eq('user_id', currentUserId); // Extra safety check

      if (deleteError) {
        console.error('Error deleting comment:', deleteError);
        throw deleteError;
      }

      console.log('Comment deleted successfully');
      toast({
        title: "Comment Deleted",
        description: "Your comment has been successfully deleted.",
      });

      // Refresh comments
      await fetchComments();
    } catch (err) {
      console.error('Error deleting comment:', err);
      toast({
        title: "Error",
        description: "Failed to delete comment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCommentToDelete(null);
    }
  };

  const canEditTicket = userRole === 'admin' || userRole === 'employee';

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
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
            <DialogHeader className="pb-4">
              <DialogTitle className="text-xl font-semibold">
                {ticket.title}
              </DialogTitle>
              <DialogDescription>
                Ticket #{ticket.id.slice(-8)}
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="max-h-[calc(90vh-8rem)] pr-4">
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

                {/* Comments Section */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold mb-4">Comments</h3>
                  <div className="space-y-4">
                    {comments.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No comments yet.</p>
                    ) : (
                      comments.map((comment) => (
                        <div 
                          key={comment.id} 
                          className={`p-4 rounded-lg ${
                            comment.is_internal 
                              ? 'bg-yellow-50 border border-yellow-200' 
                              : 'bg-gray-50 border border-gray-200'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">
                                {comment.user 
                                  ? `${comment.user.first_name} ${comment.user.last_name}`
                                  : 'Unknown User'}
                              </span>
                              {comment.is_internal && (
                                <Badge variant="secondary" className="text-xs">
                                  Internal Note
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(comment.created_at), 'PPpp')}
                              </span>
                              {comment.user_id === currentUserId && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                  onClick={() => setCommentToDelete(comment)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                        </div>
                      ))
                    )}

                    {/* Delete Comment Confirmation Dialog */}
                    <AlertDialog 
                      open={!!commentToDelete} 
                      onOpenChange={(open) => !open && setCommentToDelete(null)}
                    >
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Comment</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this comment? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <Button
                            variant="destructive"
                            onClick={handleDeleteComment}
                          >
                            Delete
                          </Button>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                    {/* Add Comment Form */}
                    <div className="border-t pt-4 mt-6">
                      <div className="space-y-4">
                        <Textarea
                          placeholder="Add a comment..."
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          className="min-h-[100px]"
                        />
                        <div className="flex items-center justify-between">
                          {(userRole === 'admin' || userRole === 'employee') && (
                            <div className="flex items-center space-x-2">
                              <Switch
                                id="internal-comment"
                                checked={isInternalComment}
                                onCheckedChange={setIsInternalComment}
                              />
                              <Label htmlFor="internal-comment">Internal Comment</Label>
                            </div>
                          )}
                          <Button 
                            onClick={handleCommentSubmit}
                            disabled={!newComment.trim() || submittingComment}
                          >
                            {submittingComment ? "Adding..." : "Add Comment"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
} 