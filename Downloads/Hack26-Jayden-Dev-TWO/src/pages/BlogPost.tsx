import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";
import { MessageCircle, Heart, Share2, UserPlus, UserCheck, ArrowLeft, Trash2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

const supabaseAny = supabase as any;

type BlogPost = Database["public"]["Tables"]["posts"]["Row"] & { image_url?: string };
type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type CommentRow = Database["public"]["Tables"]["comments"]["Row"];
type Comment = CommentRow & { user: Profile | null };

const getYoutubeId = (url: string) => {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
  return match ? match[1] : null;
};

const BlogPostPage = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [commentText, setCommentText] = useState("");
  const [sendingDM, setSendingDM] = useState(false);

  const { data: post } = useQuery({
    queryKey: ["post", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("posts").select("*").eq("id", id).single();
      if (error) throw error;
      return data as BlogPost;
    },
  });

  const { data: author } = useQuery({
    queryKey: ["post-author", post?.user_id],
    enabled: !!post,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("user_id", post!.user_id).single();
      if (error) throw error;
      return data as Profile;
    },
  });

  const { data: comments = [] } = useQuery({
    queryKey: ["comments", id],
    queryFn: async () => {
      const { data: rawComments, error } = await supabase
        .from("comments").select("*").eq("post_id", id).order("created_at", { ascending: true });
      if (error) throw error;
      const userIds = rawComments.map((c) => c.user_id);
      const { data: profiles } = await supabase.from("profiles").select("*").in("user_id", userIds);
      return rawComments.map((c) => ({
        ...c,
        user: profiles?.find((p) => p.user_id === c.user_id) || null,
      })) as Comment[];
    },
  });

  const { data: likes = [] } = useQuery({
    queryKey: ["likes", id],
    queryFn: async () => {
      const { data } = await supabaseAny.from("likes").select("*").eq("post_id", id);
      return data || [];
    },
  });

  const { data: follows = [] } = useQuery({
    queryKey: ["follows", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabaseAny.from("follows").select("*").eq("follower_id", user!.id);
      return data || [];
    },
  });

  const userLiked = likes.some((l: any) => l.user_id === user?.id);
  const userFollows = follows.some((f: any) => f.following_id === post?.user_id);
  const isOwnPost = user?.id === post?.user_id;

  const handleLike = async () => {
    if (!user) return;
    if (userLiked) {
      await supabaseAny.from("likes").delete().eq("post_id", id).eq("user_id", user.id);
    } else {
      await supabaseAny.from("likes").insert({ post_id: id, user_id: user.id });
    }
    queryClient.invalidateQueries({ queryKey: ["likes", id] });
    queryClient.invalidateQueries({ queryKey: ["all-likes"] });
  };

  const handleFollow = async () => {
    if (!user || !post) return;
    if (userFollows) {
      await supabaseAny.from("follows").delete().eq("follower_id", user.id).eq("following_id", post.user_id);
    } else {
      await supabaseAny.from("follows").insert({ follower_id: user.id, following_id: post.user_id });
    }
    queryClient.invalidateQueries({ queryKey: ["follows", user.id] });
  };

  const handleDeletePost = async () => {
    if (!post || !user || user.id !== post.user_id) return;
    if (!confirm("Delete this post? This cannot be undone.")) return;
    await supabase.from("comments").delete().eq("post_id", id);
    await supabaseAny.from("likes").delete().eq("post_id", id);
    await supabase.from("posts").delete().eq("id", id);
    toast.success("Post deleted");
    navigate("/blogs");
  };

  const handleDeleteComment = async (commentId: string) => {
    await supabase.from("comments").delete().eq("id", commentId);
    queryClient.invalidateQueries({ queryKey: ["comments", id] });
  };

  const addComment = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not logged in");
      const { error } = await supabase.from("comments").insert({ post_id: id, user_id: user.id, content: commentText });
      if (error) throw error;
    },
    onSuccess: () => {
      setCommentText("");
      queryClient.invalidateQueries({ queryKey: ["comments", id] });
      toast.success("Comment posted!");
    },
  });

  const handlePrivateMessage = async () => {
    if (!user || !post) return;
    if (user.id === post.user_id) { toast.error("You can't message yourself!"); return; }
    setSendingDM(true);
    try {
      const { data: existing } = await supabase.from("conversations").select("id")
        .or(`and(participant_1.eq.${user.id},participant_2.eq.${post.user_id}),and(participant_1.eq.${post.user_id},participant_2.eq.${user.id})`)
        .maybeSingle();
      if (!existing) {
        await supabase.from("conversations").insert({
          participant_1: user.id, participant_2: post.user_id, last_message_at: new Date().toISOString(),
        });
      }
      navigate("/messages", { state: { openUserId: post.user_id, openUserName: author?.full_name || "User" } });
    } catch { toast.error("Could not open conversation."); }
    finally { setSendingDM(false); }
  };

  const renderMedia = () => {
    const url = post?.image_url;
    if (!url) return null;
    const ytId = getYoutubeId(url);
    if (ytId) return (
      <div className="w-full aspect-video rounded-xl overflow-hidden">
        <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${ytId}`} allowFullScreen />
      </div>
    );
    if (url.includes("tiktok.com")) return (
      <div className="bg-black rounded-xl p-4 text-center">
        <a href={url} target="_blank" rel="noreferrer" className="text-white underline">View TikTok →</a>
      </div>
    );
    if (url.match(/\.(mp4|mov|webm)$/i)) return (
      <video src={url} className="w-full rounded-xl max-h-[500px] object-cover" controls />
    );
    return <img src={url} alt={post?.title} className="w-full rounded-xl max-h-[500px] object-cover" />;
  };

  if (!post) return <div className="p-6 text-muted-foreground text-sm">Loading...</div>;

  return (
    <div className="max-w-[470px] mx-auto pb-10">
      {/* Back button */}
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      {/* Author row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center font-bold text-sm text-primary shrink-0">
            {author?.full_name?.[0]?.toUpperCase() || "?"}
          </div>
          <div>
            <p className="text-sm font-semibold">{author?.full_name || "Unknown"}</p>
            <p className="text-xs text-muted-foreground">{format(new Date(post.created_at), "MMM d, yyyy")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isOwnPost && user && (
            <>
              <Button variant="outline" size="sm" onClick={handleFollow} className="gap-1 rounded-full text-xs h-8 px-3">
                {userFollows ? <><UserCheck className="h-3.5 w-3.5" />Following</> : <><UserPlus className="h-3.5 w-3.5" />Follow</>}
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrivateMessage} disabled={sendingDM} className="gap-1 rounded-full text-xs h-8 px-3">
                <MessageCircle className="h-3.5 w-3.5" />
                {sendingDM ? "..." : "Message"}
              </Button>
            </>
          )}
          {isOwnPost && (
            <button onClick={handleDeletePost} className="p-2 text-muted-foreground hover:text-destructive rounded-full transition-colors" title="Delete post">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Media */}
      {renderMedia()}

      {/* Actions */}
      <div className="flex items-center gap-4 py-2 mt-1">
        <button onClick={handleLike}
          className={`transition-transform active:scale-90 ${userLiked ? "text-red-500" : "text-foreground hover:text-red-500"}`}>
          <Heart className={`h-6 w-6 ${userLiked ? "fill-red-500" : ""}`} />
        </button>
        <button className="text-foreground"><MessageCircle className="h-6 w-6" /></button>
        <button
          onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success("Link copied!"); }}
          className="text-foreground hover:text-primary"
        >
          <Share2 className="h-6 w-6" />
        </button>
      </div>

      {/* Likes count */}
      {likes.length > 0 && (
        <p className="text-sm font-semibold mb-1">{likes.length} {likes.length === 1 ? "like" : "likes"}</p>
      )}

      {/* Title + content */}
      <div className="mb-3">
        <p className="text-sm">
          <span className="font-semibold mr-1">{author?.full_name?.split(" ")[0] || "User"}</span>
          {post.title}
        </p>
        {post.content && (
          <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{post.content}</p>
        )}
      </div>

      {/* Category pill */}
      <span className="text-xs bg-muted px-2 py-0.5 rounded-full capitalize">{post.category}</span>

      {/* Comments section */}
      <div className="mt-4 border-t pt-4 space-y-3">
        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No comments yet — be the first!</p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="flex items-start gap-2 group">
              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center font-bold text-xs text-primary shrink-0 mt-0.5">
                {c.user?.full_name?.[0]?.toUpperCase() || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-semibold mr-1">{c.user?.full_name || "Unknown"}</span>
                  {c.content}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(c.created_at), "MMM d, h:mm a")}</p>
              </div>
              {(user?.id === c.user_id || isOwnPost) && (
                <button
                  onClick={() => handleDeleteComment(c.id)}
                  className="p-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  title="Delete comment"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Comment input */}
      {user && (
        <div className="flex items-start gap-2 mt-4 pt-4 border-t">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-xs text-primary shrink-0 mt-1">
            {user.email?.[0]?.toUpperCase() || "?"}
          </div>
          <div className="flex-1 space-y-2">
            <Textarea
              placeholder="Add a comment..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              rows={2}
              className="resize-none text-sm"
            />
            <Button size="sm" onClick={() => addComment.mutate()} disabled={!commentText.trim() || addComment.isPending} className="rounded-full">
              {addComment.isPending ? "Posting..." : "Post"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BlogPostPage;
