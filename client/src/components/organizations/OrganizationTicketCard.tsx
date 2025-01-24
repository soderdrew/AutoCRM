import { Pencil } from "lucide-react";
import { Button } from "../ui/button";
import { TicketCard } from "../layout/TicketCard";
import type { Database } from "../../types/supabase";

type TicketStatus = "open" | "in_progress" | "waiting" | "resolved" | "closed";
type TicketPriority = "low" | "medium" | "high" | "urgent";

interface OrganizationTicketCardProps {
  ticket: {
    id: string;
    title: string;
    customer: string;
    status: TicketStatus;
    priority: TicketPriority;
    createdAt: string;
  };
  isOwner: boolean;
  onEditClick: () => void;
  onClick: () => void;
}

export function OrganizationTicketCard({ 
  ticket, 
  isOwner,
  onEditClick,
  onClick 
}: OrganizationTicketCardProps) {
  return (
    <div 
      className="relative group cursor-pointer hover:border-primary transition-colors" 
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
    >
      <TicketCard ticket={ticket} />
      
      {isOwner && (
        <Button
          size="icon"
          variant="ghost"
          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onEditClick();
          }}
          title="Edit opportunity"
        >
          <Pencil className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
} 