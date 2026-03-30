import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Home, Search, MessageSquare, ShoppingBag, BookOpen, GraduationCap,
  CalendarDays, Crown, User, LogOut, Menu, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

const navItems = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/search", label: "Search", icon: Search },
  { to: "/messages", label: "Messages", icon: MessageSquare },
  { to: "/marketplace", label: "Marketplace", icon: ShoppingBag },
  { to: "/blogs", label: "Blogs", icon: BookOpen },
  { to: "/academic", label: "Academic", icon: GraduationCap },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/premium", label: "Premium", icon: Crown },
];

const Layout = () => {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const queryClient = useQueryClient();

  // Request notification permission once on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Total unread message count
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["total-unread", user?.id],
    queryFn: async () => {
      const { data: convos } = await supabase
        .from("conversations")
        .select("id")
        .or(`participant_1.eq.${user!.id},participant_2.eq.${user!.id}`);
      if (!convos || convos.length === 0) return 0;
      const convoIds = convos.map((c) => c.id);
      const { count } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .in("conversation_id", convoIds)
        .neq("sender_id", user!.id)
        .eq("is_read", false);
      return count || 0;
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  // Realtime: keep unread count fresh
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("layout-unread-watch")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const msg = payload.new as any;
        if (msg.sender_id !== user.id) {
          queryClient.invalidateQueries({ queryKey: ["total-unread", user.id] });
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, () => {
        queryClient.invalidateQueries({ queryKey: ["total-unread", user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const renderNavLink = ({ to, label, icon: Icon }: typeof navItems[0], mobile = false) => {
    const isActive = location.pathname === to;
    const base = mobile
      ? `flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium ${isActive ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/50"}`
      : `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/50 text-primary-foreground/80"}`;
    return (
      <Link key={to} to={to} onClick={mobile ? () => setMobileOpen(false) : undefined} className={base}>
        <div className="relative">
          <Icon className="h-4 w-4" />
          {label === "Messages" && unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 h-2 w-2 bg-red-500 rounded-full" />
          )}
        </div>
        {label}
        {label === "Messages" && unreadCount > 0 && (
          <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Link>
    );
  };

  return (
    <div className="min-h-screen flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-primary text-primary-foreground flex-col fixed h-full z-30">
        <Link to="/dashboard" className="px-6 py-5 flex items-center gap-2">
          <span className="text-2xl font-extrabold tracking-tight">ST</span>
          <span className="text-xs font-medium opacity-80 mt-1">Student Talks</span>
        </Link>
        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => renderNavLink(item))}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <Link
            to={`/profile/${user?.id}`}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-sidebar-accent/50 text-primary-foreground/80"
          >
            <User className="h-4 w-4" />
            Profile
          </Link>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-sidebar-accent/50 text-primary-foreground/80 w-full"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-primary text-primary-foreground px-4 flex items-center justify-between" style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)", paddingBottom: "12px" }}>
        <Link to="/dashboard" className="text-xl font-extrabold tracking-tight">ST</Link>
        <div className="flex items-center gap-1">
          <Link to="/messages" className="relative p-2">
            <MessageSquare className="h-5 w-5 text-primary-foreground" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full" />
            )}
          </Link>
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(!mobileOpen)} className="text-primary-foreground hover:bg-sidebar-accent">
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Nav Overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-30 bg-primary text-primary-foreground px-4" style={{ paddingTop: "calc(env(safe-area-inset-top) + 64px)" }}>
          <nav className="space-y-1">
            {navItems.map((item) => renderNavLink(item, true))}
            <Link to={`/profile/${user?.id}`} onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium hover:bg-sidebar-accent/50">
              <User className="h-4 w-4" />
              Profile
            </Link>
            <button onClick={handleSignOut} className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium hover:bg-sidebar-accent/50 w-full">
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </nav>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 md:ml-64 md:mt-0" style={{ marginTop: "calc(env(safe-area-inset-top) + 56px)" }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
