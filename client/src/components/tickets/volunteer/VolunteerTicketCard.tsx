import { useState } from "react";
import { Badge } from "../../ui/badge";
import { Card, CardContent, CardHeader } from "../../ui/card";
import { VolunteerTicketDetails } from "./VolunteerTicketDetails";
import { UserCheck, Users, Clock, MapPin } from "lucide-react";
import { format } from "date-fns";

type TicketStatus = 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed';
type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

interface VolunteerTicketCardProps {
  ticket: {
    id: string;
    title: string;
    customer: string;
    status: TicketStatus;
    priority: TicketPriority;
    createdAt: string;
    eventDate: Date | null;
    duration: number;
    location: string;
    currentVolunteers: number;
    maxVolunteers: number;
  };
  isAssigned?: boolean;
  onAssignmentChange?: () => void;
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

const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
};

export function VolunteerTicketCard({ ticket, isAssigned, onAssignmentChange }: VolunteerTicketCardProps) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <>
      <Card 
        className="cursor-pointer hover:border-primary transition-colors"
        onClick={() => setShowDetails(true)}
      >
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start gap-4">
            <h3 className="font-semibold leading-none">{ticket.title}</h3>
            {isAssigned && (
              <UserCheck className="h-5 w-5 text-green-600 flex-shrink-0" />
            )}
          </div>
          <p className="text-sm text-muted-foreground">{ticket.customer}</p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Badge className={statusColors[ticket.status]}>
              {ticket.status.replace("_", " ")}
            </Badge>
            <Badge className={priorityColors[ticket.priority]}>
              {ticket.priority}
            </Badge>
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <Users className="h-4 w-4" />
              <span>{ticket.currentVolunteers}/{ticket.maxVolunteers}</span>
            </div>
          </div>
          
          {/* Event Details */}
          <div className="space-y-2 text-sm text-muted-foreground">
            {ticket.eventDate && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>{format(ticket.eventDate, "PPP 'at' p")}</span>
                <span>·</span>
                <span>{formatDuration(ticket.duration)}</span>
              </div>
            )}
            {ticket.location && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span className="truncate">{ticket.location}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <VolunteerTicketDetails
        ticketId={showDetails ? ticket.id : null}
        isOpen={showDetails}
        onOpenChange={setShowDetails}
        onAssignmentChange={onAssignmentChange}
      />
    </>
  );
} 