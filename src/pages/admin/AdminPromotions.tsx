import { useState, useEffect, useCallback } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Search,
  Ticket,
  TrendingUp,
  Users,
  DollarSign,
  Edit,
  Trash2,
  Copy,
  Calendar,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { formatCurrency, CURRENCY } from "@/lib/currency";

interface Promotion {
  id: string;
  code: string;
  name: string;
  description: string | null;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  min_order_amount: number;
  max_discount_amount: number | null;
  max_uses: number | null;
  uses_count: number;
  max_uses_per_user: number;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
}

interface PromotionFormData {
  code: string;
  name: string;
  description: string;
  discount_type: "percentage" | "fixed";
  discount_value: string;
  min_order_amount: string;
  max_discount_amount: string;
  max_uses: string;
  max_uses_per_user: string;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
}

const initialFormData: PromotionFormData = {
  code: "",
  name: "",
  description: "",
  discount_type: "percentage",
  discount_value: "",
  min_order_amount: "0",
  max_discount_amount: "",
  max_uses: "",
  max_uses_per_user: "1",
  valid_from: new Date().toISOString().slice(0, 16),
  valid_until: "",
  is_active: true,
};

export default function AdminPromotions() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(
    null,
  );
  const [formData, setFormData] = useState<PromotionFormData>(initialFormData);
  const [deletePromotion, setDeletePromotion] = useState<Promotion | null>(
    null,
  );
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    totalRedemptions: 0,
    totalDiscount: 0,
  });
  const { toast } = useToast();

  const fetchPromotions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("promotions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPromotions((data as Promotion[]) || []);
    } catch (error) {
      console.error("Error fetching promotions:", error);
      toast({
        title: "Error",
        description: "Failed to load promotions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchStats = useCallback(async () => {
    try {
      const { data: promotionsData } = await supabase
        .from("promotions")
        .select("id, is_active, uses_count, valid_from, valid_until");

      const { data: usageData } = await supabase
        .from("promotion_usage")
        .select("discount_applied");

      const now = new Date();
      const total = promotionsData?.length || 0;
      const active =
        promotionsData?.filter(
          (promotion) =>
            promotion.is_active &&
            new Date(promotion.valid_from) <= now &&
            (!promotion.valid_until || new Date(promotion.valid_until) > now),
        ).length || 0;
      const totalRedemptions =
        promotionsData?.reduce(
          (sum, promotion) => sum + (promotion.uses_count || 0),
          0,
        ) || 0;
      const totalDiscount =
        usageData?.reduce(
          (sum, usage) => sum + Number(usage.discount_applied),
          0,
        ) || 0;

      setStats({ total, active, totalRedemptions, totalDiscount });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  }, []);

  useEffect(() => {
    fetchPromotions();
    fetchStats();
  }, [fetchPromotions, fetchStats]);

  const openCreateDialog = () => {
    setEditingPromotion(null);
    setFormData(initialFormData);
    setIsDialogOpen(true);
  };

  const generateCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData((prev) => ({ ...prev, code }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!formData.code || !formData.name || !formData.discount_value) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const promotionData = {
        code: formData.code.toUpperCase(),
        name: formData.name,
        description: formData.description || null,
        discount_type: formData.discount_type,
        discount_value: parseFloat(formData.discount_value),
        min_order_amount: parseFloat(formData.min_order_amount) || 0,
        max_discount_amount: formData.max_discount_amount
          ? parseFloat(formData.max_discount_amount)
          : null,
        max_uses: formData.max_uses ? parseInt(formData.max_uses) : null,
        max_uses_per_user: parseInt(formData.max_uses_per_user) || 1,
        valid_from: formData.valid_from,
        valid_until: formData.valid_until || null,
        is_active: formData.is_active,
      };

      if (editingPromotion) {
        const { error } = await supabase
          .from("promotions")
          .update(promotionData)
          .eq("id", editingPromotion.id);

        if (error) throw error;
        toast({
          title: "Success",
          description: "Promotion updated successfully",
        });
      } else {
        const { error } = await supabase
          .from("promotions")
          .insert(promotionData);

        if (error) throw error;
        toast({
          title: "Success",
          description: "Promotion created successfully",
        });
      }

      setIsDialogOpen(false);
      setEditingPromotion(null);
      setFormData(initialFormData);
      fetchPromotions();
      fetchStats();
    } catch (error: unknown) {
      console.error("Error saving promotion:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to save promotion",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (promotion: Promotion) => {
    setEditingPromotion(promotion);
    setFormData({
      code: promotion.code,
      name: promotion.name,
      description: promotion.description || "",
      discount_type: promotion.discount_type,
      discount_value: promotion.discount_value.toString(),
      min_order_amount: promotion.min_order_amount.toString(),
      max_discount_amount: promotion.max_discount_amount?.toString() || "",
      max_uses: promotion.max_uses?.toString() || "",
      max_uses_per_user: promotion.max_uses_per_user.toString(),
      valid_from: promotion.valid_from.slice(0, 16),
      valid_until: promotion.valid_until?.slice(0, 16) || "",
      is_active: promotion.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deletePromotion) return;

    try {
      const { error } = await supabase
        .from("promotions")
        .delete()
        .eq("id", deletePromotion.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Promotion deleted successfully",
      });
      setDeletePromotion(null);
      fetchPromotions();
      fetchStats();
    } catch (error) {
      console.error("Error deleting promotion:", error);
      toast({
        title: "Error",
        description: "Failed to delete promotion",
        variant: "destructive",
      });
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Copied",
      description: `Code "${code}" copied to clipboard`,
    });
  };

  const getStatusBadge = (promotion: Promotion) => {
    const now = new Date();
    const validFrom = new Date(promotion.valid_from);
    const validUntil = promotion.valid_until
      ? new Date(promotion.valid_until)
      : null;

    if (!promotion.is_active) {
      return (
        <Badge
          variant="outline"
          className="border-[#E5EAF1] bg-[#F6F8FB] font-black text-[#94A3B8]"
        >
          Inactive
        </Badge>
      );
    }
    if (validFrom > now) {
      return (
        <Badge
          variant="outline"
          className="border-[#38BDF8]/20 bg-[#38BDF8]/10 font-black text-[#38BDF8]"
        >
          Scheduled
        </Badge>
      );
    }
    if (validUntil && validUntil < now) {
      return (
        <Badge
          variant="outline"
          className="border-[#FB6B7A]/20 bg-[#FB6B7A]/10 font-black text-[#FB6B7A]"
        >
          Expired
        </Badge>
      );
    }
    if (promotion.max_uses && promotion.uses_count >= promotion.max_uses) {
      return (
        <Badge
          variant="outline"
          className="border-[#F97316]/25 bg-[#F97316]/10 font-black text-[#F97316]"
        >
          Exhausted
        </Badge>
      );
    }
    return (
      <Badge
        variant="outline"
        className="border-[#22C7A1]/20 bg-[#22C7A1]/10 font-black text-[#22C7A1]"
      >
        Active
      </Badge>
    );
  };

  const filteredPromotions = promotions.filter(
    (promotion) =>
      promotion.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      promotion.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <AdminLayout title="Promotions" subtitle="Create and manage discount codes">
      <div className="space-y-5 text-[#020617]">
        <AdminWorkbenchHeader
          eyebrow="Growth tools"
          title="Promotion control desk"
          icon={Ticket}
          accent="#22C7A1"
          description="Create campaigns, monitor active coupons, track redemptions, and understand the discount cost of each growth push."
          meta={[
            { label: "Active now", value: stats.active },
            { label: "Redemptions", value: stats.totalRedemptions },
            { label: "Discounts", value: formatCurrency(stats.totalDiscount) },
          ]}
          actions={
            <Button
              onClick={openCreateDialog}
              variant="outline"
              className="h-11 gap-2 rounded-[14px] border-[#22C7A1]/30 bg-[#22C7A1]/10 px-4 font-black text-[#020617] hover:bg-[#22C7A1]/15"
            >
              <Plus className="h-4 w-4" />
              Create Promotion
            </Button>
          }
        />

        <AdminKpiStrip
          items={[
            {
              label: "Total promotions",
              value: stats.total,
              helper: "Campaign library",
              icon: Ticket,
              accent: "#7C83F6",
            },
            {
              label: "Active now",
              value: stats.active,
              helper: "Currently live",
              icon: TrendingUp,
              accent: "#22C7A1",
            },
            {
              label: "Redemptions",
              value: stats.totalRedemptions,
              helper: "Customer usage",
              icon: Users,
              accent: "#F97316",
            },
            {
              label: "Discounts given",
              value: formatCurrency(stats.totalDiscount),
              helper: "Growth cost",
              icon: DollarSign,
              accent: "#38BDF8",
            },
          ]}
        />

        <AdminFilterBar title="Campaign search">
          <div className="relative max-w-md">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            <Input
              placeholder="Search by code or name"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="h-11 rounded-[14px] border-[#E5EAF1] bg-[#F6F8FB] pl-10 font-semibold text-[#020617] placeholder:text-[#94A3B8] focus-visible:ring-[#020617]"
            />
          </div>
        </AdminFilterBar>

        <section className="overflow-hidden rounded-[24px] bg-white shadow-[0_14px_34px_rgba(2,6,23,0.06)] ring-1 ring-[#E5EAF1]">
          <div className="flex items-center justify-between gap-3 border-b border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4">
            <div>
              <h2 className="text-lg font-black text-[#020617]">
                Promotion Directory
              </h2>
              <p className="text-xs font-bold text-[#94A3B8]">
                {filteredPromotions.length} visible from {promotions.length}{" "}
                total
              </p>
            </div>
            <Badge
              variant="outline"
              className="border-[#38BDF8]/20 bg-[#38BDF8]/10 text-[#38BDF8]"
            >
              Coupon engine
            </Badge>
          </div>
          <div className="grid gap-3 p-4 md:hidden">
            {loading ? (
              <div className="flex flex-col items-center gap-3 rounded-[22px] border border-[#E5EAF1] bg-[#F6F8FB] p-8">
                <Loader2 className="h-8 w-8 animate-spin text-[#020617]" />
                <p className="text-sm font-semibold text-[#94A3B8]">
                  Loading promotions...
                </p>
              </div>
            ) : filteredPromotions.length === 0 ? (
              <div className="rounded-[22px] border border-[#E5EAF1] bg-[#F6F8FB] p-8 text-center">
                <p className="font-black text-[#020617]">No promotions found</p>
                <p className="mt-1 text-sm font-semibold text-[#94A3B8]">
                  Try adjusting your search.
                </p>
              </div>
            ) : (
              filteredPromotions.map((promotion) => (
                <div
                  key={promotion.id}
                  className="rounded-[24px] border border-[#E5EAF1] bg-white p-4 shadow-[0_12px_30px_rgba(2,6,23,0.05)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <code className="rounded-[10px] bg-[#F6F8FB] px-2 py-1 font-mono text-sm font-black text-[#020617] ring-1 ring-[#E5EAF1]">
                          {promotion.code}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="min-h-[44px] min-w-[44px] rounded-2xl text-[#94A3B8] hover:bg-[#F6F8FB] hover:text-[#020617]"
                          onClick={() => copyCode(promotion.code)}
                          aria-label={`Copy promotion code ${promotion.code}`}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <p className="mt-2 truncate text-base font-black text-[#020617]">
                        {promotion.name}
                      </p>
                      {promotion.description && (
                        <p className="mt-1 line-clamp-2 text-sm font-semibold text-[#94A3B8]">
                          {promotion.description}
                        </p>
                      )}
                    </div>
                    {getStatusBadge(promotion)}
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="rounded-2xl border border-[#E5EAF1] bg-[#F6F8FB] p-3">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                        Discount
                      </p>
                      <p className="mt-1 text-lg font-black text-[#020617]">
                        {promotion.discount_type === "percentage"
                          ? `${promotion.discount_value}%`
                          : formatCurrency(promotion.discount_value)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-[#E5EAF1] bg-[#F6F8FB] p-3">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                        Usage
                      </p>
                      <p className="mt-1 text-lg font-black text-[#020617]">
                        {promotion.uses_count}
                        {promotion.max_uses && ` / ${promotion.max_uses}`}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 rounded-2xl bg-[#F6F8FB] p-3">
                    <div className="flex items-start gap-2 text-sm font-semibold text-[#020617]">
                      <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-[#38BDF8]" />
                      <div>
                        <p>
                          Starts{" "}
                          {format(
                            new Date(promotion.valid_from),
                            "MMM d, yyyy",
                          )}
                        </p>
                        {promotion.valid_until && (
                          <p className="mt-1 text-xs text-[#94A3B8]">
                            Until{" "}
                            {format(
                              new Date(promotion.valid_until),
                              "MMM d, yyyy",
                            )}
                          </p>
                        )}
                        {promotion.min_order_amount > 0 && (
                          <p className="mt-1 text-xs text-[#94A3B8]">
                            Minimum order:{" "}
                            {formatCurrency(promotion.min_order_amount)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Button
                      variant="outline"
                      className="min-h-[44px] rounded-2xl border-[#E5EAF1] bg-white font-black text-[#020617] hover:bg-[#F6F8FB]"
                      onClick={() => handleEdit(promotion)}
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      className="min-h-[44px] rounded-2xl border-[#FB6B7A]/20 bg-[#FB6B7A]/10 font-black text-[#FB6B7A] hover:bg-[#FB6B7A]/15"
                      onClick={() => setDeletePromotion(promotion)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader className="bg-[#F6F8FB]">
                <TableRow className="border-[#E5EAF1] hover:bg-transparent">
                  <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                    Code
                  </TableHead>
                  <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                    Name
                  </TableHead>
                  <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                    Discount
                  </TableHead>
                  <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                    Usage
                  </TableHead>
                  <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                    Validity
                  </TableHead>
                  <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                    Status
                  </TableHead>
                  <TableHead className="text-right text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-[#020617]" />
                        <p className="text-sm font-semibold text-[#94A3B8]">
                          Loading promotions...
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredPromotions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center">
                      <p className="font-black text-[#020617]">
                        No promotions found
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[#94A3B8]">
                        Try adjusting your search.
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPromotions.map((promotion) => (
                    <TableRow
                      key={promotion.id}
                      className="border-[#E5EAF1] transition-colors hover:bg-[#F6F8FB]/70"
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="rounded-[10px] bg-[#F6F8FB] px-2 py-1 font-mono text-sm font-black text-[#020617] ring-1 ring-[#E5EAF1]">
                            {promotion.code}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="min-h-[44px] min-w-[44px] text-[#94A3B8] hover:bg-[#F6F8FB] hover:text-[#020617]"
                            onClick={() => copyCode(promotion.code)}
                            aria-label={`Copy promotion code ${promotion.code}`}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-black text-[#020617]">
                            {promotion.name}
                          </p>
                          {promotion.description && (
                            <p className="max-w-[200px] truncate text-sm font-semibold text-[#94A3B8]">
                              {promotion.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-black text-[#020617]">
                          {promotion.discount_type === "percentage"
                            ? `${promotion.discount_value}%`
                            : formatCurrency(promotion.discount_value)}
                        </span>
                        {promotion.min_order_amount > 0 && (
                          <p className="text-xs font-semibold text-[#94A3B8]">
                            Min: {formatCurrency(promotion.min_order_amount)}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold text-[#020617]">
                          {promotion.uses_count}
                          {promotion.max_uses && ` / ${promotion.max_uses}`}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm font-semibold text-[#020617]">
                          <Calendar className="h-3 w-3 text-[#38BDF8]" />
                          <span>
                            {format(
                              new Date(promotion.valid_from),
                              "MMM d, yyyy",
                            )}
                          </span>
                        </div>
                        {promotion.valid_until && (
                          <p className="text-xs font-semibold text-[#94A3B8]">
                            Until{" "}
                            {format(
                              new Date(promotion.valid_until),
                              "MMM d, yyyy",
                            )}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(promotion)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="min-h-[44px] min-w-[44px] text-[#020617] hover:bg-[#F6F8FB]"
                            onClick={() => handleEdit(promotion)}
                            aria-label={`Edit promotion ${promotion.code}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="min-h-[44px] min-w-[44px] text-[#FB6B7A] hover:bg-[#FB6B7A]/10 hover:text-[#FB6B7A]"
                            onClick={() => setDeletePromotion(promotion)}
                            aria-label={`Delete promotion ${promotion.code}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>

        <PromotionDialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setEditingPromotion(null);
              setFormData(initialFormData);
            }
          }}
          editingPromotion={editingPromotion}
          formData={formData}
          setFormData={setFormData}
          generateCode={generateCode}
          handleSubmit={handleSubmit}
          saving={saving}
        />

        <AlertDialog
          open={!!deletePromotion}
          onOpenChange={() => setDeletePromotion(null)}
        >
          <AdminAlertDialogContent>
            <AlertDialogHeader className="border-b border-[#E5EAF1] bg-[#F6F8FB] p-5 text-left">
              <AlertDialogTitle className="flex items-center gap-3 text-xl font-black text-[#020617]">
                <span className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[#FB6B7A]/10 text-[#FB6B7A] ring-1 ring-[#FB6B7A]/20">
                  <AlertTriangle className="h-5 w-5" />
                </span>
                Delete Promotion
              </AlertDialogTitle>
              <AlertDialogDescription className="font-semibold text-[#94A3B8]">
                Are you sure you want to delete the promotion "
                {deletePromotion?.name}"? This will also delete all usage
                history. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2 sm:gap-3 border-t border-[#E5EAF1] bg-[#F6F8FB] p-5">
              <AlertDialogCancel className="h-11 rounded-[14px] border-[#E5EAF1] bg-white font-black text-[#020617] hover:bg-white">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="h-11 rounded-[14px] bg-[#FB6B7A] font-black text-white hover:bg-[#FB6B7A]/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AdminAlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayout>
  );
}

function PromotionDialog({
  open,
  onOpenChange,
  editingPromotion,
  formData,
  setFormData,
  generateCode,
  handleSubmit,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingPromotion: Promotion | null;
  formData: PromotionFormData;
  setFormData: React.Dispatch<React.SetStateAction<PromotionFormData>>;
  generateCode: () => void;
  handleSubmit: (event: React.FormEvent) => void;
  saving: boolean;
}) {
  const inputClass =
    "h-11 rounded-[14px] border-[#E5EAF1] bg-[#F6F8FB] font-semibold text-[#020617] focus-visible:ring-[#020617]";
  const labelClass = "font-black text-[#020617]";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AdminDialogContent size="lg">
        <DialogHeader className="border-b border-[#E5EAF1] bg-[#F6F8FB] p-5 text-left">
          <DialogTitle className="text-xl font-black text-[#020617]">
            {editingPromotion ? "Edit Promotion" : "Create New Promotion"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 p-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="code" className={labelClass}>
                  Promo Code *
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        code: event.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="SAVE20"
                    className={`${inputClass} uppercase`}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={generateCode}
                    className="h-11 rounded-[14px] border-[#E5EAF1] bg-white font-black text-[#020617] hover:bg-[#F6F8FB]"
                  >
                    Generate
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name" className={labelClass}>
                  Name *
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Summer Sale 20% Off"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className={labelClass}>
                Description
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(event) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
                placeholder="Get 20% off on all orders this summer"
                className="min-h-[100px] rounded-[14px] border-[#E5EAF1] bg-[#F6F8FB] font-semibold text-[#020617] focus-visible:ring-[#020617]"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              <div className="space-y-2">
                <Label className={labelClass}>Discount Type *</Label>
                <Select
                  value={formData.discount_type}
                  onValueChange={(value: "percentage" | "fixed") =>
                    setFormData((prev) => ({ ...prev, discount_type: value }))
                  }
                >
                  <SelectTrigger className={inputClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-[18px] border-[#E5EAF1] bg-white text-[#020617] shadow-[0_18px_42px_rgba(2,6,23,0.12)]">
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">
                      Fixed Amount ({CURRENCY.symbol})
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="discount_value" className={labelClass}>
                  Discount Value *{" "}
                  {formData.discount_type === "percentage"
                    ? "(%)"
                    : `(${CURRENCY.symbol})`}
                </Label>
                <Input
                  id="discount_value"
                  type="number"
                  inputMode={
                    formData.discount_type === "percentage"
                      ? "numeric"
                      : "decimal"
                  }
                  min="0"
                  max={
                    formData.discount_type === "percentage" ? 100 : undefined
                  }
                  value={formData.discount_value}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      discount_value: event.target.value,
                    }))
                  }
                  placeholder={
                    formData.discount_type === "percentage" ? "20" : "10.00"
                  }
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="min_order_amount" className={labelClass}>
                  Minimum Order Amount ({CURRENCY.symbol})
                </Label>
                <Input
                  id="min_order_amount"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={formData.min_order_amount}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      min_order_amount: event.target.value,
                    }))
                  }
                  placeholder="0"
                  className={inputClass}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_discount_amount" className={labelClass}>
                  Max Discount Amount ({CURRENCY.symbol})
                </Label>
                <Input
                  id="max_discount_amount"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={formData.max_discount_amount}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      max_discount_amount: event.target.value,
                    }))
                  }
                  placeholder="No limit"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="max_uses" className={labelClass}>
                  Total Usage Limit
                </Label>
                <Input
                  id="max_uses"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  value={formData.max_uses}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      max_uses: event.target.value,
                    }))
                  }
                  placeholder="Unlimited"
                  className={inputClass}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_uses_per_user" className={labelClass}>
                  Uses Per Customer
                </Label>
                <Input
                  id="max_uses_per_user"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  value={formData.max_uses_per_user}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      max_uses_per_user: event.target.value,
                    }))
                  }
                  placeholder="1"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="valid_from" className={labelClass}>
                  Valid From *
                </Label>
                <Input
                  id="valid_from"
                  type="datetime-local"
                  value={formData.valid_from}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      valid_from: event.target.value,
                    }))
                  }
                  className={inputClass}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="valid_until" className={labelClass}>
                  Valid Until
                </Label>
                <Input
                  id="valid_until"
                  type="datetime-local"
                  value={formData.valid_until}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      valid_until: event.target.value,
                    }))
                  }
                  className={inputClass}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-[18px] bg-[#F6F8FB] p-4 ring-1 ring-[#E5EAF1]">
              <Label htmlFor="is_active" className="font-black text-[#020617]">
                Active
              </Label>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, is_active: checked }))
                }
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-3 border-t border-[#E5EAF1] bg-[#F6F8FB] p-5">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="h-11 rounded-[14px] border-[#E5EAF1] bg-white font-black text-[#020617] hover:bg-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              variant="outline"
              className="h-11 rounded-[14px] border-[#22C7A1]/30 bg-[#22C7A1]/10 font-black text-[#020617] hover:bg-[#22C7A1]/15"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingPromotion ? "Update" : "Create"} Promotion
            </Button>
          </DialogFooter>
        </form>
      </AdminDialogContent>
    </Dialog>
  );
}
