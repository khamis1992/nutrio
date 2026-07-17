import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import {
  AdminDialogContent,
  AdminAlertDialogContent,
  AdminFilterBar,
  AdminKpiStrip,
  AdminWorkbenchHeader,
} from "@/components/admin/AdminPrimitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
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
        mealCounts[mealTag.diet_tag_id] =
          (mealCounts[mealTag.diet_tag_id] || 0) + 1;
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
        const { error } = await supabase.from("diet_tags").insert({
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
      const message =
        error instanceof Error ? error.message : "Failed to save diet tag";
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
      const message =
        error instanceof Error ? error.message : "Failed to delete diet tag";
      toast.error(message);
    }
  };

  const filteredTags = tags.filter(
    (tagItem) =>
      tagItem.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tagItem.description?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const getTagColor = (name: string): string => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes("vegan") || lowerName.includes("vegetarian"))
      return "border-[#22C7A1]/20 bg-[#22C7A1]/10 text-[#22C7A1]";
    if (lowerName.includes("gluten"))
      return "border-[#F97316]/25 bg-[#F97316]/10 text-[#F97316]";
    if (lowerName.includes("keto") || lowerName.includes("low-carb"))
      return "border-[#7C83F6]/20 bg-[#7C83F6]/10 text-[#7C83F6]";
    if (lowerName.includes("dairy"))
      return "border-[#38BDF8]/20 bg-[#38BDF8]/10 text-[#38BDF8]";
    if (lowerName.includes("nut"))
      return "border-[#FB6B7A]/20 bg-[#FB6B7A]/10 text-[#FB6B7A]";
    if (lowerName.includes("halal") || lowerName.includes("kosher"))
      return "border-[#22C7A1]/20 bg-[#22C7A1]/10 text-[#22C7A1]";
    return "border-[#E5EAF1] bg-[#F6F8FB] text-[#020617]";
  };

  const stats = {
    total: tags.length,
    inUse: tags.filter(
      (tagItem) => tagItem.meal_count && tagItem.meal_count > 0,
    ).length,
    assignments: tags.reduce(
      (sum, tagItem) => sum + (tagItem.meal_count || 0),
      0,
    ),
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
    <AdminLayout
      title="Diet Tags"
      subtitle="Manage dietary preferences and restrictions"
    >
      <div className="space-y-5 text-[#020617]">
        <AdminWorkbenchHeader
          eyebrow="Meal taxonomy"
          title="Diet tag desk"
          icon={Tag}
          accent="#22C7A1"
          description="Manage dietary preferences, restrictions, and meal taxonomy tags used across menus, filters, and customer discovery."
          meta={[
            { label: "Total tags", value: stats.total },
            { label: "Tags in use", value: stats.inUse },
            { label: "Assignments", value: stats.assignments },
          ]}
          actions={
            <Button
              variant="outline"
              onClick={openCreateDialog}
              className="h-11 gap-2 rounded-[14px] border-[#22C7A1]/30 bg-[#22C7A1]/10 px-4 font-black text-[#020617] hover:bg-[#22C7A1]/15"
            >
              <Plus className="h-4 w-4 text-[#22C7A1]" />
              Add Diet Tag
            </Button>
          }
        />

        <AdminKpiStrip
          className="2xl:grid-cols-3"
          items={[
            {
              label: "Total Tags",
              value: stats.total,
              helper: "Diet taxonomy",
              icon: Tag,
              accent: "#7C83F6",
            },
            {
              label: "Tags In Use",
              value: stats.inUse,
              helper: "Attached to meals",
              icon: Leaf,
              accent: "#22C7A1",
            },
            {
              label: "Assignments",
              value: stats.assignments,
              helper: "Meal/tag links",
              icon: Tag,
              accent: "#38BDF8",
            },
          ]}
        />

        <AdminFilterBar title="Tag catalog">
          <div className="relative max-w-md">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            <Input
              placeholder="Search diet tags"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="h-11 rounded-[14px] border-[#E5EAF1] bg-[#F6F8FB] pl-10 font-semibold text-[#020617] placeholder:text-[#94A3B8] focus-visible:ring-[#22C7A1]/30"
            />
          </div>
        </AdminFilterBar>

        <section className="overflow-hidden rounded-[24px] bg-white shadow-[0_14px_34px_rgba(2,6,23,0.06)] ring-1 ring-[#E5EAF1]">
          <div className="flex items-center justify-between gap-3 border-b border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4">
            <div>
              <h3 className="text-lg font-black text-[#020617]">
                All Diet Tags
              </h3>
              <p className="text-xs font-bold text-[#94A3B8]">
                {filteredTags.length} visible from {tags.length} total
              </p>
            </div>
            <Badge
              variant="outline"
              className="border-[#38BDF8]/20 bg-[#38BDF8]/10 text-[#38BDF8]"
            >
              Meal filters
            </Badge>
          </div>
          <div className="p-4 md:hidden">
            {filteredTags.length === 0 ? (
              <div className="py-12 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-[18px] bg-[#F6F8FB] ring-1 ring-[#E5EAF1]">
                  <Tag className="h-6 w-6 text-[#94A3B8]" />
                </div>
                <p className="font-black text-[#020617]">
                  {searchQuery
                    ? "No diet tags found matching your search"
                    : "No diet tags yet"}
                </p>
                {!searchQuery && (
                  <Button
                    variant="outline"
                    className="mt-4 rounded-[14px] border-[#E5EAF1] bg-white font-black text-[#020617]"
                    onClick={openCreateDialog}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create your first tag
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredTags.map((tagItem) => (
                  <div
                    key={tagItem.id}
                    className="rounded-[22px] border border-[#E5EAF1] bg-white p-4 shadow-[0_10px_26px_rgba(2,6,23,0.04)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Badge
                          variant="outline"
                          className={`font-black ${getTagColor(tagItem.name)}`}
                        >
                          {tagItem.name}
                        </Badge>
                        <p className="mt-3 line-clamp-2 text-sm font-semibold text-[#94A3B8]">
                          {tagItem.description || "No description"}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className="shrink-0 border-[#E5EAF1] bg-[#F6F8FB] font-black text-[#020617]"
                      >
                        {tagItem.meal_count || 0} meals
                      </Badge>
                    </div>
                    <div className="mt-4 flex items-center justify-between rounded-2xl bg-[#F6F8FB] px-3 py-2">
                      <span className="text-xs font-semibold text-[#94A3B8]">
                        Created{" "}
                        {format(new Date(tagItem.created_at), "MMM d, yyyy")}
                      </span>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="min-h-[44px] min-w-[44px] rounded-2xl text-[#020617] hover:bg-white"
                          onClick={() => openEditDialog(tagItem)}
                          aria-label={`Edit diet tag ${tagItem.name}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="min-h-[44px] min-w-[44px] rounded-2xl text-[#FB6B7A] hover:bg-[#FB6B7A]/10 hover:text-[#FB6B7A]"
                          onClick={() => openDeleteDialog(tagItem)}
                          aria-label={`Delete diet tag ${tagItem.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="hidden overflow-x-auto md:block">
            {filteredTags.length === 0 ? (
              <div className="py-16 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-[18px] bg-[#F6F8FB] ring-1 ring-[#E5EAF1]">
                  <Tag className="h-6 w-6 text-[#94A3B8]" />
                </div>
                <p className="font-black text-[#020617]">
                  {searchQuery
                    ? "No diet tags found matching your search"
                    : "No diet tags yet"}
                </p>
                {!searchQuery && (
                  <Button
                    variant="outline"
                    className="mt-4 rounded-[14px] border-[#E5EAF1] bg-white font-black text-[#020617]"
                    onClick={openCreateDialog}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create your first tag
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-[#F6F8FB]">
                  <TableRow className="border-[#E5EAF1] hover:bg-[#F6F8FB]">
                    <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                      Tag
                    </TableHead>
                    <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                      Description
                    </TableHead>
                    <TableHead className="text-center text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                      Meals
                    </TableHead>
                    <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                      Created
                    </TableHead>
                    <TableHead className="text-right text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTags.map((tagItem) => (
                    <TableRow
                      key={tagItem.id}
                      className="border-[#E5EAF1] transition-colors hover:bg-[#F6F8FB]/70"
                    >
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`font-black ${getTagColor(tagItem.name)}`}
                        >
                          {tagItem.name}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <p className="truncate text-sm font-semibold text-[#94A3B8]">
                          {tagItem.description || "No description"}
                        </p>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className="border-[#E5EAF1] bg-[#F6F8FB] font-black text-[#020617]"
                        >
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
                            className="min-h-[44px] min-w-[44px] rounded-2xl text-[#020617] hover:bg-[#F6F8FB]"
                            onClick={() => openEditDialog(tagItem)}
                            aria-label={`Edit diet tag ${tagItem.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="min-h-[44px] min-w-[44px] rounded-2xl text-[#FB6B7A] hover:bg-[#FB6B7A]/10 hover:text-[#FB6B7A]"
                            onClick={() => openDeleteDialog(tagItem)}
                            aria-label={`Delete diet tag ${tagItem.name}`}
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
            <p className="text-xs font-bold text-[#94A3B8]">
              How tags appear throughout the platform
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {tags.map((tagItem) => (
              <Badge
                key={tagItem.id}
                variant="outline"
                className={`font-black ${getTagColor(tagItem.name)}`}
              >
                {tagItem.name}
              </Badge>
            ))}
            {tags.length === 0 && (
              <p className="text-sm font-semibold text-[#94A3B8]">
                No tags to preview
              </p>
            )}
          </div>
        </section>
      </div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <AdminDialogContent size="md">
          <DialogHeader className="border-b border-[#E5EAF1] bg-[#F6F8FB] p-5 text-left">
            <DialogTitle className="text-xl font-black text-[#020617]">
              {isCreating ? "Create Diet Tag" : "Edit Diet Tag"}
            </DialogTitle>
            <DialogDescription className="font-semibold text-[#94A3B8]">
              {isCreating
                ? "Add a new dietary preference or restriction tag."
                : "Update the diet tag details."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 p-5">
            <div className="space-y-2">
              <Label htmlFor="name" className="font-black text-[#020617]">
                Tag Name *
              </Label>
              <Input
                id="name"
                placeholder="e.g., Vegan, Gluten-Free, Keto"
                value={formName}
                onChange={(event) => setFormName(event.target.value)}
                className="h-11 rounded-[14px] border-[#E5EAF1] bg-[#F6F8FB] font-semibold text-[#020617] focus-visible:ring-[#020617]"
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="description"
                className="font-black text-[#020617]"
              >
                Description
              </Label>
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
                <p className="mb-2 text-xs font-black uppercase tracking-[0.1em] text-[#94A3B8]">
                  Preview
                </p>
                <Badge
                  variant="outline"
                  className={`font-black ${getTagColor(formName)}`}
                >
                  {formName}
                </Badge>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-3 border-t border-[#E5EAF1] bg-[#F6F8FB] p-5">
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              disabled={saving}
              className="h-11 rounded-[14px] border-[#E5EAF1] bg-white font-black text-[#020617] hover:bg-white"
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={handleSave}
              disabled={saving}
              className="h-11 rounded-[14px] border-[#22C7A1]/30 bg-[#22C7A1]/10 font-black text-[#020617] hover:bg-[#22C7A1]/15"
            >
              {saving && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-[#22C7A1]" />
              )}
              {isCreating ? "Create Tag" : "Save Changes"}
            </Button>
          </DialogFooter>
        </AdminDialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AdminAlertDialogContent>
          <AlertDialogHeader className="border-b border-[#E5EAF1] bg-[#F6F8FB] p-5 text-left">
            <AlertDialogTitle className="flex items-center gap-3 text-xl font-black text-[#020617]">
              <span className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[#FB6B7A]/10 text-[#FB6B7A] ring-1 ring-[#FB6B7A]/20">
                <AlertTriangle className="h-5 w-5" />
              </span>
              Delete Diet Tag
            </AlertDialogTitle>
            <AlertDialogDescription className="font-semibold text-[#94A3B8]">
              Are you sure you want to delete the tag "{selectedTag?.name}"?
              {selectedTag?.meal_count && selectedTag.meal_count > 0 && (
                <span className="mt-2 block font-bold text-[#FB6B7A]">
                  Warning: This tag is currently assigned to{" "}
                  {selectedTag.meal_count} meal(s). Deleting it will remove the
                  tag from all meals.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-3 border-t border-[#E5EAF1] bg-[#F6F8FB] p-5">
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
        </AdminAlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
