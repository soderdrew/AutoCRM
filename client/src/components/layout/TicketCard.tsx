import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader } from "../ui/card";

interface TicketCardProps {
  ticket: {
    id: string;
    title: string;
    customer: string;
    status: "open" | "in_progress" | "resolved";
    priority: "low" | "medium" | "high";
    createdAt: string;
  };
}

const statusColors = {
  open: "bg-yellow-100 text-yellow-800",
  in_progress: "bg-blue-100 text-blue-800",
  resolved: "bg-green-100 text-green-800",
};

const priorityColors = {
  low: "bg-gray-100 text-gray-800",
  medium: "bg-orange-100 text-orange-800",
  high: "bg-red-100 text-red-800",
};

export function TicketCard({ ticket }: TicketCardProps) {
  return (
    <Card className="hover:border-primary/20 transition-colors">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <div className="font-semibold">#{ticket.id}</div>
        <div className="flex gap-2">
          <Badge variant="secondary" className={statusColors[ticket.status]}>
            {ticket.status.replace("_", " ")}
          </Badge>
          <Badge variant="secondary" className={priorityColors[ticket.priority]}>
            {ticket.priority}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <h3 className="font-medium">{ticket.title}</h3>
        <p className="text-sm text-gray-500">
          {ticket.customer} · {ticket.createdAt}
        </p>
      </CardContent>
    </Card>
  );
}