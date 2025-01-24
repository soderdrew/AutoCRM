import { useEffect, useState } from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { ScrollArea } from "../ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { supabase } from "../../supabaseClient";
import type { Database } from "../../types/supabase";
import { format, set } from "date-fns";
import { useToast } from "../../hooks/use-toast";
import { Loader2, Calendar as CalendarIcon, Clock } from "lucide-react";

type DatabaseTicketStatus = 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed' | 'assigned';
type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

type Ticket = Database['public']['Tables']['tickets']['Row'] & {
  organization: {
    first_name: string;
    last_name: string;
    company: string | null;
  } | null;
};

interface OrganizationTicketDetailsProps {
  ticketId: string | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onTicketUpdate?: () => void;
}

const statusOptions: DatabaseTicketStatus[] = ['open', 'in_progress', 'waiting', 'resolved', 'closed', 'assigned'];
const priorityOptions: TicketPriority[] = ['low', 'medium', 'high', 'urgent'];

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

const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} minutes`;
  if (mins === 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
  return `${hours} hour${hours > 1 ? 's' : ''} ${mins} minute${mins > 1 ? 's' : ''}`;
};

const parseDuration = (input: string): number | null => {
  // Try to parse "X hours Y minutes" format
  const matches = input.toLowerCase().match(/^(\d+)\s*hours?\s*(?:(\d+)\s*minutes?)?$/);
  if (matches) {
    const hours = parseInt(matches[1]) || 0;
    const minutes = parseInt(matches[2]) || 0;
    return hours * 60 + minutes;
  }
  
  // Try to parse "Y minutes" format
  const minutesMatch = input.toLowerCase().match(/^(\d+)\s*minutes?$/);
  if (minutesMatch) {
    return parseInt(minutesMatch[1]);
  }
  
  return null;
};

export function OrganizationTicketDetails({ 
  ticketId, 
  isOpen, 
  onOpenChange,
  onTicketUpdate 
}: OrganizationTicketDetailsProps) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tagsInput, setTagsInput] = useState('');
  const [editedFields, setEditedFields] = useState({
    title: '',
    description: '',
    status: '' as DatabaseTicketStatus,
    priority: '' as TicketPriority,
    tags: [] as string[],
    duration: '',
    durationMinutes: 0,
    event_date: null as Date | null,
    location: '',
    max_volunteers: 1,
    current_volunteers: 0
  });
  const { toast } = useToast();
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  useEffect(() => {
    if (!ticketId) return;

    const fetchTicketDetails = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: ticketData, error: ticketError } = await supabase
          .from('tickets')
          .select('*')
          .eq('id', ticketId)
          .single();

        if (ticketError) throw ticketError;

        const { data: orgData, error: orgError } = await supabase
          .from('user_roles')
          .select('first_name, last_name, company')
          .eq('user_id', ticketData.customer_id)
          .eq('role', 'customer')
          .single();

        if (orgError) {
          console.error('Error fetching organization details:', orgError);
        }

        const fullTicket = {
          ...ticketData,
          organization: orgData || null
        };

        setTicket(fullTicket);
        setTagsInput(fullTicket.tags?.join(', ') || '');
        setEditedFields({
          title: fullTicket.title,
          description: fullTicket.description || '',
          status: fullTicket.status as DatabaseTicketStatus,
          priority: fullTicket.priority as TicketPriority,
          tags: fullTicket.tags || [],
          duration: fullTicket.duration ? formatDuration(fullTicket.duration) : '',
          durationMinutes: fullTicket.duration || 0,
          event_date: fullTicket.event_date ? new Date(fullTicket.event_date) : null,
          location: fullTicket.location || '',
          max_volunteers: fullTicket.max_volunteers || 1,
          current_volunteers: fullTicket.current_volunteers || 0
        });
      } catch (err) {
        console.error('Error fetching ticket details:', err);
        setError(err instanceof Error ? err.message : 'Failed to load ticket details');
      } finally {
        setLoading(false);
      }
    };

    fetchTicketDetails();
  }, [ticketId]);

  const handleSave = async () => {
    if (!ticket) return;

    try {
      setSaving(true);
      const { error: updateError } = await supabase
        .from('tickets')
        .update({
          title: editedFields.title,
          description: editedFields.description,
          status: editedFields.status,
          priority: editedFields.priority,
          tags: editedFields.tags,
          duration: editedFields.durationMinutes,
          event_date: editedFields.event_date?.toISOString(),
          location: editedFields.location,
          max_volunteers: editedFields.max_volunteers,
          current_volunteers: editedFields.current_volunteers,
          updated_at: new Date().toISOString()
        })
        .eq('id', ticket.id);

      if (updateError) throw updateError;

      toast({
        title: "Changes saved",
        description: "Your opportunity has been updated successfully.",
      });

      onTicketUpdate?.();
      onOpenChange(false);
    } catch (err) {
      console.error('Error updating ticket:', err);
      toast({
        title: "Error saving changes",
        description: err instanceof Error ? err.message : "Failed to save changes",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditedFields(prev => ({ ...prev, title: e.target.value }));
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditedFields(prev => ({ ...prev, description: e.target.value }));
  };

  const handleTagsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTagsInput(value);
    
    const newTags = value.split(',')
      .map(tag => tag.trim())
      .filter(Boolean);
    
    setEditedFields(prev => ({
      ...prev,
      tags: newTags
    }));
  };

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const minutes = parseDuration(value);
    setEditedFields(prev => ({ 
      ...prev, 
      duration: value,
      durationMinutes: minutes !== null ? minutes : prev.durationMinutes 
    }));
  };

  const handleLocationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditedFields(prev => ({ ...prev, location: e.target.value }));
  };

  const handleMaxVolunteersChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 1;
    setEditedFields(prev => ({ ...prev, max_volunteers: Math.max(1, value) }));
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editedFields.event_date) return;

    const [hours, minutes] = e.target.value.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return;

    const newDate = set(editedFields.event_date, { hours, minutes });
    setEditedFields(prev => ({ ...prev, event_date: newDate }));
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Loading Opportunity</DialogTitle>
            <DialogDescription>Please wait while we load the opportunity details.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (error || !ticket) {
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Error</DialogTitle>
            <DialogDescription>We encountered a problem loading the opportunity.</DialogDescription>
          </DialogHeader>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
            <p className="font-medium">Error loading opportunity</p>
            <p className="text-sm">{error || 'Opportunity not found'}</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Edit Opportunity</DialogTitle>
          <DialogDescription>
            Make changes to your volunteer opportunity below.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-full max-h-[calc(90vh-8rem)] pr-4">
          <div className="space-y-6 pb-6">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="title">Title</label>
              <Input
                id="title"
                value={editedFields.title}
                onChange={handleTitleChange}
                placeholder="Opportunity title"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="description">Description</label>
              <Textarea
                id="description"
                value={editedFields.description}
                onChange={handleDescriptionChange}
                placeholder="Describe the volunteer opportunity..."
                className="min-h-[100px]"
              />
            </div>

            <div className="space-y-6">
              <h3 className="text-lg font-medium">Event Details</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="event_date">Event Date & Time</label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        type="date"
                        id="event_date"
                        className="w-full"
                        value={editedFields.event_date 
                          ? format(editedFields.event_date, "yyyy-MM-dd")
                          : ""}
                        onChange={(e) => {
                          const date = e.target.value ? new Date(e.target.value) : null;
                          if (date) {
                            const hours = editedFields.event_date 
                              ? editedFields.event_date.getHours() 
                              : new Date().getHours();
                            const minutes = editedFields.event_date 
                              ? editedFields.event_date.getMinutes() 
                              : new Date().getMinutes();
                            date.setHours(hours, minutes);
                          }
                          setEditedFields(prev => ({ ...prev, event_date: date }));
                        }}
                        min={format(new Date(), "yyyy-MM-dd")}
                      />
                    </div>
                    <div>
                      <Input
                        type="time"
                        className="w-[120px]"
                        value={editedFields.event_date 
                          ? format(editedFields.event_date, "HH:mm")
                          : ""}
                        onChange={handleTimeChange}
                        disabled={!editedFields.event_date}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="duration">Duration</label>
                  <Input
                    id="duration"
                    value={editedFields.duration}
                    onChange={handleDurationChange}
                    placeholder="e.g. 2 hours 30 minutes"
                  />
                  <p className="text-sm text-gray-500">
                    Format: "X hours Y minutes" or "Y minutes"
                  </p>
                  {editedFields.durationMinutes > 0 && (
                    <p className="text-sm text-gray-500">
                      Event ends at: {editedFields.event_date && format(
                        new Date(editedFields.event_date.getTime() + editedFields.durationMinutes * 60000),
                        "h:mm a"
                      )}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="location">Location</label>
                <Input
                  id="location"
                  value={editedFields.location}
                  onChange={handleLocationChange}
                  placeholder="Physical address or virtual meeting link"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="max_volunteers">Maximum Volunteers</label>
                <Input
                  id="max_volunteers"
                  type="number"
                  min="1"
                  value={editedFields.max_volunteers}
                  onChange={handleMaxVolunteersChange}
                  placeholder="Number of volunteers needed"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="status">Status</label>
                <Select
                  value={editedFields.status}
                  onValueChange={(value: DatabaseTicketStatus) => 
                    setEditedFields(prev => ({ ...prev, status: value }))
                  }
                >
                  <SelectTrigger id="status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((status) => (
                      <SelectItem key={status} value={status}>
                        <div className="flex items-center">
                          <Badge className={statusColors[status]}>
                            {status.replace('_', ' ')}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="priority">Priority</label>
                <Select
                  value={editedFields.priority}
                  onValueChange={(value: TicketPriority) => 
                    setEditedFields(prev => ({ ...prev, priority: value }))
                  }
                >
                  <SelectTrigger id="priority">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    {priorityOptions.map((priority) => (
                      <SelectItem key={priority} value={priority}>
                        <div className="flex items-center">
                          <Badge className={priorityColors[priority]}>
                            {priority}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="tags">Tags</label>
              <Input
                id="tags"
                value={tagsInput}
                onChange={handleTagsChange}
                placeholder="Enter tags separated by commas (e.g. education, mentoring, remote)"
              />
              <p className="text-sm text-gray-500">
                Separate tags with commas. Example: education, mentoring, remote
              </p>
              {editedFields.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {editedFields.tags.map((tag, index) => (
                    <Badge 
                      key={index} 
                      variant="secondary"
                      className="px-2 py-1"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-6 border-t">
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
} 