import { Bell, Search, LogOut } from "lucide-react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { useState } from "react";
import { supabase } from "../../supabaseClient";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { useToast } from "../../hooks/use-toast";

export function Header() {
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      toast({
        title: "Signed out successfully",
        description: "You have been signed out of your account.",
      });
      
      navigate("/login");
    } catch (err) {
      console.error('Error signing out:', err);
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive",
      });
    } finally {
      setShowSignOutModal(false);
    }
  };

  return (
    <header className="flex h-16 items-center gap-4 border-b bg-white px-6">
      <div className="flex flex-1 items-center gap-4">
        <Search className="h-5 w-5 text-gray-400" />
        <Input
          type="search"
          placeholder="Search tickets..."
          className="w-full max-w-md"
        />
      </div>
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-primary" />
        </Button>
        <Avatar className="cursor-pointer" onClick={() => setShowSignOutModal(true)}>
          <AvatarImage src="https://github.com/shadcn.png" />
          <AvatarFallback>JD</AvatarFallback>
        </Avatar>
      </div>

      <Dialog open={showSignOutModal} onOpenChange={setShowSignOutModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Sign Out</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-2 py-4">
            <LogOut className="h-5 w-5 text-muted-foreground" />
            <span>Are you sure you want to sign out?</span>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSignOutModal(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleSignOut}>
              Sign Out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}