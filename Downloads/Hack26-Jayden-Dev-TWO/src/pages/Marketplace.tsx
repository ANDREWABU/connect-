import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Search, Plus, MessageCircle, Tag, DollarSign, CheckCircle } from "lucide-react";

type Listing = {
  id: string;
  seller_id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  image_url: string | null;
  status: string;
  created_at: string;
  seller?: { full_name: string };
};

const CATEGORIES = ["all", "books", "electronics", "clothing", "furniture", "other"];

const Marketplace = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    category: "other",
    image_url: "",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const { data: listings = [] } = useQuery({
    queryKey: ["listings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_listings")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const sellerIds = [...new Set(data.map((l) => l.seller_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", sellerIds);

      return data.map((l) => ({
        ...l,
        seller: profiles?.find((p) => p.user_id === l.seller_id),
      })) as Listing[];
    },
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile || !user) return null;
    const ext = imageFile.name.split(".").pop();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("listings")
      .upload(path, imageFile);
    if (error) { toast.error("Image upload failed"); return null; }
    const { data } = supabase.storage.from("listings").getPublicUrl(path);
    return data.publicUrl;
  };

  const createListing = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not logged in");
      setUploading(true);
      const imageUrl = await uploadImage();
      setUploading(false);
      const { error } = await supabase.from("marketplace_listings").insert({
        seller_id: user.id,
        title: form.title,
        description: form.description,
        price: parseFloat(form.price),
        category: form.category,
        image_url: imageUrl,
        status: "active",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setForm({ title: "", description: "", price: "", category: "other", image_url: "" });
      setImageFile(null);
      setImagePreview(null);
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      toast.success("Listing created!");
    },
    onError: () => toast.error("Failed to create listing"),
  });

  const markAsSold = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("marketplace_listings")
        .update({ status: "sold" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      toast.success("Marked as sold!");
    },
  });

  const handleMessage = async (listing: Listing) => {
    if (!user) return;
    if (user.id === listing.seller_id) {
      toast.error("That's your own listing!");
      return;
    }
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .or(`and(participant_1.eq.${user.id},participant_2.eq.${listing.seller_id}),and(participant_1.eq.${listing.seller_id},participant_2.eq.${user.id})`)
      .maybeSingle();

    if (!existing) {
      await supabase.from("conversations").insert({
        participant_1: user.id,
        participant_2: listing.seller_id,
        last_message_at: new Date().toISOString(),
      });
    }

    navigate("/messages", {
      state: {
        openUserId: listing.seller_id,
        openUserName: listing.seller?.full_name || "Seller",
      },
    });
  };

  const filtered = listings.filter((l) => {
    const matchSearch =
      l.title.toLowerCase().includes(search.toLowerCase()) ||
      l.description.toLowerCase().includes(search.toLowerCase());
    const matchCategory = selectedCategory === "all" || l.category === selectedCategory;
    return matchSearch && matchCategory;
  });

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Marketplace</h1>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2">
          <Plus className="h-4 w-4" />
          New Listing
        </Button>
      </div>

      {/* Create listing form */}
      {showForm && (
        <div className="bg-card border rounded-2xl p-6 space-y-4 shadow-sm">
          <h2 className="text-lg font-semibold">Create a Listing</h2>

          {/* Image upload */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Photo</label>
            <div
              className="border-2 border-dashed rounded-xl p-4 text-center cursor-pointer hover:bg-muted/50 transition"
              onClick={() => document.getElementById("imgInput")?.click()}
            >
              {imagePreview ? (
                <img src={imagePreview} className="max-h-48 mx-auto rounded-lg object-cover" />
              ) : (
                <p className="text-sm text-muted-foreground">Click to upload a photo</p>
              )}
            </div>
            <input
              id="imgInput"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageChange}
            />
          </div>

          <Input
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <Textarea
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              placeholder="Price ($)"
              type="number"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
            <select
              className="border rounded-lg px-3 py-2 text-sm bg-background"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {CATEGORIES.filter((c) => c !== "all").map((c) => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={() => createListing.mutate()}
              disabled={!form.title || !form.price || uploading}
              className="flex-1"
            >
              {uploading ? "Uploading..." : "Post Listing"}
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Search + filter */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search listings..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setSelectedCategory(c)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedCategory === c
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Listings grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          No listings found.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((listing) => (
            <div
              key={listing.id}
              className={`bg-card border rounded-2xl overflow-hidden shadow-sm flex flex-col transition-opacity ${
                listing.status === "sold" ? "opacity-60" : ""
              }`}
            >
              {/* Image */}
              {listing.image_url ? (
                <img
                  src={listing.image_url}
                  alt={listing.title}
                  className="w-full h-48 object-cover"
                />
              ) : (
                <div className="w-full h-48 bg-muted flex items-center justify-center">
                  <Tag className="h-8 w-8 text-muted-foreground" />
                </div>
              )}

              {/* Content */}
              <div className="p-4 flex flex-col gap-2 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-base leading-tight">{listing.title}</h3>
                  {listing.status === "sold" && (
                    <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium shrink-0">
                      Sold
                    </span>
                  )}
                </div>

                <p className="text-sm text-muted-foreground line-clamp-2">{listing.description}</p>

                <div className="flex items-center gap-1 text-primary font-bold text-lg">
                  <DollarSign className="h-4 w-4" />
                  {listing.price.toFixed(2)}
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="bg-muted px-2 py-0.5 rounded-full capitalize">{listing.category}</span>
                  <span>by {listing.seller?.full_name || "Unknown"}</span>
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-auto pt-2">
                  {user?.id !== listing.seller_id && listing.status !== "sold" && (
                    <Button
                      size="sm"
                      className="flex-1 gap-1"
                      onClick={() => handleMessage(listing)}
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      Message Seller
                    </Button>
                  )}
                  {user?.id === listing.seller_id && listing.status !== "sold" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 gap-1"
                      onClick={() => markAsSold.mutate(listing.id)}
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                      Mark Sold
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Marketplace;