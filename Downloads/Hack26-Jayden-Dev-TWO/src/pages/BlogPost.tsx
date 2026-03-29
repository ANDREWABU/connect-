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
import { MessageCircle } from "lucide-react";

import type { Database } from "@/integrations/supabase/types";

type BlogPost = Database["public"]["Tables"]["posts"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type CommentRow = Database["public"]["Tables"]["comments"]["Row"];

type Comment = CommentRow & {
  user: Profile | null;
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
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as BlogPost;
    },
  });

  const { data: author } = useQuery({
    queryKey: ["post-author", post?.user_id],
    enabled: !!post,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", post!.user_id)
        .single();
      if (error) throw error;
      return data as Profile;
    },
  });

  const { data: comments = [] } = useQuery({
    queryKey: ["comments", id],
    queryFn: async () => {
      const { data: rawComments, error } = await supabase
        .from("comments")
        .select("*")
        .eq("post_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;

      const userIds = rawComments.map((c) => c.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .in("user_id", userIds);

      return rawComments.map((c) => ({
        ...c,
        user: profiles?.find((p) => p.user_id === c.user_id) || null,
      })) as Comment[];
    },
  });

  const addComment = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not logged in");
      const { error } = await supabase.from("comments").insert({
        post_id: id,
        user_id: user.id,
        content: commentText,
      });
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
    if (user.id === post.user_id) {
      toast.error("You can't message yourself!");
      return;
    }
    setSendingDM(true);
    try {
      const { data: existing } = await supabase
        .from("conversations")
        .select("id")
        .or(
          `and(participant_1.eq.${user.id},participant_2.eq.${post.user_id}),and(participant_1.eq.${post.user_id},participant_2.eq.${user.id})`
        )
        .maybeSingle();

      if (!existing) {
        await supabase.from("conversations").insert({
          participant_1: user.id,
          participant_2: post.user_id,
          last_message_at: new Date().toISOString(),
        });
      }

      navigate("/messages", {
        state: {
          openUserId: post.user_id,
          openUserName: author?.full_name || "User",
        },
      });
    } catch {
      toast.error("Could not open conversation. Try again.");
    } finally {
      setSendingDM(false);
    }
  };

  if (!post) return <div className="p-6">Loading...</div>;

  const isOwnPost = user?.id === post.user_id;

  return (
    <div className="space-y-6 p-6 max-w-3xl mx-auto">
      <Card>
        <CardContent className="p-6 space-y-3">
          <h1 className="text-3xl font-bold">{post.title}</h1>

          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-muted-foreground">
              Posted by {author?.full_name || "Unknown"} on{" "}
              {format(new Date(post.created_at), "MMM d, yyyy")}
            </p>

            {!isOwnPost && user && (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrivateMessage}
                disabled={sendingDM}
                className="gap-2"
              >
                <MessageCircle className="h-4 w-4" />
                {sendingDM
                  ? "Opening..."
                  : `Message ${author?.full_name?.split(" ")[0] || "User"} privately`}
              </Button>
            )}
          </div>

          <p className="whitespace-pre-wrap">{post.content}</p>
        </CardContent>
      </Card>

      <h2 className="text-xl font-semibold">Comments</h2>

      <div className="space-y-4">
        {comments.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No comments yet — be the first to reply!
          </p>
        )}
        {comments.map((c) => (
          <Card key={c.id}>
            <CardContent className="p-4 space-y-1">
              <p className="font-semibold">{c.user?.full_name || "Unknown"}</p>
              <p className="text-sm whitespace-pre-wrap">{c.content}</p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(c.created_at), "MMM d, yyyy h:mm a")}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {user && (
        <div className="space-y-3">
          <Textarea
            placeholder="Write a public reply..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
          />
          <Button onClick={() => addComment.mutate()} disabled={!commentText}>
            Post Reply
          </Button>
        </div>
      )}
    </div>
  );
};

export default BlogPostPage;