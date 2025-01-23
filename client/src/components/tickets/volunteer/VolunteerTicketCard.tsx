import { useState } from "react";
import { Badge } from "../../ui/badge";
import { Card, CardContent, CardHeader } from "../../ui/card";
import { VolunteerTicketDetails } from "./VolunteerTicketDetails";
import { UserCheck } from "lucide-react";

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
          <div className="flex items-center gap-2">
            <Badge className={statusColors[ticket.status]}>
              {ticket.status.replace("_", " ")}
            </Badge>
            <Badge className={priorityColors[ticket.priority]}>
              {ticket.priority}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-2">{ticket.createdAt}</p>
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