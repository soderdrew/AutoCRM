import { useEffect, useState } from "react";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Textarea } from "../../ui/textarea";
import { Label } from "../../ui/label";
import { Switch } from "../../ui/switch";
import { ScrollArea } from "../../ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../../ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import { supabase } from "../../../supabaseClient";
import type { Database } from "../../../types/supabase";
import { format } from "date-fns";
import { useToast } from "../../../hooks/use-toast";
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
} from "../../ui/alert-dialog";
import { TicketAssignment } from "./TicketAssignment";

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
          resolved_at: newStatus === 'resolved' ? new Date().toISOString() : null,
          closed_at: newStatus === 'closed' ? new Date().toISOString() : null
        };
      });

      toast({
        title: "Success",
        description: "Ticket status updated successfully",
      });
    } catch (err) {
      console.error('Error updating ticket status:', err);
      toast({
        title: "Error",
        description: "Failed to update ticket status",
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
        return { ...prev, priority: newPriority };
      });

      toast({
        title: "Success",
        description: "Ticket priority updated successfully",
      });
    } catch (err) {
      console.error('Error updating ticket priority:', err);
      toast({
        title: "Error",
        description: "Failed to update ticket priority",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleCommentSubmit = async () => {
    if (!ticketId || !newComment.trim() || submittingComment) return;

    try {
      setSubmittingComment(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error: commentError } = await supabase
        .from('ticket_comments')
        .insert({
          ticket_id: ticketId,
          user_id: user.id,
          content: newComment.trim(),
          is_internal: isInternalComment
        });

      if (commentError) throw commentError;

      // Clear form and refresh comments
      setNewComment("");
      setIsInternalComment(false);
      await fetchComments();

      toast({
        title: "Success",
        description: "Comment added successfully",
      });
    } catch (err) {
      console.error('Error adding comment:', err);
      toast({
        title: "Error",
        description: "Failed to add comment",
        variant: "destructive",
      });
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async () => {
    if (!commentToDelete) return;

    try {
      const { error: deleteError } = await supabase
        .from('ticket_comments')
        .delete()
        .eq('id', commentToDelete.id);

      if (deleteError) throw deleteError;

      // Refresh comments
      await fetchComments();
      setCommentToDelete(null);

      toast({
        title: "Success",
        description: "Comment deleted successfully",
      });
    } catch (err) {
      console.error('Error deleting comment:', err);
      toast({
        title: "Error",
        description: "Failed to delete comment",
        variant: "destructive",
      });
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl h-[80vh]">
          <DialogHeader>
            <DialogTitle>Ticket Details</DialogTitle>
            {ticket && (
              <DialogDescription>
                Created {format(new Date(ticket.created_at), 'PPp')}
              </DialogDescription>
            )}
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
              <p className="font-medium">Error loading ticket details</p>
              <p className="text-sm">{error}</p>
            </div>
          ) : ticket ? (
            <ScrollArea className="h-full pr-4">
              <div className="space-y-6">
                {/* Header Section */}
                <div>
                  <h2 className="text-2xl font-semibold mb-2">{ticket.title}</h2>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <div>
                      {ticket.customer ? (
                        <span>
                          {ticket.customer.first_name} {ticket.customer.last_name}
                          {ticket.customer.company && ` · ${ticket.customer.company}`}
                        </span>
                      ) : (
                        'Unknown Customer'
                      )}
                    </div>
                    {ticket.team && (
                      <>
                        <span>·</span>
                        <div>{ticket.team.name}</div>
                      </>
                    )}
                  </div>
                </div>

                {/* Status and Priority */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Status</Label>
                    <Select
                      value={ticket.status}
                      onValueChange={(value) => handleStatusChange(value as Status)}
                      disabled={updating || userRole === 'customer'}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.keys(statusColors).map((status) => (
                          <SelectItem key={status} value={status}>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className={statusColors[status as Status]}>
                                {status.replace('_', ' ')}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Priority</Label>
                    <Select
                      value={ticket.priority}
                      onValueChange={(value) => handlePriorityChange(value as Priority)}
                      disabled={updating || userRole === 'customer'}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.keys(priorityColors).map((priority) => (
                          <SelectItem key={priority} value={priority}>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className={priorityColors[priority as Priority]}>
                                {priority}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <Label>Description</Label>
                  <div className="mt-1.5 text-gray-600 whitespace-pre-wrap">
                    {ticket.description || 'No description provided.'}
                  </div>
                </div>

                {/* Assignment */}
                {(userRole === 'employee' || userRole === 'admin') && (
                  <div>
                    <Label className="mb-1.5">Assignment</Label>
                    <TicketAssignment ticketId={ticket.id} />
                  </div>
                )}

                {/* Comments */}
                <div className="space-y-4">
                  <Label>Comments</Label>
                  <div className="space-y-4">
                    {comments.map((comment) => (
                      <div
                        key={comment.id}
                        className={`p-4 rounded-lg border ${
                          comment.is_internal ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {comment.user
                                ? `${comment.user.first_name} ${comment.user.last_name}`
                                : 'Unknown User'}
                            </span>
                            {comment.is_internal && (
                              <Badge variant="secondary" className="bg-gray-100">
                                Internal
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-sm text-gray-500">
                              {format(new Date(comment.created_at), 'PPp')}
                            </span>
                            {comment.user_id === currentUserId && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setCommentToDelete(comment)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="text-gray-600 whitespace-pre-wrap">{comment.content}</div>
                      </div>
                    ))}

                    {comments.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        No comments yet
                      </div>
                    )}
                  </div>

                  {/* New Comment Form */}
                  <div className="space-y-4">
                    <Textarea
                      placeholder="Add a comment..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                    />
                    <div className="flex items-center justify-between">
                      {(userRole === 'employee' || userRole === 'admin') && (
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="internal"
                            checked={isInternalComment}
                            onCheckedChange={setIsInternalComment}
                          />
                          <Label htmlFor="internal">Internal comment</Label>
                        </div>
                      )}
                      <Button
                        onClick={handleCommentSubmit}
                        disabled={!newComment.trim() || submittingComment}
                      >
                        Add Comment
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!commentToDelete} onOpenChange={() => setCommentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Comment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this comment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteComment}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
} 