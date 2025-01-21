import { Home, Inbox, Users, Settings, Menu } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from "../ui/sidebar";

const menuItems = [
  { icon: Home, label: "Dashboard", href: "#" },
  { icon: Inbox, label: "Tickets", href: "#" },
  { icon: Users, label: "Team", href: "#" },
  { icon: Settings, label: "Settings", href: "#" },
];

export function AppSidebar() {
  return (
    <Sidebar>
      <div className="flex h-16 items-center border-b px-6">
        <span className="text-lg font-semibold">Support CRM</span>
        <SidebarTrigger className="ml-auto lg:hidden">
          <Menu className="h-6 w-6" />
        </SidebarTrigger>
      </div>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton asChild>
                    <a href={item.href} className="flex items-center gap-3">
                      <item.icon className="h-5 w-5" />
                      <span>{item.label}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
