import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "react-router-dom";
import { Heart, MessageCircle, Send, Plus, BookOpen, Image, Video, Link2, X, Laugh } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Database } from "@/integrations/supabase/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabaseAny = supabase as any;

type BlogCategory = Database["public"]["Enums"]["post_category"];

const getYoutubeId = (url: string) => {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
  return match ? match[1] : null;
};

// Laugh reactions stored per-user in localStorage (no schema change needed)
const getLaughsForUser = (userId: string): Record<string, boolean> => {
  try { return JSON.parse(localStorage.getItem(`gt_laughs_${userId}`) || "{}"); }
  catch { return {}; }
};

const Dashboard = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Create post state
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", category: "general" as BlogCategory, link: "" });
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video" | null>(null);
  const [uploadTab, setUploadTab] = useState<"file" | "link">("file");

  // Laugh state — persisted per user in localStorage
  const [laughed, setLaughed] = useState<Record<string, boolean>>(
    () => (user ? getLaughsForUser(user.id) : {})
  );

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["feed-posts"],
    queryFn: async () => {
      const { data: postsData, error } = await supabase
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) { console.error("Posts fetch error:", error); return []; }
      if (!postsData || postsData.length === 0) return [];

      const userIds = [...new Set(postsData.map((p) => p.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);

      return postsData.map((p) => ({
        ...p,
        authorName: profiles?.find((pr) => pr.user_id === p.user_id)?.full_name || "Unknown",
      }));
    },
  });

  const { data: likes = [] } = useQuery({
    queryKey: ["all-likes"],
    queryFn: async () => {
      const { data } = await supabaseAny.from("likes").select("*");
      return data || [];
    },
  });

  const handleLike = async (postId: string, e: React.MouseEvent) => {
    e.preventDefault();
    if (!user) return;
    const already = likes.find((l: any) => l.post_id === postId && l.user_id === user.id);
    if (already) {
      await supabaseAny.from("likes").delete().eq("post_id", postId).eq("user_id", user.id);
    } else {
      await supabaseAny.from("likes").insert({ post_id: postId, user_id: user.id });
    }
    queryClient.invalidateQueries({ queryKey: ["all-likes"] });
  };

  const handleLaugh = (postId: string, e: React.MouseEvent) => {
    e.preventDefault();
    if (!user) return;
    const next = { ...laughed, [postId]: !laughed[postId] };
    setLaughed(next);
    localStorage.setItem(`gt_laughs_${user.id}`, JSON.stringify(next));
  };

  const handleDM = async (post: any, e: React.MouseEvent) => {
    e.preventDefault();
    if (!user) return;
    if (post.user_id === user.id) { toast.error("That's your own post!"); return; }
    // Ensure conversation exists
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .or(`and(participant_1.eq.${user.id},participant_2.eq.${post.user_id}),and(participant_1.eq.${post.user_id},participant_2.eq.${user.id})`)
      .maybeSingle();
    if (!existing) {
      await supabase.from("conversations").insert({
        participant_1: user.id,
        participant_2: post.user_id,
        last_message_at: new Date().toISOString(),
      });
    }
    navigate("/messages", { state: { openUserId: post.user_id, openUserName: post.authorName } });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
    setMediaType(file.type.startsWith("video") ? "video" : "image");
  };

  const uploadMedia = async (): Promise<string | null> => {
    if (!mediaFile || !user) return null;
    const ext = mediaFile.name.split(".").pop();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("posts-media").upload(path, mediaFile);
    if (error) { toast.error("Media upload failed"); return null; }
    const { data } = supabase.storage.from("posts-media").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return toast.error("You must be logged in.");
    if (!form.title.trim()) return toast.error("Title is required.");
    setCreating(true);
    let media_url = "";
    if (uploadTab === "file" && mediaFile) {
      const url = await uploadMedia();
      if (url) media_url = url;
    } else if (uploadTab === "link" && form.link) {
      media_url = form.link;
    }
    const { error } = await supabase.from("posts").insert({
      user_id: user.id,
      title: form.title,
      content: form.content,
      category: form.category,
      ...(media_url && { image_url: media_url }),
    });
    setCreating(false);
    if (error) return toast.error("Failed to create post.");
    toast.success("Post shared!");
    setShowCreate(false);
    setForm({ title: "", content: "", category: "general", link: "" });
    setMediaFile(null);
    setMediaPreview(null);
    setMediaType(null);
    queryClient.invalidateQueries({ queryKey: ["feed-posts"] });
    queryClient.invalidateQueries({ queryKey: ["blog-posts"] });
  };

  const renderMedia = (post: any) => {
    const url = post.image_url;
    if (!url) return null;
    const ytId = getYoutubeId(url);
    if (ytId) return (
      <div className="w-full aspect-video">
        <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${ytId}`} allowFullScreen />
      </div>
    );
    if (url.includes("tiktok.com")) return (
      <div className="bg-black p-3 text-center">
        <a href={url} target="_blank" rel="noreferrer" className="text-white text-sm underline">View TikTok →</a>
      </div>
    );
    if (url.match(/\.(mp4|mov|webm)$/i)) return (
      <video src={url} className="w-full max-h-[600px] object-cover" controls />
    );
    return <img src={url} alt={post.title} className="w-full max-h-[600px] object-cover" />;
  };

  return (
    <div className="max-w-[470px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between py-3 mb-0 border-b sticky top-0 bg-background z-10">
        <span className="text-xl font-bold tracking-tight" style={{ fontFamily: "serif" }}>Student Talks</span>
        <Button size="sm" variant="ghost" className="gap-1 rounded-full font-semibold text-sm" onClick={() => setShowCreate(!showCreate)}>
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      {/* Create Post Panel */}
      {showCreate && (
        <div className="border-b py-4 bg-card">
          <div className="flex items-center gap-3 px-1 mb-3">
            <div className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center font-bold text-sm text-primary shrink-0">
              {user?.email?.[0]?.toUpperCase() || "?"}
            </div>
            <p className="text-sm font-semibold">{user?.email?.split("@")[0]}</p>
            <button onClick={() => setShowCreate(false)} className="ml-auto p-1 hover:bg-muted rounded-full">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
          <form onSubmit={handleCreate} className="space-y-3 px-1">
            <Input placeholder="Title *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required className="border-0 border-b rounded-none px-0 text-sm focus-visible:ring-0 bg-transparent" />
            <Textarea placeholder="Share something with the campus..." value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={3} className="border-0 rounded-none px-0 text-sm focus-visible:ring-0 resize-none bg-transparent" />

            <div className="border rounded-xl overflow-hidden">
              <div className="flex border-b">
                <button type="button" onClick={() => setUploadTab("file")}
                  className={`flex-1 py-1.5 text-xs font-medium flex items-center justify-center gap-1 ${uploadTab === "file" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  <Image className="h-3 w-3" /> Photo/Video
                </button>
                <button type="button" onClick={() => setUploadTab("link")}
                  className={`flex-1 py-1.5 text-xs font-medium flex items-center justify-center gap-1 ${uploadTab === "link" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  <Link2 className="h-3 w-3" /> YouTube/TikTok
                </button>
              </div>
              {uploadTab === "file" ? (
                <div className="p-2">
                  <div className="border-2 border-dashed rounded-lg p-3 text-center cursor-pointer hover:bg-muted/50"
                    onClick={() => document.getElementById("dashMedia")?.click()}>
                    {mediaPreview
                      ? (mediaType === "video" ? <video src={mediaPreview} className="max-h-28 mx-auto rounded" controls /> : <img src={mediaPreview} className="max-h-28 mx-auto rounded object-cover" />)
                      : <div className="flex items-center justify-center gap-2 text-muted-foreground"><Image className="h-4 w-4" /><Video className="h-4 w-4" /><span className="text-xs">Upload photo or video</span></div>
                    }
                  </div>
                  <input id="dashMedia" type="file" accept="image/*,video/*" className="hidden" onChange={handleFileChange} />
                </div>
              ) : (
                <div className="p-2">
                  <Input placeholder="Paste YouTube or TikTok URL..." value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} className="text-sm" />
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <select className="flex-1 border rounded-lg px-2 py-1.5 text-xs bg-background"
                value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as BlogCategory })}>
                <option value="general">General</option>
                <option value="blog">Blog</option>
                <option value="academic">Academic</option>
                <option value="campus">Campus</option>
              </select>
              <Button type="submit" size="sm" className="rounded-full px-5" disabled={creating}>
                {creating ? "Sharing..." : "Share"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Feed */}
      {isLoading ? (
        <div className="space-y-4 py-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse border-b pb-4">
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className="h-9 w-9 rounded-full bg-muted" />
                <div className="h-3 w-28 bg-muted rounded" />
              </div>
              <div className="h-64 bg-muted w-full" />
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="py-20 text-center">
          <BookOpen className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground font-medium">No posts yet</p>
          <p className="text-sm text-muted-foreground mt-1">Be the first to share something with the campus!</p>
          <button onClick={() => setShowCreate(true)} className="text-primary text-sm font-semibold mt-3 inline-block">
            Create a post
          </button>
        </div>
      ) : (
        <div>
          {posts.map((post: any) => {
            const postLikes = likes.filter((l: any) => l.post_id === post.id);
            const userLiked = likes.some((l: any) => l.post_id === post.id && l.user_id === user?.id);
            const userLaughed = !!laughed[post.id];
            const isOwn = post.user_id === user?.id;
            const initial = post.authorName?.[0]?.toUpperCase() || "?";

            return (
              <article key={post.id} className="border-b last:border-0">
                {/* Author header */}
                <div className="flex items-center gap-2.5 px-1 py-3">
                  <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary/40 to-primary flex items-center justify-center font-bold text-sm text-white shrink-0 ring-2 ring-primary/20">
                    {initial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold leading-tight truncate">{post.authorName}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })} ·{" "}
                      <span className="capitalize">{post.category}</span>
                    </p>
                  </div>
                </div>

                {/* Media — edge-to-edge */}
                {post.image_url && (
                  <div className="-mx-4 sm:-mx-6">
                    {renderMedia(post)}
                  </div>
                )}

                {/* Action bar */}
                <div className="flex items-center px-1 pt-2 pb-1 gap-1">
                  {/* Heart */}
                  <button
                    onClick={(e) => handleLike(post.id, e)}
                    className={`p-2 rounded-full transition-all active:scale-90 ${userLiked ? "text-red-500" : "text-foreground hover:text-red-400"}`}
                  >
                    <Heart className={`h-6 w-6 ${userLiked ? "fill-red-500" : ""}`} strokeWidth={userLiked ? 0 : 2} />
                  </button>

                  {/* Laugh */}
                  <button
                    onClick={(e) => handleLaugh(post.id, e)}
                    className={`p-2 rounded-full transition-all active:scale-90 ${userLaughed ? "text-yellow-500" : "text-foreground hover:text-yellow-400"}`}
                    title="Haha"
                  >
                    {userLaughed
                      ? <span className="text-xl leading-none">😂</span>
                      : <Laugh className="h-6 w-6" />
                    }
                  </button>

                  {/* Comment */}
                  <Link to={`/blogs/${post.id}`} className="p-2 rounded-full text-foreground hover:text-primary transition-colors">
                    <MessageCircle className="h-6 w-6" />
                  </Link>

                  {/* Private DM — only on other people's posts */}
                  {!isOwn && (
                    <button
                      onClick={(e) => handleDM(post, e)}
                      className="p-2 rounded-full text-foreground hover:text-primary transition-colors"
                      title={`Message ${post.authorName?.split(" ")[0]}`}
                    >
                      <Send className="h-6 w-6" />
                    </button>
                  )}
                </div>

                {/* Likes + laughs count */}
                <div className="px-1 pb-1 flex items-center gap-3">
                  {postLikes.length > 0 && (
                    <p className="text-sm font-semibold">
                      {postLikes.length} {postLikes.length === 1 ? "like" : "likes"}
                    </p>
                  )}
                  {userLaughed && (
                    <p className="text-sm text-yellow-600 font-medium">😂 You laughed at this</p>
                  )}
                </div>

                {/* Caption */}
                <div className="px-1 pb-2">
                  <p className="text-sm">
                    <span className="font-semibold mr-1">{post.authorName?.split(" ")[0]}</span>
                    <span className="font-medium">{post.title}</span>
                  </p>
                  {post.content && (
                    <p className="text-sm text-muted-foreground mt-0.5 leading-snug">{post.content}</p>
                  )}
                </div>

                {/* Comments link */}
                <Link
                  to={`/blogs/${post.id}`}
                  className="block px-1 pb-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {post.comments_count > 0
                    ? `View all ${post.comments_count} comments`
                    : "Add a comment..."}
                </Link>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
