import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tag,
  Plus,
  Pencil,
  Trash2,
  Search,
  Loader2,
  Leaf,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface DietTag {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  meal_count?: number;
}

export default function AdminDietTags() {
  const { user } = useAuth();
  const [tags, setTags] = useState<DietTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState<DietTag | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");

  useEffect(() => {
    if (user) {
      fetchTags();
    }
  }, [user]);

  const fetchTags = async () => {
    try {
      setLoading(true);

      const { data: tagsData, error: tagsError } = await supabase
        .from("diet_tags")
        .select("*")
        .order("name");

      if (tagsError) throw tagsError;

      const { data: mealTagsData, error: mealTagsError } = await supabase
        .from("meal_diet_tags")
        .select("diet_tag_id");

      if (mealTagsError) throw mealTagsError;

      const mealCounts: Record<string, number> = {};
      (mealTagsData || []).forEach((mealTag) => {
        mealCounts[mealTag.diet_tag_id] = (mealCounts[mealTag.diet_tag_id] || 0) + 1;
      });

      const tagsWithCounts = (tagsData || []).map((tag) => ({
        ...tag,
        meal_count: mealCounts[tag.id] || 0,
      }));

      setTags(tagsWithCounts);
    } catch (error) {
      console.error("Error fetching diet tags:", error);
      toast.error("Failed to load diet tags");
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => {
    setIsCreating(true);
    setSelectedTag(null);
    setFormName("");
    setFormDescription("");
    setEditDialogOpen(true);
  };

  const openEditDialog = (tagItem: DietTag) => {
    setIsCreating(false);
    setSelectedTag(tagItem);
    setFormName(tagItem.name);
    setFormDescription(tagItem.description || "");
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (tagItem: DietTag) => {
    setSelectedTag(tagItem);
    setDeleteDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error("Tag name is required");
      return;
    }

    setSaving(true);
    try {
      if (isCreating) {
        const { error } = await supabase
          .from("diet_tags")
          .insert({
            name: formName.trim(),
            description: formDescription.trim() || null,
          });

        if (error) throw error;
        toast.success("Diet tag created successfully");
      } else if (selectedTag) {
        const { error } = await supabase
          .from("diet_tags")
          .update({
            name: formName.trim(),
            description: formDescription.trim() || null,
          })
          .eq("id", selectedTag.id);

        if (error) throw error;
        toast.success("Diet tag updated successfully");
      }

      setEditDialogOpen(false);
      fetchTags();
    } catch (error: unknown) {
      console.error("Error saving diet tag:", error);
      const message = error instanceof Error ? error.message : "Failed to save diet tag";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTag) return;

    try {
      await supabase
        .from("meal_diet_tags")
        .delete()
        .eq("diet_tag_id", selectedTag.id);

      const { error } = await supabase
        .from("diet_tags")
        .delete()
        .eq("id", selectedTag.id);

      if (error) throw error;

      toast.success("Diet tag deleted successfully");
      setDeleteDialogOpen(false);
      setSelectedTag(null);
      fetchTags();
    } catch (error: unknown) {
      console.error("Error deleting diet tag:", error);
      const message = error instanceof Error ? error.message : "Failed to delete diet tag";
      toast.error(message);
    }
  };

  const filteredTags = tags.filter((tagItem) =>
    tagItem.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tagItem.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getTagColor = (name: string): string => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes("vegan") || lowerName.includes("vegetarian")) return "border-[#22C7A1]/20 bg-[#EFFFFA] text-[#22C7A1]";
    if (lowerName.includes("gluten")) return "border-[#F97316]/25 bg-[#FFF7ED] text-[#F97316]";
    if (lowerName.includes("keto") || lowerName.includes("low-carb")) return "border-[#7C83F6]/20 bg-[#F3F4FF] text-[#7C83F6]";
    if (lowerName.includes("dairy")) return "border-[#38BDF8]/20 bg-[#EFF9FF] text-[#38BDF8]";
    if (lowerName.includes("nut")) return "border-[#FB6B7A]/20 bg-[#FFF0F2] text-[#FB6B7A]";
    if (lowerName.includes("halal") || lowerName.includes("kosher")) return "border-[#22C7A1]/20 bg-[#EFFFFA] text-[#22C7A1]";
    return "border-[#E5EAF1] bg-[#F6F8FB] text-[#020617]";
  };

  const stats = {
    total: tags.length,
    inUse: tags.filter((tagItem) => tagItem.meal_count && tagItem.meal_count > 0).length,
    assignments: tags.reduce((sum, tagItem) => sum + (tagItem.meal_count || 0), 0),
  };

  if (loading) {
    return (
      <AdminLayout title="Diet Tags" subtitle="Manage dietary tags">
        <div className="space-y-4">
          <Skeleton className="h-44 rounded-[24px]" />
          <Skeleton className="h-96 w-full rounded-[24px]" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Diet Tags" subtitle="Manage dietary preferences and restrictions">
      <div className="space-y-5 text-[#020617]">
        <section className="overflow-hidden rounded-[24px] bg-white shadow-[0_18px_42px_rgba(2,6,23,0.07)] ring-1 ring-[#E5EAF1]">
          <div className="flex flex-col gap-4 border-b border-[#E5EAF1] bg-[#F6F8FB] p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-[#020617] text-white">
                <Tag className="h-6 w-6" />
              </span>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#22C7A1]">Meal Taxonomy</p>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-[#020617]">Diet Tags</h2>
                <p className="mt-1 text-sm font-semibold text-[#94A3B8]">
                  Manage dietary preferences and restrictions used across meals.
                </p>
              </div>
            </div>
            <Button
              onClick={openCreateDialog}
              className="h-11 gap-2 rounded-[14px] bg-[#020617] px-4 font-black text-white hover:bg-[#020617]/90"
            >
              <Plus className="h-4 w-4" />
              Add Diet Tag
            </Button>
          </div>

          <div className="grid gap-3 p-4 sm:grid-cols-3">
            {[
              { label: "Total Tags", value: stats.total, Icon: Tag, bg: "bg-[#F6F8FB]", color: "text-[#020617]", ring: "ring-[#E5EAF1]" },
              { label: "Tags In Use", value: stats.inUse, Icon: Leaf, bg: "bg-[#EFFFFA]", color: "text-[#22C7A1]", ring: "ring-[#22C7A1]/20" },
              { label: "Assignments", value: stats.assignments, Icon: Tag, bg: "bg-[#EFF9FF]", color: "text-[#38BDF8]", ring: "ring-[#38BDF8]/20" },
            ].map(({ label, value, Icon, bg, color, ring }) => (
              <div key={label} className={`rounded-[20px] ${bg} p-4 ring-1 ${ring}`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-3xl font-black leading-none text-[#020617]">{value}</p>
                    <p className="mt-2 text-[11px] font-black uppercase tracking-[0.12em] text-[#94A3B8]">{label}</p>
                  </div>
                  <div className={`flex h-11 w-11 items-center justify-center rounded-[16px] bg-white ${color} shadow-sm ring-1 ring-white/80`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[24px] bg-white p-4 shadow-[0_14px_34px_rgba(2,6,23,0.06)] ring-1 ring-[#E5EAF1]">
          <div className="relative max-w-md">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            <Input
              placeholder="Search diet tags"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="h-11 rounded-[14px] border-[#E5EAF1] bg-[#F6F8FB] pl-10 font-semibold text-[#020617] placeholder:text-[#94A3B8] focus-visible:ring-[#020617]"
            />
          </div>
        </section>

        <section className="overflow-hidden rounded-[24px] bg-white shadow-[0_14px_34px_rgba(2,6,23,0.06)] ring-1 ring-[#E5EAF1]">
          <div className="flex items-center justify-between gap-3 border-b border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4">
            <div>
              <h3 className="text-lg font-black text-[#020617]">All Diet Tags</h3>
              <p className="text-xs font-bold text-[#94A3B8]">{filteredTags.length} visible from {tags.length} total</p>
            </div>
            <Badge variant="outline" className="border-[#38BDF8]/20 bg-[#EFF9FF] text-[#38BDF8]">
              Meal filters
            </Badge>
          </div>
          <div className="overflow-x-auto">
            {filteredTags.length === 0 ? (
              <div className="py-16 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-[18px] bg-[#F6F8FB] ring-1 ring-[#E5EAF1]">
                  <Tag className="h-6 w-6 text-[#94A3B8]" />
                </div>
                <p className="font-black text-[#020617]">
                  {searchQuery ? "No diet tags found matching your search" : "No diet tags yet"}
                </p>
                {!searchQuery && (
                  <Button variant="outline" className="mt-4 rounded-[14px] border-[#E5EAF1] bg-white font-black text-[#020617]" onClick={openCreateDialog}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create your first tag
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-[#E5EAF1] hover:bg-transparent">
                    <TableHead>Tag</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-center">Meals</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTags.map((tagItem) => (
                    <TableRow key={tagItem.id} className="border-[#E5EAF1] transition-colors hover:bg-[#F6F8FB]">
                      <TableCell>
                        <Badge variant="outline" className={`font-black ${getTagColor(tagItem.name)}`}>
                          {tagItem.name}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <p className="truncate text-sm font-semibold text-[#94A3B8]">
                          {tagItem.description || "No description"}
                        </p>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="border-[#E5EAF1] bg-[#F6F8FB] font-black text-[#020617]">
                          {tagItem.meal_count || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-semibold text-[#94A3B8]">
                        {format(new Date(tagItem.created_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="min-h-[44px] min-w-[44px] text-[#020617] hover:bg-[#F6F8FB]"
                            onClick={() => openEditDialog(tagItem)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="min-h-[44px] min-w-[44px] text-[#FB6B7A] hover:bg-[#FFF0F2] hover:text-[#FB6B7A]"
                            onClick={() => openDeleteDialog(tagItem)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </section>

        <section className="rounded-[24px] bg-white p-5 shadow-[0_14px_34px_rgba(2,6,23,0.06)] ring-1 ring-[#E5EAF1]">
          <div className="mb-4">
            <h3 className="text-lg font-black text-[#020617]">Tag Preview</h3>
            <p className="text-xs font-bold text-[#94A3B8]">How tags appear throughout the platform</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {tags.map((tagItem) => (
              <Badge key={tagItem.id} variant="outline" className={`font-black ${getTagColor(tagItem.name)}`}>
                {tagItem.name}
              </Badge>
            ))}
            {tags.length === 0 && (
              <p className="text-sm font-semibold text-[#94A3B8]">No tags to preview</p>
            )}
          </div>
        </section>
      </div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-[95vw] overflow-y-auto border-[#E5EAF1] bg-white p-0 shadow-[0_24px_60px_rgba(2,6,23,0.18)] sm:max-w-md">
          <DialogHeader className="border-b border-[#E5EAF1] bg-[#F6F8FB] p-5 text-left">
            <DialogTitle className="text-xl font-black text-[#020617]">
              {isCreating ? "Create Diet Tag" : "Edit Diet Tag"}
            </DialogTitle>
            <DialogDescription className="font-semibold text-[#94A3B8]">
              {isCreating ? "Add a new dietary preference or restriction tag." : "Update the diet tag details."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 p-5">
            <div className="space-y-2">
              <Label htmlFor="name" className="font-black text-[#020617]">Tag Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Vegan, Gluten-Free, Keto"
                value={formName}
                onChange={(event) => setFormName(event.target.value)}
                className="h-11 rounded-[14px] border-[#E5EAF1] bg-[#F6F8FB] font-semibold text-[#020617] focus-visible:ring-[#020617]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="font-black text-[#020617]">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe what this dietary tag means..."
                value={formDescription}
                onChange={(event) => setFormDescription(event.target.value)}
                rows={3}
                className="rounded-[14px] border-[#E5EAF1] bg-[#F6F8FB] font-semibold text-[#020617] focus-visible:ring-[#020617]"
              />
            </div>

            {formName && (
              <div className="rounded-[18px] bg-[#F6F8FB] p-4 ring-1 ring-[#E5EAF1]">
                <p className="mb-2 text-xs font-black uppercase tracking-[0.1em] text-[#94A3B8]">Preview</p>
                <Badge variant="outline" className={`font-black ${getTagColor(formName)}`}>
                  {formName}
                </Badge>
              </div>
            )}
          </div>

          <DialogFooter className="border-t border-[#E5EAF1] bg-[#F6F8FB] p-5">
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              disabled={saving}
              className="h-11 rounded-[14px] border-[#E5EAF1] bg-white font-black text-[#020617] hover:bg-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="h-11 rounded-[14px] bg-[#020617] font-black text-white hover:bg-[#020617]/90"
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isCreating ? "Create Tag" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="border-[#E5EAF1] bg-white p-0 shadow-[0_24px_60px_rgba(2,6,23,0.18)]">
          <AlertDialogHeader className="border-b border-[#E5EAF1] bg-[#F6F8FB] p-5 text-left">
            <AlertDialogTitle className="flex items-center gap-3 text-xl font-black text-[#020617]">
              <span className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[#FFF0F2] text-[#FB6B7A] ring-1 ring-[#FB6B7A]/20">
                <AlertTriangle className="h-5 w-5" />
              </span>
              Delete Diet Tag
            </AlertDialogTitle>
            <AlertDialogDescription className="font-semibold text-[#94A3B8]">
              Are you sure you want to delete the tag "{selectedTag?.name}"?
              {selectedTag?.meal_count && selectedTag.meal_count > 0 && (
                <span className="mt-2 block font-bold text-[#FB6B7A]">
                  Warning: This tag is currently assigned to {selectedTag.meal_count} meal(s). Deleting it will remove the tag from all meals.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="border-t border-[#E5EAF1] bg-[#F6F8FB] p-5">
            <AlertDialogCancel className="h-11 rounded-[14px] border-[#E5EAF1] bg-white font-black text-[#020617] hover:bg-white">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-11 rounded-[14px] bg-[#FB6B7A] font-black text-white hover:bg-[#FB6B7A]/90"
              onClick={handleDelete}
            >
              Delete Tag
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
