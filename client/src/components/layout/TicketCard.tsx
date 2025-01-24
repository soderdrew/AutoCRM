import { useState } from "react";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader } from "../ui/card";
import { TicketDetails } from "./TicketDetails";
import { Users, MapPin, Clock } from "lucide-react";
import { cn } from "../../lib/utils";

interface TicketCardProps {
  ticket: {
    id: string;
    title: string;
    customer: string;
    status: 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    createdAt: string;
    currentVolunteers?: number;
    maxVolunteers?: number;
    location?: string;
    eventDate?: string;
    eventTime?: string;
    duration?: number;
  };
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

export function TicketCard({ ticket }: TicketCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const isFull = ticket.currentVolunteers !== undefined && 
                 ticket.maxVolunteers !== undefined && 
                 ticket.currentVolunteers >= ticket.maxVolunteers;

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours === 0) return `${remainingMinutes} minutes`;
    if (remainingMinutes === 0) return `${hours} hours`;
    return `${hours}h ${remainingMinutes}m`;
  };

  const formatDateTime = () => {
    const parts = [];
    if (ticket.eventDate) parts.push(ticket.eventDate);
    if (ticket.eventTime) parts.push(`at ${ticket.eventTime}`);
    if (ticket.duration) parts.push(`(${formatDuration(ticket.duration)})`);
    return parts.join(" ");
  };

  return (
    <>
      <Card 
        className="hover:border-primary/20 transition-colors cursor-pointer"
        onClick={() => setShowDetails(true)}
      >
        <CardHeader className="pb-2">
          <h3 className="font-semibold text-xl mb-2">{ticket.title}</h3>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className={statusColors[ticket.status]}>
              {ticket.status.replace("_", " ")}
            </Badge>
            <Badge variant="secondary" className={priorityColors[ticket.priority]}>
              {ticket.priority}
            </Badge>
            {(ticket.currentVolunteers !== undefined && ticket.maxVolunteers !== undefined) && (
              <div className={cn(
                "flex items-center gap-1 text-sm ml-auto",
                isFull ? "text-green-600" : "text-gray-500"
              )}>
                <Users className="h-4 w-4" />
                <span>{ticket.currentVolunteers}/{ticket.maxVolunteers}</span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5 text-sm text-gray-500">
            {ticket.location && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>{ticket.location}</span>
              </div>
            )}
            {(ticket.eventDate || ticket.eventTime || ticket.duration) && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>{formatDateTime()}</span>
              </div>
            )}
          </div>
          <div className="mt-4 text-xs text-gray-400">
            #{ticket.id.slice(-8)}
          </div>
        </CardContent>
      </Card>

      <TicketDetails
        ticketId={showDetails ? ticket.id : null}
        isOpen={showDetails}
        onOpenChange={setShowDetails}
      />
    </>
  );
}