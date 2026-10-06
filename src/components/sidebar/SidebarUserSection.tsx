import { LogOut } from "lucide-react";

interface SidebarUserSectionProps {
  userEmail: string;
  userInitials: string;
  onSignOut: () => void;
}

export function SidebarUserSection({ userEmail, userInitials, onSignOut }: SidebarUserSectionProps) {
  return (
    <div className="p-4 border-t border-sidebar-border">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-sidebar-accent flex items-center justify-center text-sidebar-accent-foreground font-semibold text-sm">
          {userInitials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-sidebar-foreground truncate">{userEmail}</p>
          <p className="text-xs text-sidebar-foreground/50 truncate">Plano Gratuito</p>
        </div>
        <button
          onClick={onSignOut}
          className="text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
