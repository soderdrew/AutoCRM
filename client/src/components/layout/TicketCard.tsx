import { useState } from "react";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader } from "../ui/card";
import { TicketDetails } from "./TicketDetails";

interface TicketCardProps {
  ticket: {
    id: string;
    title: string;
    customer: string;
    status: 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    createdAt: string;
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

  return (
    <>
      <Card 
        className="hover:border-primary/20 transition-colors cursor-pointer"
        onClick={() => setShowDetails(true)}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between mb-2">
            <div className="flex gap-2">
              <Badge variant="secondary" className={statusColors[ticket.status]}>
                {ticket.status.replace("_", " ")}
              </Badge>
              <Badge variant="secondary" className={priorityColors[ticket.priority]}>
                {ticket.priority}
              </Badge>
            </div>
            <div className="text-xs text-gray-400">#{ticket.id.slice(-8)}</div>
          </div>
          <h3 className="font-semibold text-lg leading-tight">{ticket.title}</h3>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-sm text-gray-500">
            <div className="truncate">{ticket.customer}</div>
            <div className="text-xs">{ticket.createdAt}</div>
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