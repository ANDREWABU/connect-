import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { User, GraduationCap, BookOpen, Edit, Trash2, Flag } from "lucide-react";
import { toast } from "sonner";

const REPORT_REASONS = [
  "Spam or fake account",
  "Harassment or bullying",
  "Inappropriate content",
  "Hate speech",
  "Scam or fraud",
  "Other",
];

const ProfileView = () => {
  const { id } = useParams();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isOwn = user?.id === id;

  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", id!)
        .single();
      return data;
    },
    enabled: !!id,
  });

  const handleDeleteAccount = async () => {
    if (!user) return;
    const confirmed = confirm(
      "Are you sure you want to delete your account?\n\nThis will permanently delete all your posts, comments, messages, marketplace listings, and profile. This cannot be undone."
    );
    if (!confirmed) return;

    try {
      await supabase.from("messages").delete().eq("sender_id", user.id);
      await supabase.from("comments").delete().eq("user_id", user.id);
      await (supabase as any).from("likes").delete().eq("user_id", user.id);
      await (supabase as any).from("follows").delete().eq("follower_id", user.id);
      await (supabase as any).from("follows").delete().eq("following_id", user.id);
      await supabase.from("posts").delete().eq("user_id", user.id);
      await supabase.from("marketplace_listings").delete().eq("seller_id", user.id);
      const { data: convos } = await supabase
        .from("conversations")
        .select("id")
        .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`);
      if (convos && convos.length > 0) {
        const ids = convos.map((c) => c.id);
        await supabase.from("messages").delete().in("conversation_id", ids);
        await supabase.from("conversations").delete().or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`);
      }
      await supabase.from("profiles").delete().eq("user_id", user.id);
      await signOut();
      queryClient.clear();
      toast.success("Account deleted.");
      navigate("/");
    } catch {
      toast.error("Something went wrong. Please try again.");
    }
  };

  const handleReport = async () => {
    if (!reportReason) { toast.error("Please select a reason."); return; }
    setSubmitting(true);
    // Store report in localStorage as a simple fallback (no reports table in schema)
    // In production this would insert into a reports table
    const reports = JSON.parse(localStorage.getItem("gt_reports") || "[]");
    reports.push({
      reported_user_id: id,
      reported_by: user?.id,
      reason: reportReason,
      details: reportDetails,
      at: new Date().toISOString(),
    });
    localStorage.setItem("gt_reports", JSON.stringify(reports));
    setSubmitting(false);
    setReportOpen(false);
    setReportReason("");
    setReportDetails("");
    toast.success("Report submitted. Thank you for keeping Student Talks safe.");
  };

  if (isLoading) return <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if (!profile) return <p className="text-center text-muted-foreground py-20">Profile not found.</p>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            {profile.profile_image ? (
              <img src={profile.profile_image} className="h-16 w-16 rounded-full object-cover" alt="" />
            ) : (
              <User className="h-8 w-8 text-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-foreground">{profile.full_name || "Student"}</h1>
            <p className="text-sm text-muted-foreground">{profile.student_email}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isOwn ? (
              <Button variant="outline" size="sm" asChild>
                <Link to="/profile/edit"><Edit className="h-4 w-4 mr-1" /> Edit</Link>
              </Button>
            ) : user && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setReportOpen(true)}
                className="gap-1.5 text-muted-foreground hover:text-destructive"
                title="Report this account"
              >
                <Flag className="h-4 w-4" />
                Report
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 flex-wrap">
            {profile.program && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <GraduationCap className="h-4 w-4" /> {profile.program}
              </div>
            )}
            {profile.year_of_study && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <BookOpen className="h-4 w-4" /> Year {profile.year_of_study}
              </div>
            )}
          </div>
          {profile.bio && <p className="text-sm text-foreground">{profile.bio}</p>}
          <div className="flex items-center gap-2 flex-wrap">
            {profile.is_verified && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">✓ Verified Student</span>
            )}
            {profile.is_premium && (
              <span className="text-xs bg-secondary/20 text-secondary-foreground px-2 py-0.5 rounded-full">★ Premium</span>
            )}
          </div>

          {/* Danger zone — own profile only */}
          {isOwn && (
            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground mb-2">Danger zone</p>
              <Button variant="destructive" size="sm" onClick={handleDeleteAccount} className="gap-1.5">
                <Trash2 className="h-4 w-4" />
                Delete Account
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Report dialog */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="h-4 w-4 text-destructive" /> Report Account
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Why are you reporting <span className="font-medium text-foreground">{profile.full_name}</span>?</p>
            <div className="space-y-2">
              {REPORT_REASONS.map((r) => (
                <label key={r} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="reason"
                    value={r}
                    checked={reportReason === r}
                    onChange={() => setReportReason(r)}
                    className="accent-primary"
                  />
                  <span className="text-sm">{r}</span>
                </label>
              ))}
            </div>
            <Textarea
              placeholder="Additional details (optional)..."
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
              rows={3}
              className="text-sm resize-none"
            />
            <div className="flex gap-2">
              <Button className="flex-1" onClick={handleReport} disabled={submitting || !reportReason}>
                {submitting ? "Submitting..." : "Submit Report"}
              </Button>
              <Button variant="outline" onClick={() => setReportOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProfileView;
