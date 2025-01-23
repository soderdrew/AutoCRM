import { useEffect, useState } from "react";
import { Button } from "../../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../ui/dialog";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import { Textarea } from "../../ui/textarea";
import { supabase } from "../../../supabaseClient";
import type { Database } from "../../../types/supabase";
import { useToast } from "../../../hooks/use-toast";

type Team = Database['public']['Tables']['teams']['Row'];

export function CreateTicketDialog() {
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "medium" as "low" | "medium" | "high" | "urgent",
    tags: "",
    team_id: null as string | null,
  });

  useEffect(() => {
    const fetchUserRoleAndTeams = async () => {
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Get user role
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();

        if (roleData) {
          setUserRole(roleData.role);
        }

        // Fetch teams if admin
        if (roleData?.role === 'admin') {
          const { data: teamsData } = await supabase
            .from('teams')
            .select('*')
            .order('name');

          if (teamsData) {
            setTeams(teamsData);
          }
        }
      } catch (error) {
        console.error('Error fetching user role and teams:', error);
      }
    };

    fetchUserRoleAndTeams();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      // Convert comma-separated tags to array and trim whitespace
      const tagsArray = formData.tags
        ? formData.tags.split(',').map(tag => tag.trim())
        : [];

      const { error } = await supabase.from("tickets").insert({
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        status: "open",
        customer_id: user.id,
        team_id: formData.team_id,
        tags: tagsArray,
      });

      if (error) throw error;

      // Show success toast
      toast({
        title: "Ticket Created",
        description: "Your support ticket has been successfully created.",
        variant: "default",
      });

      // Reset form
      setFormData({
        title: "",
        description: "",
        priority: "medium",
        tags: "",
        team_id: null,
      });

      // Close the dialog
      setIsOpen(false);
    } catch (error) {
      console.error("Error creating ticket:", error);
      // Show error toast
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create ticket. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>Create New Ticket</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Ticket</DialogTitle>
            <DialogDescription>
              Fill out the form below to create a new support ticket.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="Brief description of the issue"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Detailed explanation of your issue"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value: typeof formData.priority) =>
                  setFormData({ ...formData, priority: value })
                }
              >
                <SelectTrigger id="priority">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                value={formData.tags}
                onChange={(e) =>
                  setFormData({ ...formData, tags: e.target.value })
                }
                placeholder="Enter tags separated by commas"
              />
            </div>
            {userRole === 'admin' && (
              <div className="grid gap-2">
                <Label htmlFor="team">Assign Team</Label>
                <Select
                  value={formData.team_id || undefined}
                  onValueChange={(value) =>
                    setFormData({ ...formData, team_id: value })
                  }
                >
                  <SelectTrigger id="team">
                    <SelectValue placeholder="Select team" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Creating..." : "Create Ticket"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 