import { useState } from "react";
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
import { format } from "date-fns";
import { useToast } from "../../hooks/use-toast";
import { Loader2 } from "lucide-react";

type DatabaseTicketStatus = 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed' | 'assigned';
type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

interface CreateOpportunityDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onOpportunityCreated?: () => void;
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

export function CreateOpportunityDialog({ 
  isOpen, 
  onOpenChange,
  onOpportunityCreated 
}: CreateOpportunityDialogProps) {
  const [saving, setSaving] = useState(false);
  const [tagsInput, setTagsInput] = useState('');
  const [fields, setFields] = useState({
    title: '',
    description: '',
    status: 'open' as DatabaseTicketStatus,
    priority: 'medium' as TicketPriority,
    tags: [] as string[],
    duration: '',
    durationMinutes: 0,
    event_date: null as Date | null,
    location: '',
    max_volunteers: 1,
    current_volunteers: 0
  });
  const { toast } = useToast();

  // Reset form to initial state
  const resetForm = () => {
    setFields({
      title: '',
      description: '',
      status: 'open',
      priority: 'medium',
      tags: [],
      duration: '',
      durationMinutes: 0,
      event_date: null,
      location: '',
      max_volunteers: 1,
      current_volunteers: 0
    });
    setTagsInput('');
  };

  // Handle dialog close
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetForm();
    }
    onOpenChange(open);
  };

  const handleSave = async () => {
    // Validate required fields
    if (!fields.title.trim()) {
      toast({
        title: "Title is required",
        description: "Please enter a title for the opportunity.",
        variant: "destructive",
      });
      return;
    }

    if (!fields.description.trim()) {
      toast({
        title: "Description is required",
        description: "Please enter a description for the opportunity.",
        variant: "destructive",
      });
      return;
    }

    if (!fields.event_date) {
      toast({
        title: "Event date and time are required",
        description: "Please select when the opportunity will take place.",
        variant: "destructive",
      });
      return;
    }

    if (!fields.durationMinutes) {
      toast({
        title: "Duration is required",
        description: "Please specify how long the opportunity will last.",
        variant: "destructive",
      });
      return;
    }

    if (!fields.location.trim()) {
      toast({
        title: "Location is required",
        description: "Please specify where the opportunity will take place.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);

      // Get the current user's ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error: createError } = await supabase
        .from('tickets')
        .insert({
          title: fields.title,
          description: fields.description,
          status: fields.status,
          priority: fields.priority,
          tags: fields.tags,
          duration: fields.durationMinutes,
          event_date: fields.event_date?.toISOString(),
          location: fields.location,
          max_volunteers: fields.max_volunteers,
          current_volunteers: fields.current_volunteers,
          customer_id: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (createError) throw createError;

      toast({
        title: "Opportunity created",
        description: "Your volunteer opportunity has been created successfully.",
      });

      onOpportunityCreated?.();
      resetForm();
      onOpenChange(false);
    } catch (err) {
      console.error('Error creating opportunity:', err);
      toast({
        title: "Error creating opportunity",
        description: err instanceof Error ? err.message : "Failed to create opportunity",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFields(prev => ({ ...prev, title: e.target.value }));
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFields(prev => ({ ...prev, description: e.target.value }));
  };

  const handleTagsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTagsInput(value);
    
    const newTags = value.split(',')
      .map(tag => tag.trim())
      .filter(Boolean);
    
    setFields(prev => ({
      ...prev,
      tags: newTags
    }));
  };

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const minutes = parseDuration(value);
    setFields(prev => ({ 
      ...prev, 
      duration: value,
      durationMinutes: minutes !== null ? minutes : prev.durationMinutes 
    }));
  };

  const handleLocationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFields(prev => ({ ...prev, location: e.target.value }));
  };

  const handleMaxVolunteersChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 1;
    setFields(prev => ({ ...prev, max_volunteers: Math.max(1, value) }));
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!fields.event_date) return;

    const [hours, minutes] = e.target.value.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return;

    const newDate = new Date(fields.event_date);
    newDate.setHours(hours, minutes);
    setFields(prev => ({ ...prev, event_date: newDate }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Create New Opportunity</DialogTitle>
          <DialogDescription>
            Fill in the details for your new volunteer opportunity. Fields marked with * are required.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-full max-h-[calc(90vh-8rem)] pr-4">
          <div className="space-y-6 pb-6">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="title">
                Title <span className="text-red-500">*</span>
              </label>
              <Input
                id="title"
                value={fields.title}
                onChange={handleTitleChange}
                placeholder="Opportunity title"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="description">
                Description <span className="text-red-500">*</span>
              </label>
              <Textarea
                id="description"
                value={fields.description}
                onChange={handleDescriptionChange}
                placeholder="Describe the volunteer opportunity..."
                className="min-h-[100px]"
                required
              />
            </div>

            <div className="space-y-6">
              <h3 className="text-lg font-medium">Event Details</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="event_date">
                    Event Date & Time <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        type="date"
                        id="event_date"
                        className="w-full"
                        value={fields.event_date 
                          ? format(fields.event_date, "yyyy-MM-dd")
                          : ""}
                        onChange={(e) => {
                          const date = e.target.value ? new Date(e.target.value) : null;
                          if (date) {
                            const hours = fields.event_date 
                              ? fields.event_date.getHours() 
                              : new Date().getHours();
                            const minutes = fields.event_date 
                              ? fields.event_date.getMinutes() 
                              : new Date().getMinutes();
                            date.setHours(hours, minutes);
                          }
                          setFields(prev => ({ ...prev, event_date: date }));
                        }}
                        min={format(new Date(), "yyyy-MM-dd")}
                        required
                      />
                    </div>
                    <div>
                      <Input
                        type="time"
                        className="w-[120px]"
                        value={fields.event_date 
                          ? format(fields.event_date, "HH:mm")
                          : ""}
                        onChange={handleTimeChange}
                        disabled={!fields.event_date}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="duration">
                    Duration <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="duration"
                    value={fields.duration}
                    onChange={handleDurationChange}
                    placeholder="e.g. 2 hours 30 minutes"
                    required
                  />
                  <p className="text-sm text-gray-500">
                    Format: "X hours Y minutes" or "Y minutes"
                  </p>
                  {fields.durationMinutes > 0 && (
                    <p className="text-sm text-gray-500">
                      Event ends at: {fields.event_date && format(
                        new Date(fields.event_date.getTime() + fields.durationMinutes * 60000),
                        "h:mm a"
                      )}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="location">
                  Location <span className="text-red-500">*</span>
                </label>
                <Input
                  id="location"
                  value={fields.location}
                  onChange={handleLocationChange}
                  placeholder="Physical address or virtual meeting link"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="max_volunteers">Maximum Volunteers</label>
                <Input
                  id="max_volunteers"
                  type="number"
                  min="1"
                  value={fields.max_volunteers}
                  onChange={handleMaxVolunteersChange}
                  placeholder="Number of volunteers needed"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="status">Status</label>
                <Select
                  value={fields.status}
                  onValueChange={(value: DatabaseTicketStatus) => 
                    setFields(prev => ({ ...prev, status: value }))
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
                  value={fields.priority}
                  onValueChange={(value: TicketPriority) => 
                    setFields(prev => ({ ...prev, priority: value }))
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
              {fields.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {fields.tags.map((tag, index) => (
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
                  Create Opportunity
                </Button>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
} 