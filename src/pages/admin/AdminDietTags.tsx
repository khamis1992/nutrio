import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  AlertTriangle
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
  
  // Dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState<DietTag | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Form states
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
      
      // Fetch diet tags
      const { data: tagsData, error: tagsError } = await supabase
        .from("diet_tags")
        .select("*")
        .order("name");

      if (tagsError) throw tagsError;

      // Fetch meal counts for each tag
      const { data: mealTagsData, error: mealTagsError } = await supabase
        .from("meal_diet_tags")
        .select("diet_tag_id");

      if (mealTagsError) throw mealTagsError;

      // Count meals per tag
      const mealCounts: Record<string, number> = {};
      (mealTagsData || []).forEach(mt => {
        mealCounts[mt.diet_tag_id] = (mealCounts[mt.diet_tag_id] || 0) + 1;
      });

      // Combine data
      const tagsWithCounts = (tagsData || []).map(tag => ({
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

  const openEditDialog = (tag: DietTag) => {
    setIsCreating(false);
    setSelectedTag(tag);
    setFormName(tag.name);
    setFormDescription(tag.description || "");
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (tag: DietTag) => {
    setSelectedTag(tag);
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
        // Create new tag
        const { error } = await supabase
          .from("diet_tags")
          .insert({
            name: formName.trim(),
            description: formDescription.trim() || null,
          });

        if (error) throw error;
        toast.success("Diet tag created successfully");
      } else if (selectedTag) {
        // Update existing tag
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
    } catch (error: any) {
      console.error("Error saving diet tag:", error);
      toast.error(error.message || "Failed to save diet tag");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTag) return;

    try {
      // First delete any meal associations
      await supabase
        .from("meal_diet_tags")
        .delete()
        .eq("diet_tag_id", selectedTag.id);

      // Then delete the tag
      const { error } = await supabase
        .from("diet_tags")
        .delete()
        .eq("id", selectedTag.id);

      if (error) throw error;

      toast.success("Diet tag deleted successfully");
      setDeleteDialogOpen(false);
      setSelectedTag(null);
      fetchTags();
    } catch (error: any) {
      console.error("Error deleting diet tag:", error);
      toast.error(error.message || "Failed to delete diet tag");
    }
  };

  const filteredTags = tags.filter(tag =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tag.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getTagColor = (name: string): string => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes("vegan") || lowerName.includes("vegetarian")) return "bg-green-500/10 text-green-600 border-green-500/20";
    if (lowerName.includes("gluten")) return "bg-amber-500/10 text-amber-600 border-amber-500/20";
    if (lowerName.includes("keto") || lowerName.includes("low-carb")) return "bg-purple-500/10 text-purple-600 border-purple-500/20";
    if (lowerName.includes("dairy")) return "bg-blue-500/10 text-blue-600 border-blue-500/20";
    if (lowerName.includes("nut")) return "bg-red-500/10 text-red-600 border-red-500/20";
    if (lowerName.includes("halal") || lowerName.includes("kosher")) return "bg-teal-500/10 text-teal-600 border-teal-500/20";
    return "bg-primary/10 text-primary border-primary/20";
  };

  if (loading) {
    return (
      <AdminLayout title="Diet Tags" subtitle="Manage dietary tags">
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Diet Tags" subtitle="Manage dietary preferences and restrictions">
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center justify-between">
          <div className="relative flex-1 w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search diet tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 min-h-[44px]"
            />
          </div>
          <Button onClick={openCreateDialog} className="w-full sm:w-auto min-h-[44px]">
            <Plus className="h-4 w-4 mr-2" />
            Add Diet Tag
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <Tag className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{tags.length}</p>
                  <p className="text-sm text-muted-foreground">Total Tags</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-green-500/10">
                  <Leaf className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {tags.filter(t => t.meal_count && t.meal_count > 0).length}
                  </p>
                  <p className="text-sm text-muted-foreground">Tags in Use</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-blue-500/10">
                  <Tag className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {tags.reduce((sum, t) => sum + (t.meal_count || 0), 0)}
                  </p>
                  <p className="text-sm text-muted-foreground">Total Assignments</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tags Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Diet Tags</CardTitle>
            <CardDescription>
              Manage dietary preferences and restrictions that can be assigned to meals
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
            {filteredTags.length === 0 ? (
              <div className="text-center py-12">
                <Tag className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery ? "No diet tags found matching your search" : "No diet tags yet"}
                </p>
                {!searchQuery && (
                  <Button variant="outline" className="mt-4" onClick={openCreateDialog}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create your first tag
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tag</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-center">Meals</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTags.map((tag) => (
                    <TableRow key={tag.id}>
                      <TableCell>
                        <Badge variant="outline" className={getTagColor(tag.name)}>
                          {tag.name}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <p className="text-sm text-muted-foreground truncate">
                          {tag.description || "No description"}
                        </p>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">
                          {tag.meal_count || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(tag.created_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="min-h-[44px] min-w-[44px]"
                            onClick={() => openEditDialog(tag)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="min-h-[44px] min-w-[44px] text-destructive hover:text-destructive"
                            onClick={() => openDeleteDialog(tag)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Preview Section */}
        <Card>
          <CardHeader>
            <CardTitle>Tag Preview</CardTitle>
            <CardDescription>How tags appear throughout the platform</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <Badge key={tag.id} variant="outline" className={getTagColor(tag.name)}>
                  {tag.name}
                </Badge>
              ))}
              {tags.length === 0 && (
                <p className="text-sm text-muted-foreground">No tags to preview</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md mx-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isCreating ? "Create Diet Tag" : "Edit Diet Tag"}
            </DialogTitle>
            <DialogDescription>
              {isCreating 
                ? "Add a new dietary preference or restriction tag"
                : "Update the diet tag details"
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Tag Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Vegan, Gluten-Free, Keto"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe what this dietary tag means..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={3}
              />
            </div>

            {formName && (
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">Preview:</p>
                <Badge variant="outline" className={getTagColor(formName)}>
                  {formName}
                </Badge>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isCreating ? "Create Tag" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Diet Tag
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the tag "{selectedTag?.name}"? 
              {selectedTag?.meal_count && selectedTag.meal_count > 0 && (
                <span className="block mt-2 text-destructive">
                  Warning: This tag is currently assigned to {selectedTag.meal_count} meal(s). 
                  Deleting it will remove the tag from all meals.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
