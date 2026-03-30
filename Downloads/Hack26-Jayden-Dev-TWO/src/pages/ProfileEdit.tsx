import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Camera, User } from "lucide-react";

const ProfileEdit = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    program: "",
    year_of_study: 1,
    bio: "",
    profile_image: "",
  });

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setForm({
            full_name: data.full_name || "",
            program: data.program || "",
            year_of_study: data.year_of_study || 1,
            bio: data.bio || "",
            profile_image: data.profile_image || "",
          });
        }
      });
  }, [user]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const uploadAvatar = async (): Promise<string | null> => {
    if (!avatarFile || !user) return null;
    const ext = avatarFile.name.split(".").pop();
    const path = `${user.id}/avatar_${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("posts-media")
      .upload(path, avatarFile, { upsert: true });
    if (error) { toast.error("Image upload failed. Try a smaller photo."); return null; }
    const { data } = supabase.storage.from("posts-media").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    // Upload new avatar if selected
    let profileImage = form.profile_image;
    if (avatarFile) {
      const url = await uploadAvatar();
      if (url) profileImage = url;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ ...form, profile_image: profileImage })
      .eq("user_id", user.id);

    setLoading(false);
    if (error) {
      toast.error("Failed to update profile.");
    } else {
      // Bust the profile cache so ProfileView reloads immediately
      queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
      toast.success("Profile updated!");
      navigate(`/profile/${user.id}`);
    }
  };

  const currentAvatar = avatarPreview || form.profile_image;

  return (
    <div className="max-w-lg mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Edit Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Profile picture */}
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="relative group"
              >
                <div className="h-24 w-24 rounded-full overflow-hidden border-2 border-primary/20 group-hover:border-primary transition-all shadow-sm">
                  {currentAvatar ? (
                    <img src={currentAvatar} className="w-full h-full object-cover" alt="profile" />
                  ) : (
                    <div className="h-full w-full bg-primary/10 flex items-center justify-center">
                      <User className="h-10 w-10 text-primary/50" />
                    </div>
                  )}
                </div>
                <div className="absolute bottom-0.5 right-0.5 h-7 w-7 bg-primary rounded-full flex items-center justify-center shadow-md border-2 border-background">
                  <Camera className="h-3.5 w-3.5 text-white" />
                </div>
              </button>
              <p className="text-xs text-muted-foreground">
                {avatarFile ? "New photo selected — save to apply" : "Tap to change profile photo"}
              </p>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Full Name</label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="Your full name"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Program / Faculty</label>
              <Input
                value={form.program}
                onChange={(e) => setForm({ ...form, program: e.target.value })}
                placeholder="e.g. Computer Science"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Year of Study</label>
              <Input
                type="number"
                min={1}
                max={6}
                value={form.year_of_study}
                onChange={(e) => setForm({ ...form, year_of_study: Number(e.target.value) })}
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Bio</label>
              <Textarea
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                placeholder="Tell other students about yourself..."
                rows={3}
              />
            </div>

            <div className="flex gap-3 pt-1">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? "Saving..." : "Save Changes"}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfileEdit;
