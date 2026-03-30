import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, MessageSquare, User, ArrowLeft, Image, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";

const isImageUrl = (text: string) => {
  try { return /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(new URL(text).pathname); }
  catch { return false; }
};
const isVideoUrl = (text: string) => {
  try { return /\.(mp4|mov|webm)(\?|$)/i.test(new URL(text).pathname); }
  catch { return false; }
};

const Messages = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const location = useLocation();
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const didAutoOpen = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").neq("user_id", user?.id);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: conversations } = useQuery({
    queryKey: ["conversations", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("conversations")
        .select("*")
        .or(`participant_1.eq.${user!.id},participant_2.eq.${user!.id}`)
        .order("last_message_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  // Unread counts per conversation
  const { data: unreadCounts = {} } = useQuery({
    queryKey: ["unread-messages", user?.id, conversations?.map((c: any) => c.id).join(",")],
    queryFn: async () => {
      if (!conversations || conversations.length === 0) return {};
      const convoIds = conversations.map((c: any) => c.id);
      const { data } = await supabase
        .from("messages")
        .select("conversation_id")
        .in("conversation_id", convoIds)
        .neq("sender_id", user!.id)
        .eq("is_read", false);
      const counts: Record<string, number> = {};
      (data || []).forEach((m: any) => {
        counts[m.conversation_id] = (counts[m.conversation_id] || 0) + 1;
      });
      return counts;
    },
    enabled: !!user && !!conversations && conversations.length > 0,
  });

  const { data: messages } = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("sent_at", { ascending: true });
      return data || [];
    },
    enabled: !!conversationId,
  });

  const markMessagesRead = async (convoId: string) => {
    await supabase
      .from("messages")
      .update({ is_read: true })
      .eq("conversation_id", convoId)
      .neq("sender_id", user!.id)
      .eq("is_read", false);
    queryClient.invalidateQueries({ queryKey: ["unread-messages"] });
    queryClient.invalidateQueries({ queryKey: ["total-unread", user?.id] });
  };

  // Realtime: current conversation messages
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
          const msg = payload.new as any;
          if (msg.sender_id !== user!.id) markMessagesRead(conversationId);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId, queryClient]);

  // Realtime: global — notifications for messages in other conversations
  useEffect(() => {
    if (!user || !conversations || conversations.length === 0) return;
    const convoIds = new Set(conversations.map((c: any) => c.id));
    const channel = supabase
      .channel("global-new-messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const msg = payload.new as any;
        if (msg.sender_id === user.id) return;
        if (msg.conversation_id === conversationId) return;
        if (!convoIds.has(msg.conversation_id)) return;
        const sender = users?.find((u: any) => u.user_id === msg.sender_id);
        const senderName = sender?.full_name || "Someone";
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification(`New message from ${senderName}`, {
            body: msg.text?.startsWith("http") ? "Sent a photo" : msg.text,
            icon: "/favicon.ico",
          });
        }
        queryClient.invalidateQueries({ queryKey: ["unread-messages"] });
        queryClient.invalidateQueries({ queryKey: ["total-unread", user.id] });
        queryClient.invalidateQueries({ queryKey: ["conversations", user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversations, conversationId, user, users, queryClient]);

  useEffect(scrollToBottom, [messages]);

  // Auto-open from blog post / marketplace
  useEffect(() => {
    const state = location.state as { openUserId?: string } | null;
    if (!state?.openUserId || !users || didAutoOpen.current) return;
    const targetUser = users.find((u: any) => u.user_id === state.openUserId);
    if (targetUser) { didAutoOpen.current = true; openConversation(targetUser); }
  }, [users, location.state]);

  const openConversation = async (u: any) => {
    setSelectedUser(u);
    setMobileView("chat");
    const convo = conversations?.find(
      (c: any) =>
        (c.participant_1 === user!.id && c.participant_2 === u.user_id) ||
        (c.participant_2 === user!.id && c.participant_1 === u.user_id)
    );
    let convoId: string;
    if (convo) {
      setConversationId(convo.id);
      convoId = convo.id;
    } else {
      const { data: newConvo } = await supabase
        .from("conversations")
        .insert({ participant_1: user!.id, participant_2: u.user_id, last_message_at: new Date().toISOString() })
        .select("*")
        .single();
      setConversationId(newConvo.id);
      convoId = newConvo.id;
      queryClient.invalidateQueries({ queryKey: ["conversations", user?.id] });
    }
    await markMessagesRead(convoId);
  };

  const handleBack = () => {
    setMobileView("list");
    setSelectedUser(null);
    setConversationId(null);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !conversationId) return;
    setSending(true);
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: user!.id,
      text: newMessage.trim(),
      sent_at: new Date().toISOString(),
    });
    await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversationId);
    setNewMessage("");
    setSending(false);
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !conversationId) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `messages/${user!.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("posts-media").upload(path, file);
    if (error) { toast.error("Upload failed"); setUploading(false); return; }
    const { data } = supabase.storage.from("posts-media").getPublicUrl(path);
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: user!.id,
      text: data.publicUrl,
      sent_at: new Date().toISOString(),
    });
    await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversationId);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const deleteMessage = async (messageId: string) => {
    await supabase.from("messages").delete().eq("id", messageId);
    queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
  };

  const deleteConversation = async (convoId: string) => {
    await supabase.from("messages").delete().eq("conversation_id", convoId);
    await supabase.from("conversations").delete().eq("id", convoId);
    queryClient.invalidateQueries({ queryKey: ["conversations", user?.id] });
    if (conversationId === convoId) handleBack();
    toast.success("Conversation deleted");
  };

  const renderMessageContent = (m: any) => {
    const text = m.text as string;
    if (isImageUrl(text)) {
      return <img src={text} alt="sent image" className="max-w-full rounded-xl max-h-60 object-cover" />;
    }
    if (isVideoUrl(text)) {
      return <video src={text} controls className="max-w-full rounded-xl max-h-60 object-cover" />;
    }
    return (
      <>
        <p>{text}</p>
        <p className={`text-[10px] mt-1 ${m.sender_id === user!.id ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
          {format(new Date(m.sent_at), "h:mm a")}
        </p>
      </>
    );
  };

  // Users not yet in any conversation with current user
  const newPeople = (users || []).filter((u: any) =>
    !conversations?.some(
      (c: any) =>
        (c.participant_1 === user!.id && c.participant_2 === u.user_id) ||
        (c.participant_2 === user!.id && c.participant_1 === u.user_id)
    )
  );

  // Users who already have a conversation
  const chattedUsers = (users || []).filter((u: any) =>
    conversations?.some(
      (c: any) =>
        (c.participant_1 === user!.id && c.participant_2 === u.user_id) ||
        (c.participant_2 === user!.id && c.participant_1 === u.user_id)
    )
  ).sort((a: any, b: any) => {
    const cA = conversations?.find((c: any) => c.participant_1 === a.user_id || c.participant_2 === a.user_id);
    const cB = conversations?.find((c: any) => c.participant_1 === b.user_id || c.participant_2 === b.user_id);
    return (cB?.last_message_at ? new Date(cB.last_message_at).getTime() : 0) -
      (cA?.last_message_at ? new Date(cA.last_message_at).getTime() : 0);
  });

  const renderList = () => (
    <div className="space-y-0.5">
      <h1 className="text-xl font-bold px-2 pb-3">Messages</h1>

      {/* Find New People — horizontal scroll row */}
      {newPeople.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-2 mb-2">
            Find New People
          </p>
          <div className="flex gap-4 overflow-x-auto pb-2 px-1" style={{ scrollbarWidth: "none" }}>
            {newPeople.map((u: any) => (
              <button
                key={u.user_id}
                onClick={() => openConversation(u)}
                className="flex flex-col items-center gap-1.5 shrink-0 group"
              >
                <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center font-bold text-lg text-primary ring-2 ring-transparent group-hover:ring-primary transition-all">
                  {u.full_name?.[0]?.toUpperCase() || "?"}
                </div>
                <p className="text-xs w-14 truncate text-center text-muted-foreground group-hover:text-foreground transition-colors">
                  {u.full_name?.split(" ")[0] || "User"}
                </p>
              </button>
            ))}
          </div>
          {chattedUsers.length > 0 && <div className="border-b mt-3 mb-1" />}
        </div>
      )}

      {/* Existing conversations */}
      {chattedUsers.length > 0 ? (
        <>
          {chattedUsers.map((u: any) => {
            const convo = conversations?.find(
              (c: any) =>
                (c.participant_1 === user!.id && c.participant_2 === u.user_id) ||
                (c.participant_2 === user!.id && c.participant_1 === u.user_id)
            );
            const unread = convo ? (unreadCounts[convo.id] || 0) : 0;
            return (
              <div key={u.user_id} className="flex items-center gap-1 group">
                <button
                  onClick={() => openConversation(u)}
                  className={`flex-1 text-left p-3 rounded-xl transition-colors ${
                    selectedUser?.user_id === u.user_id ? "bg-primary/10" : "hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center font-bold text-sm text-primary">
                        {u.full_name?.[0]?.toUpperCase() || "?"}
                      </div>
                      {unread > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 h-3 w-3 bg-primary rounded-full border-2 border-background" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm truncate ${unread > 0 ? "font-bold" : "font-medium"} text-foreground`}>
                          {u.full_name}
                        </p>
                        {convo?.last_message_at && (
                          <p className="text-xs text-muted-foreground shrink-0">
                            {format(new Date(convo.last_message_at), "h:mm a")}
                          </p>
                        )}
                      </div>
                      {unread > 0 && (
                        <p className="text-xs text-primary font-semibold">{unread} new</p>
                      )}
                    </div>
                  </div>
                </button>
                {convo && (
                  <button
                    onClick={() => deleteConversation(convo.id)}
                    className="p-2 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"
                    title="Delete conversation"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
        </>
      ) : newPeople.length === 0 ? (
        <div className="text-center py-10">
          <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No users found.</p>
        </div>
      ) : null}
    </div>
  );

  const renderChat = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-3 border-b bg-background shrink-0">
        <button onClick={handleBack} className="p-1.5 hover:bg-muted rounded-full transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-sm text-primary shrink-0">
          {selectedUser?.full_name?.[0]?.toUpperCase() || <User className="h-4 w-4" />}
        </div>
        <p className="font-semibold">{selectedUser?.full_name}</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-2 p-3">
        {messages?.map((m: any) => (
          <div key={m.id} className={`flex items-end gap-1 group ${m.sender_id === user!.id ? "justify-end" : "justify-start"}`}>
            {m.sender_id === user!.id && (
              <button
                onClick={() => deleteMessage(m.id)}
                className="p-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                title="Delete message"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
            <div
              className={`max-w-[70%] px-3 py-2 rounded-2xl text-sm ${
                m.sender_id === user!.id
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-muted text-foreground rounded-bl-sm"
              }`}
            >
              {renderMessageContent(m)}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="flex gap-2 px-3 border-t bg-background shrink-0" style={{ paddingTop: "12px", paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}>
        <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleMediaUpload} />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground disabled:opacity-50 shrink-0"
        >
          <Image className="h-5 w-5" />
        </button>
        <Input
          placeholder="Type a message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          className="rounded-full"
          disabled={uploading}
        />
        <Button type="submit" size="icon" disabled={sending || uploading} className="rounded-full shrink-0">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );

  return (
    <>
      {/* Mobile: full-screen toggle between list and chat */}
      <div className="md:hidden -mx-4 sm:-mx-6 -mt-6 -mb-6" style={{ height: "calc(100vh - 3.5rem - env(safe-area-inset-top))" }}>
        {mobileView === "list" ? (
          <div className="h-full overflow-y-auto p-4">
            {renderList()}
          </div>
        ) : (
          <div className="h-full flex flex-col overflow-hidden">
            {conversationId ? renderChat() : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Loading...</div>
            )}
          </div>
        )}
      </div>

      {/* Desktop: side-by-side */}
      <div className="hidden md:grid md:grid-cols-3 gap-4" style={{ height: "calc(100vh - 7rem)" }}>
        <div className="overflow-y-auto border-r pr-4">
          {renderList()}
        </div>
        <div className="col-span-2 flex flex-col border rounded-xl overflow-hidden">
          {conversationId ? renderChat() : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Select a conversation to start chatting
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Messages;
