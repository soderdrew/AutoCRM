import { Button } from "../ui/button";
import { LayoutGrid, List } from "lucide-react";
import { TicketCard } from "./TicketCard";

const mockTickets = [
  {
    id: "TKT-001",
    title: "Cannot access my account",
    customer: "John Doe",
    status: "open",
    priority: "high",
    createdAt: "2 hours ago",
  },
  {
    id: "TKT-002",
    title: "Feature request: Dark mode",
    customer: "Jane Smith",
    status: "in_progress",
    priority: "medium",
    createdAt: "1 day ago",
  },
  {
    id: "TKT-003",
    title: "Bug in checkout process",
    customer: "Bob Wilson",
    status: "resolved",
    priority: "low",
    createdAt: "2 days ago",
  },
] as const;

export function TicketList() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Tickets</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon">
            <List className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon">
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {mockTickets.map((ticket) => (
          <TicketCard key={ticket.id} ticket={ticket} />
        ))}
      </div>
    </div>
  );
}