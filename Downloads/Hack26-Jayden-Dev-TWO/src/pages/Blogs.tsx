import { useState } from "react";
import type React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, BookOpen, FlaskConical, Palette, Leaf, Heart, MessageCircle, Image, Video, Link2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabaseAny = supabase as any;

type BlogPost = Database["public"]["Tables"]["posts"]["Row"] & {
  media_url?: string;
  media_type?: string;
  image_url?: string;
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

const Blogs = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", category: "general" as BlogCategory, link: "" });
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<BlogCategory | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video" | null>(null);
  const [uploadTab, setUploadTab] = useState<"file" | "link">("file");

  const { data: posts = [], isLoading } = useQuery<BlogPost[]>({
    queryKey: ["blog-posts", selectedCategory],
    queryFn: async () => {
      let query = supabase.from("posts").select("*");
      if (selectedCategory) query = query.eq("category", selectedCategory);
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) { toast.error("Failed to load posts."); return []; }
      return data as BlogPost[];
    },
  });

  const { data: likes = [] } = useQuery({
    queryKey: ["all-likes"],
    queryFn: async () => {
      const { data } = await supabaseAny.from("likes").select("*");
      return data || [];
    },
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
    setMediaFile(null);
    setMediaPreview(null);
    setMediaType(null);
    queryClient.invalidateQueries({ queryKey: ["blog-posts"] });
    queryClient.invalidateQueries({ queryKey: ["all-likes"] });
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

  const filteredPosts = posts.filter((p) =>
    (p.title + p.content).toLowerCase().includes(search.toLowerCase())
  );

  const renderMediaPreview = (post: BlogPost) => {
    const url = post.image_url;
    if (!url) return null;
    const ytId = getYoutubeId(url);
    if (ytId) return (
      <div className="w-full aspect-video">
        <iframe className="w-full h-full rounded-t-2xl" src={`https://www.youtube.com/embed/${ytId}`} allowFullScreen />
      </div>
    );
    if (url.includes("tiktok.com")) return (
      <div className="bg-black rounded-t-2xl p-3 text-center">
        <a href={url} target="_blank" rel="noreferrer" className="text-white text-sm underline">View TikTok</a>
      </div>
    );
    if (url.match(/\.(mp4|mov|webm)$/i)) return (
      <video src={url} className="w-full rounded-t-2xl max-h-64 object-cover" controls />
    );
    return <img src={url} alt={post.title} className="w-full rounded-t-2xl max-h-64 object-cover" />;
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">School Blogs</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button disabled={!user}><Plus className="h-4 w-4 mr-1" />New Post</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Create a Post</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <Input
                placeholder="Title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
              <Textarea
                placeholder="Share your thoughts..."
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                rows={4}
              />

              {/* Media tabs */}
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
                    <div
                      className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-muted/50"
                      onClick={() => document.getElementById("postMedia")?.click()}
                    >
                      {mediaPreview ? (
                        mediaType === "video"
                          ? <video src={mediaPreview} className="max-h-40 mx-auto rounded" controls />
                          : <img src={mediaPreview} className="max-h-40 mx-auto rounded object-cover" />
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-muted-foreground">
                          <div className="flex gap-2">
                            <Image className="h-5 w-5" />
                            <Video className="h-5 w-5" />
                          </div>
                          <p className="text-sm">Click to upload photo or video</p>
                        </div>
                      )}
                    </div>
                    <input id="postMedia" type="file" accept="image/*,video/*" className="hidden" onChange={handleFileChange} />
                  </div>
                ) : (
                  <div className="p-3">
                    <Input
                      placeholder="Paste YouTube or TikTok URL..."
                      value={form.link}
                      onChange={(e) => setForm({ ...form, link: e.target.value })}
                    />
                  </div>
                )}
              </div>

              <select
                className="w-full border rounded-md p-2 bg-background"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as BlogCategory })}
              >
                {categories.map((c) => <option key={c.value} value={c.value}>{c.name}</option>)}
              </select>

              <Button type="submit" className="w-full" disabled={creating}>
                {creating ? "Posting..." : "Publish"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <Input placeholder="Search blog posts..." value={search} onChange={(e) => setSearch(e.target.value)} />

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        {categories.map((cat) => {
          const Icon = cat.icon;
          return (
            <Button
              key={cat.value}
              variant={selectedCategory === cat.value ? "default" : "outline"}
              onClick={() => setSelectedCategory(selectedCategory === cat.value ? null : cat.value)}
              className="flex items-center gap-2"
            >
              <Icon className="h-4 w-4" />{cat.name}
            </Button>
          );
        })}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="text-center py-20 text-muted-foreground">Loading posts...</div>
      ) : filteredPosts.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPosts.map((p) => {
            const postLikes = likes.filter((l: any) => l.post_id === p.id);
            const userLiked = likes.some((l: any) => l.post_id === p.id && l.user_id === user?.id);
            return (
              <div key={p.id} className="bg-card border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition flex flex-col">
                {/* Media */}
                {renderMediaPreview(p)}

                {/* Content */}
                <Link to={`/blogs/${p.id}`} className="flex-1 p-4 space-y-2 block">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted inline-block capitalize">{p.category}</span>
                  <h3 className="font-semibold text-base leading-tight">{p.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">{p.content}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(p.created_at), "MMM d, yyyy")}</p>
                </Link>

                {/* Actions */}
                <div className="flex items-center gap-4 px-4 py-3 border-t">
                  <button
                    onClick={(e) => handleLike(p.id, e)}
                    className={`flex items-center gap-1 text-sm transition-colors ${userLiked ? "text-red-500" : "text-muted-foreground hover:text-red-500"}`}
                  >
                    <Heart className={`h-4 w-4 ${userLiked ? "fill-red-500" : ""}`} />
                    {postLikes.length}
                  </button>
                  <Link to={`/blogs/${p.id}`} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
                    <MessageCircle className="h-4 w-4" />
                    {p.comments_count || 0}
                  </Link>
                  <button
                    onClick={() => { navigator.clipboard.writeText(window.location.origin + `/blogs/${p.id}`); toast.success("Link copied!"); }}
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary ml-auto"
                  >
                    Share
                  </button>
                </div>
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