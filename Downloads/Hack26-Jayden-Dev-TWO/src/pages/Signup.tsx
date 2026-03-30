import { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Camera, User } from "lucide-react";

const Signup = () => {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const uploadAvatar = async (userId: string): Promise<string | null> => {
    if (!avatarFile) return null;
    const ext = avatarFile.name.split(".").pop();
    const path = `${userId}/avatar_${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("posts-media")
      .upload(path, avatarFile, { upsert: true });
    if (error) return null;
    const { data } = supabase.storage.from("posts-media").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.endsWith("@mylaurier.ca")) {
      toast.error("You must use a @mylaurier.ca email address.");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }

    // If we have a session right away (email confirmation disabled), upload avatar
    if (data.session && data.user && avatarFile) {
      const imageUrl = await uploadAvatar(data.user.id);
      if (imageUrl) {
        // Small delay to let the profile trigger run first
        await new Promise((r) => setTimeout(r, 800));
        await supabase
          .from("profiles")
          .update({ profile_image: imageUrl })
          .eq("user_id", data.user.id);
      }
    }

    setLoading(false);
    toast.success("Account created! Welcome to Student Talks.");
    navigate("/dashboard");
  };

  const passwordsMatch = confirmPassword === "" || password === confirmPassword;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-2">
          <Link to="/" className="text-2xl font-extrabold text-primary tracking-tight mb-1 inline-block">ST</Link>
          <CardTitle className="text-xl">Create your account</CardTitle>
          <CardDescription>Join Student Talks with your @mylaurier.ca email</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="space-y-4">

            {/* Profile picture picker */}
            <div className="flex flex-col items-center gap-1.5 pb-1">
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="relative group"
              >
                <div className="h-20 w-20 rounded-full bg-primary/10 border-2 border-dashed border-primary/30 group-hover:border-primary overflow-hidden flex items-center justify-center transition-all">
                  {avatarPreview ? (
                    <img src={avatarPreview} className="w-full h-full object-cover" alt="preview" />
                  ) : (
                    <User className="h-8 w-8 text-primary/50" />
                  )}
                </div>
                <div className="absolute bottom-0 right-0 h-6 w-6 bg-primary rounded-full flex items-center justify-center shadow-md">
                  <Camera className="h-3.5 w-3.5 text-white" />
                </div>
              </button>
              <p className="text-xs text-muted-foreground">
                {avatarPreview ? "Tap to change" : "Add profile photo (optional)"}
              </p>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>

            <Input
              placeholder="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
            <Input
              type="email"
              placeholder="you@mylaurier.ca"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="Password (min 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <div className="space-y-1">
              <Input
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className={!passwordsMatch ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {!passwordsMatch && (
                <p className="text-xs text-destructive">Passwords do not match</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={loading || !passwordsMatch}>
              {loading ? "Creating account..." : "Sign Up"}
            </Button>
          </form>
          <p className="text-sm text-muted-foreground text-center mt-4">
            Already have an account?{" "}
            <Link to="/login" className="text-primary font-medium hover:underline">Log in</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Signup;
