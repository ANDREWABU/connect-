import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";
import { MessageCircle, Heart, Share2, UserPlus, UserCheck } from "lucide-react";
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

  const addComment = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not logged in");
      const { error } = await supabase.from("comments").insert({ post_id: id, user_id: user.id, content: commentText });
      if (error) throw error;
    },
    onSuccess: () => {
      setCommentText("");
      queryClient.invalidateQueries({ queryKey: ["comments", id] });
      toast.success("Reply posted!");
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

  if (!post) return <div className="p-6">Loading...</div>;

  return (
    <div className="space-y-6 p-6 max-w-3xl mx-auto">
      <Card>
        <CardContent className="p-6 space-y-4">
          {/* Author row */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold">{post.title}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                by {author?.full_name || "Unknown"} · {format(new Date(post.created_at), "MMM d, yyyy")}
              </p>
            </div>
            {!isOwnPost && user && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleFollow} className="gap-1">
                  {userFollows ? <><UserCheck className="h-4 w-4" /> Following</> : <><UserPlus className="h-4 w-4" /> Follow</>}
                </Button>
                <Button variant="outline" size="sm" onClick={handlePrivateMessage} disabled={sendingDM} className="gap-1">
                  <MessageCircle className="h-4 w-4" />
                  {sendingDM ? "Opening..." : `Message ${author?.full_name?.split(" ")[0] || "User"}`}
                </Button>
              </div>
            )}
          </div>

          {/* Media */}
          {renderMedia()}

          {/* Content */}
          <p className="whitespace-pre-wrap text-base">{post.content}</p>

          {/* Like / Share */}
          <div className="flex items-center gap-4 pt-2 border-t">
            <button onClick={handleLike}
              className={`flex items-center gap-1 text-sm transition-colors ${userLiked ? "text-red-500" : "text-muted-foreground hover:text-red-500"}`}>
              <Heart className={`h-5 w-5 ${userLiked ? "fill-red-500" : ""}`} />
              {likes.length} {likes.length === 1 ? "like" : "likes"}
            </button>
            <button
              onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success("Link copied!"); }}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
            >
              <Share2 className="h-4 w-4" /> Share
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Comments */}
      <h2 className="text-xl font-semibold">Comments ({comments.length})</h2>
      <div className="space-y-4">
        {comments.length === 0 && (
          <p className="text-sm text-muted-foreground">No comments yet — be the first!</p>
        )}
        {comments.map((c) => (
          <Card key={c.id}>
            <CardContent className="p-4 space-y-1">
              <p className="font-semibold text-sm">{c.user?.full_name || "Unknown"}</p>
              <p className="text-sm whitespace-pre-wrap">{c.content}</p>
              <p className="text-xs text-muted-foreground">{format(new Date(c.created_at), "MMM d, yyyy h:mm a")}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {user && (
        <div className="space-y-3">
          <Textarea placeholder="Write a public reply..." value={commentText} onChange={(e) => setCommentText(e.target.value)} />
          <Button onClick={() => addComment.mutate()} disabled={!commentText}>Post Reply</Button>
        </div>
      )}
    </div>
  );
};

export default BlogPostPage;