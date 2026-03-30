import { useState } from "react";
import type React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Plus, BookOpen, FlaskConical, Palette, Leaf,
  Heart, MessageCircle, Image, Video, Link2, Trash2,
  Send, Laugh, ChevronDown, ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabaseAny = supabase as any;

type BlogPost = Database["public"]["Tables"]["posts"]["Row"] & {
  image_url?: string;
  authorName?: string;
};
type BlogCategory = Database["public"]["Enums"]["post_category"];

const categories = [
  { name: "Blog", value: "blog", icon: BookOpen },
  { name: "Academic", value: "academic", icon: FlaskConical },
  { name: "Campus", value: "campus", icon: Leaf },
  { name: "General", value: "general", icon: Palette },
] as const;

const getYoutubeId = (url: string) => {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
  return match ? match[1] : null;
};

const getLaughsForUser = (userId: string): Record<string, boolean> => {
  try { return JSON.parse(localStorage.getItem(`gt_laughs_${userId}`) || "{}"); }
  catch { return {}; }
};

const Blogs = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", category: "general" as BlogCategory, link: "" });
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<BlogCategory | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video" | null>(null);
  const [uploadTab, setUploadTab] = useState<"file" | "link">("file");

  // laugh state persisted in localStorage
  const [laughed, setLaughed] = useState<Record<string, boolean>>(
    () => (user ? getLaughsForUser(user.id) : {})
  );

  // Which posts have comments expanded
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  // Inline comment inputs
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  // Posting state per post
  const [postingComment, setPostingComment] = useState<Record<string, boolean>>({});

  const { data: posts = [], isLoading } = useQuery<BlogPost[]>({
    queryKey: ["blog-posts", selectedCategory],
    queryFn: async () => {
      let query = supabase.from("posts").select("*");
      if (selectedCategory) query = query.eq("category", selectedCategory);
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) { toast.error("Failed to load posts."); return []; }
      if (!data || data.length === 0) return [];

      // Fetch author names
      const userIds = [...new Set(data.map((p) => p.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);

      return data.map((p) => ({
        ...p,
        authorName: profiles?.find((pr) => pr.user_id === p.user_id)?.full_name || "Unknown",
      })) as BlogPost[];
    },
  });

  const { data: likes = [] } = useQuery({
    queryKey: ["all-likes"],
    queryFn: async () => {
      const { data } = await supabaseAny.from("likes").select("*");
      return data || [];
    },
  });

  // Comments per expanded post
  const { data: allComments = {} } = useQuery({
    queryKey: ["blogs-comments", Object.keys(expandedComments).filter(k => expandedComments[k])],
    queryFn: async () => {
      const postIds = Object.keys(expandedComments).filter(k => expandedComments[k]);
      if (postIds.length === 0) return {};
      const { data: rawComments } = await supabase
        .from("comments")
        .select("*")
        .in("post_id", postIds)
        .order("created_at", { ascending: true });
      if (!rawComments || rawComments.length === 0) return {};

      const userIds = [...new Set(rawComments.map((c) => c.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);

      const grouped: Record<string, any[]> = {};
      rawComments.forEach((c) => {
        const name = profiles?.find(p => p.user_id === c.user_id)?.full_name || "Unknown";
        if (!grouped[c.post_id]) grouped[c.post_id] = [];
        grouped[c.post_id].push({ ...c, authorName: name });
      });
      return grouped;
    },
    enabled: Object.values(expandedComments).some(Boolean),
  });

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
    toast.success("Post created!");
    setOpen(false);
    setForm({ title: "", content: "", category: "general", link: "" });
    setMediaFile(null); setMediaPreview(null); setMediaType(null);
    queryClient.invalidateQueries({ queryKey: ["blog-posts"] });
    queryClient.invalidateQueries({ queryKey: ["feed-posts"] });
  };

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

  const handleDM = async (post: BlogPost, e: React.MouseEvent) => {
    e.preventDefault();
    if (!user || post.user_id === user.id) { toast.error("That's your own post!"); return; }
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

  const handleDeletePost = async (postId: string, e: React.MouseEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!confirm("Delete this post? This cannot be undone.")) return;
    await supabase.from("comments").delete().eq("post_id", postId);
    await supabaseAny.from("likes").delete().eq("post_id", postId);
    await supabase.from("posts").delete().eq("id", postId);
    toast.success("Post deleted");
    queryClient.invalidateQueries({ queryKey: ["blog-posts"] });
    queryClient.invalidateQueries({ queryKey: ["feed-posts"] });
  };

  const toggleComments = (postId: string) => {
    setExpandedComments(prev => ({ ...prev, [postId]: !prev[postId] }));
    queryClient.invalidateQueries({ queryKey: ["blogs-comments"] });
  };

  const submitComment = async (postId: string) => {
    const text = commentInputs[postId]?.trim();
    if (!text || !user) return;
    setPostingComment(prev => ({ ...prev, [postId]: true }));
    await supabase.from("comments").insert({ post_id: postId, user_id: user.id, content: text });
    setCommentInputs(prev => ({ ...prev, [postId]: "" }));
    setPostingComment(prev => ({ ...prev, [postId]: false }));
    // Refresh both comments and post list (to update comments_count)
    queryClient.invalidateQueries({ queryKey: ["blogs-comments"] });
    queryClient.invalidateQueries({ queryKey: ["blog-posts"] });
    queryClient.invalidateQueries({ queryKey: ["feed-posts"] });
    toast.success("Comment posted!");
  };

  const filteredPosts = posts.filter((p) =>
    (p.title + (p.content || "")).toLowerCase().includes(search.toLowerCase())
  );

  const renderMediaPreview = (post: BlogPost) => {
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
        <a href={url} target="_blank" rel="noreferrer" className="text-white text-sm underline">View TikTok</a>
      </div>
    );
    if (url.match(/\.(mp4|mov|webm)$/i)) return (
      <video src={url} className="w-full max-h-64 object-cover" controls />
    );
    return <img src={url} alt={post.title} className="w-full max-h-64 object-cover" />;
  };

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Blogs</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button disabled={!user}><Plus className="h-4 w-4 mr-1" />New Post</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Create a Post</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <Input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              <Textarea placeholder="Share your thoughts..." value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={4} />
              <div className="border rounded-xl overflow-hidden">
                <div className="flex border-b">
                  <button type="button" onClick={() => setUploadTab("file")}
                    className={`flex-1 py-2 text-sm font-medium flex items-center justify-center gap-1 ${uploadTab === "file" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    <Image className="h-3.5 w-3.5" /> Photo/Video
                  </button>
                  <button type="button" onClick={() => setUploadTab("link")}
                    className={`flex-1 py-2 text-sm font-medium flex items-center justify-center gap-1 ${uploadTab === "link" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    <Link2 className="h-3.5 w-3.5" /> YouTube/TikTok
                  </button>
                </div>
                {uploadTab === "file" ? (
                  <div className="p-3">
                    <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-muted/50"
                      onClick={() => document.getElementById("postMedia")?.click()}>
                      {mediaPreview
                        ? (mediaType === "video" ? <video src={mediaPreview} className="max-h-40 mx-auto rounded" controls /> : <img src={mediaPreview} className="max-h-40 mx-auto rounded object-cover" />)
                        : <div className="flex flex-col items-center gap-1 text-muted-foreground"><div className="flex gap-2"><Image className="h-5 w-5" /><Video className="h-5 w-5" /></div><p className="text-sm">Click to upload photo or video</p></div>
                      }
                    </div>
                    <input id="postMedia" type="file" accept="image/*,video/*" className="hidden" onChange={handleFileChange} />
                  </div>
                ) : (
                  <div className="p-3">
                    <Input placeholder="Paste YouTube or TikTok URL..." value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} />
                  </div>
                )}
              </div>
              <select className="w-full border rounded-md p-2 bg-background" value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as BlogCategory })}>
                {categories.map((c) => <option key={c.value} value={c.value}>{c.name}</option>)}
              </select>
              <Button type="submit" className="w-full" disabled={creating}>{creating ? "Posting..." : "Publish"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <Input placeholder="Search posts..." value={search} onChange={(e) => setSearch(e.target.value)} />

      {/* Category filters */}
      <div className="flex gap-2 flex-wrap">
        {categories.map((cat) => {
          const Icon = cat.icon;
          return (
            <Button key={cat.value} variant={selectedCategory === cat.value ? "default" : "outline"}
              onClick={() => setSelectedCategory(selectedCategory === cat.value ? null : cat.value)}
              className="flex items-center gap-2">
              <Icon className="h-4 w-4" />{cat.name}
            </Button>
          );
        })}
      </div>

      {/* Posts */}
      {isLoading ? (
        <div className="text-center py-20 text-muted-foreground">Loading posts...</div>
      ) : filteredPosts.length > 0 ? (
        <div className="space-y-4">
          {filteredPosts.map((p) => {
            const postLikes = likes.filter((l: any) => l.post_id === p.id);
            const userLiked = likes.some((l: any) => l.post_id === p.id && l.user_id === user?.id);
            const userLaughed = !!laughed[p.id];
            const isOwn = p.user_id === user?.id;
            const commentsExpanded = !!expandedComments[p.id];
            const postComments = (allComments as any)[p.id] || [];
            const commentCount = commentsExpanded ? postComments.length : (p.comments_count || 0);
            const initial = (p as any).authorName?.[0]?.toUpperCase() || "?";

            return (
              <div key={p.id} className="bg-card border rounded-2xl overflow-hidden shadow-sm">
                {/* Author header */}
                <div className="flex items-center gap-2.5 px-4 py-3">
                  <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary/40 to-primary flex items-center justify-center font-bold text-sm text-white shrink-0">
                    {initial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{(p as any).authorName || "Unknown"}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })} ·{" "}
                      <span className="capitalize">{p.category}</span>
                    </p>
                  </div>
                  {isOwn && (
                    <button onClick={(e) => handleDeletePost(p.id, e)} className="p-1.5 text-muted-foreground hover:text-destructive rounded-full transition-colors" title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Media */}
                {p.image_url && renderMediaPreview(p)}

                {/* Title + content */}
                <Link to={`/blogs/${p.id}`} className="block px-4 pt-3">
                  <p className="font-semibold text-base leading-tight">{p.title}</p>
                  {p.content && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{p.content}</p>}
                </Link>

                {/* Action bar */}
                <div className="flex items-center px-3 pt-2 pb-1 gap-0.5">
                  <button onClick={(e) => handleLike(p.id, e)}
                    className={`p-2 rounded-full transition-all active:scale-90 ${userLiked ? "text-red-500" : "text-foreground hover:text-red-400"}`}>
                    <Heart className={`h-6 w-6 ${userLiked ? "fill-red-500" : ""}`} strokeWidth={userLiked ? 0 : 2} />
                  </button>
                  <button onClick={(e) => handleLaugh(p.id, e)}
                    className={`p-2 rounded-full transition-all active:scale-90 ${userLaughed ? "text-yellow-500" : "text-foreground hover:text-yellow-400"}`}>
                    {userLaughed ? <span className="text-xl">😂</span> : <Laugh className="h-6 w-6" />}
                  </button>
                  <button onClick={() => toggleComments(p.id)}
                    className="p-2 rounded-full text-foreground hover:text-primary transition-colors">
                    <MessageCircle className="h-6 w-6" />
                  </button>
                  {!isOwn && (
                    <button onClick={(e) => handleDM(p, e)}
                      className="p-2 rounded-full text-foreground hover:text-primary transition-colors" title="Message">
                      <Send className="h-6 w-6" />
                    </button>
                  )}
                </div>

                {/* Counts */}
                <div className="px-4 pb-1 flex items-center gap-3 text-sm">
                  {postLikes.length > 0 && (
                    <span className="font-semibold">{postLikes.length} {postLikes.length === 1 ? "like" : "likes"}</span>
                  )}
                  {userLaughed && <span className="text-yellow-600">😂 You laughed</span>}
                </div>

                {/* Comments toggle button */}
                <button
                  onClick={() => toggleComments(p.id)}
                  className="flex items-center gap-1 px-4 pb-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {commentsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  {commentCount > 0 ? `${commentCount} comment${commentCount !== 1 ? "s" : ""}` : "Add a comment"}
                </button>

                {/* Expanded comments */}
                {commentsExpanded && (
                  <div className="border-t px-4 py-3 space-y-3">
                    {postComments.length > 0 ? (
                      postComments.map((c: any) => (
                        <div key={c.id} className="flex items-start gap-2">
                          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center font-bold text-xs text-primary shrink-0 mt-0.5">
                            {c.authorName?.[0]?.toUpperCase() || "?"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm">
                              <span className="font-semibold mr-1">{c.authorName}</span>
                              {c.content}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No comments yet — be the first!</p>
                    )}

                    {/* Inline comment input */}
                    {user && (
                      <div className="flex items-center gap-2 pt-1">
                        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center font-bold text-xs text-primary shrink-0">
                          {user.email?.[0]?.toUpperCase() || "?"}
                        </div>
                        <input
                          className="flex-1 text-sm bg-muted rounded-full px-3 py-1.5 outline-none focus:ring-1 focus:ring-primary"
                          placeholder="Add a comment..."
                          value={commentInputs[p.id] || ""}
                          onChange={(e) => setCommentInputs(prev => ({ ...prev, [p.id]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter") submitComment(p.id); }}
                        />
                        <button
                          onClick={() => submitComment(p.id)}
                          disabled={!commentInputs[p.id]?.trim() || postingComment[p.id]}
                          className="text-primary font-semibold text-sm disabled:opacity-40"
                        >
                          Post
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-20">
          <BookOpen className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">No matching posts found.</p>
        </div>
      )}
    </div>
  );
};

export default Blogs;
