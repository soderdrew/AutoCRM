import { Home, PlusCircle, ClipboardList, Building2, Settings } from "lucide-react";

export const organizationMenuItems = [
  { icon: Home, label: "Dashboard", href: "/organization/dashboard" },
  { icon: PlusCircle, label: "Create Opportunity", href: "/organization/opportunities/new" },
  { icon: ClipboardList, label: "My Opportunities", href: "/organization/opportunities" },
  { icon: Building2, label: "Organization Profile", href: "/organization/profile" },
  { icon: Settings, label: "Settings", href: "/organization/settings" },
]; 