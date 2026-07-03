import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
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
  AlertDialogContent,
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
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [formData, setFormData] = useState<PromotionFormData>(initialFormData);
  const [deletePromotion, setDeletePromotion] = useState<Promotion | null>(null);
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
      const active = promotionsData?.filter((promotion) =>
        promotion.is_active &&
        new Date(promotion.valid_from) <= now &&
        (!promotion.valid_until || new Date(promotion.valid_until) > now)
      ).length || 0;
      const totalRedemptions = promotionsData?.reduce((sum, promotion) => sum + (promotion.uses_count || 0), 0) || 0;
      const totalDiscount = usageData?.reduce((sum, usage) => sum + Number(usage.discount_applied), 0) || 0;

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
        max_discount_amount: formData.max_discount_amount ? parseFloat(formData.max_discount_amount) : null,
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
        toast({ title: "Success", description: "Promotion updated successfully" });
      } else {
        const { error } = await supabase
          .from("promotions")
          .insert(promotionData);

        if (error) throw error;
        toast({ title: "Success", description: "Promotion created successfully" });
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
        description: error instanceof Error ? error.message : "Failed to save promotion",
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

      toast({ title: "Success", description: "Promotion deleted successfully" });
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
    toast({ title: "Copied", description: `Code "${code}" copied to clipboard` });
  };

  const getStatusBadge = (promotion: Promotion) => {
    const now = new Date();
    const validFrom = new Date(promotion.valid_from);
    const validUntil = promotion.valid_until ? new Date(promotion.valid_until) : null;

    if (!promotion.is_active) {
      return <Badge variant="outline" className="border-[#E5EAF1] bg-[#F6F8FB] font-black text-[#94A3B8]">Inactive</Badge>;
    }
    if (validFrom > now) {
      return <Badge variant="outline" className="border-[#38BDF8]/20 bg-[#EFF9FF] font-black text-[#38BDF8]">Scheduled</Badge>;
    }
    if (validUntil && validUntil < now) {
      return <Badge variant="outline" className="border-[#FB6B7A]/20 bg-[#FFF0F2] font-black text-[#FB6B7A]">Expired</Badge>;
    }
    if (promotion.max_uses && promotion.uses_count >= promotion.max_uses) {
      return <Badge variant="outline" className="border-[#F97316]/25 bg-[#FFF7ED] font-black text-[#F97316]">Exhausted</Badge>;
    }
    return <Badge variant="outline" className="border-[#22C7A1]/20 bg-[#EFFFFA] font-black text-[#22C7A1]">Active</Badge>;
  };

  const filteredPromotions = promotions.filter((promotion) =>
    promotion.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    promotion.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AdminLayout title="Promotions" subtitle="Create and manage discount codes">
      <div className="space-y-5 text-[#020617]">
        <section className="overflow-hidden rounded-[24px] bg-white shadow-[0_18px_42px_rgba(2,6,23,0.07)] ring-1 ring-[#E5EAF1]">
          <div className="flex flex-col gap-4 border-b border-[#E5EAF1] bg-[#F6F8FB] p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-[#020617] text-white">
                <Ticket className="h-6 w-6" />
              </span>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#22C7A1]">Growth Tools</p>
                <h1 className="mt-1 text-2xl font-black tracking-tight text-[#020617]">Promotions & Coupons</h1>
                <p className="mt-1 text-sm font-semibold text-[#94A3B8]">Create, schedule, and monitor discount campaigns.</p>
              </div>
            </div>
            <Button
              onClick={openCreateDialog}
              className="h-11 gap-2 rounded-[14px] bg-[#020617] px-4 font-black text-white hover:bg-[#020617]/90"
            >
              <Plus className="h-4 w-4" />
              Create Promotion
            </Button>
          </div>

          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Total Promotions", value: stats.total, Icon: Ticket, bg: "bg-[#F6F8FB]", color: "text-[#020617]", ring: "ring-[#E5EAF1]" },
              { label: "Active Now", value: stats.active, Icon: TrendingUp, bg: "bg-[#EFFFFA]", color: "text-[#22C7A1]", ring: "ring-[#22C7A1]/20" },
              { label: "Redemptions", value: stats.totalRedemptions, Icon: Users, bg: "bg-[#F3F4FF]", color: "text-[#7C83F6]", ring: "ring-[#7C83F6]/20" },
              { label: "Discounts Given", value: formatCurrency(stats.totalDiscount), Icon: DollarSign, bg: "bg-[#EFF9FF]", color: "text-[#38BDF8]", ring: "ring-[#38BDF8]/20" },
            ].map(({ label, value, Icon, bg, color, ring }) => (
              <div key={label} className={`rounded-[20px] ${bg} p-4 ring-1 ${ring}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-3xl font-black leading-none text-[#020617]">{value}</p>
                    <p className="mt-2 text-[11px] font-black uppercase tracking-[0.12em] text-[#94A3B8]">{label}</p>
                  </div>
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-white ${color} shadow-sm ring-1 ring-white/80`}>
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
              placeholder="Search by code or name"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="h-11 rounded-[14px] border-[#E5EAF1] bg-[#F6F8FB] pl-10 font-semibold text-[#020617] placeholder:text-[#94A3B8] focus-visible:ring-[#020617]"
            />
          </div>
        </section>

        <section className="overflow-hidden rounded-[24px] bg-white shadow-[0_14px_34px_rgba(2,6,23,0.06)] ring-1 ring-[#E5EAF1]">
          <div className="flex items-center justify-between gap-3 border-b border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4">
            <div>
              <h2 className="text-lg font-black text-[#020617]">Promotion Directory</h2>
              <p className="text-xs font-bold text-[#94A3B8]">{filteredPromotions.length} visible from {promotions.length} total</p>
            </div>
            <Badge variant="outline" className="border-[#38BDF8]/20 bg-[#EFF9FF] text-[#38BDF8]">
              Coupon engine
            </Badge>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-[#E5EAF1] hover:bg-transparent">
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Validity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-[#020617]" />
                        <p className="text-sm font-semibold text-[#94A3B8]">Loading promotions...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredPromotions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center">
                      <p className="font-black text-[#020617]">No promotions found</p>
                      <p className="mt-1 text-sm font-semibold text-[#94A3B8]">Try adjusting your search.</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPromotions.map((promotion) => (
                    <TableRow key={promotion.id} className="border-[#E5EAF1] transition-colors hover:bg-[#F6F8FB]">
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
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-black text-[#020617]">{promotion.name}</p>
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
                          <span>{format(new Date(promotion.valid_from), "MMM d, yyyy")}</span>
                        </div>
                        {promotion.valid_until && (
                          <p className="text-xs font-semibold text-[#94A3B8]">
                            Until {format(new Date(promotion.valid_until), "MMM d, yyyy")}
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
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="min-h-[44px] min-w-[44px] text-[#FB6B7A] hover:bg-[#FFF0F2] hover:text-[#FB6B7A]"
                            onClick={() => setDeletePromotion(promotion)}
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

        <AlertDialog open={!!deletePromotion} onOpenChange={() => setDeletePromotion(null)}>
          <AlertDialogContent className="border-[#E5EAF1] bg-white p-0 shadow-[0_24px_60px_rgba(2,6,23,0.18)]">
            <AlertDialogHeader className="border-b border-[#E5EAF1] bg-[#F6F8FB] p-5 text-left">
              <AlertDialogTitle className="flex items-center gap-3 text-xl font-black text-[#020617]">
                <span className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[#FFF0F2] text-[#FB6B7A] ring-1 ring-[#FB6B7A]/20">
                  <AlertTriangle className="h-5 w-5" />
                </span>
                Delete Promotion
              </AlertDialogTitle>
              <AlertDialogDescription className="font-semibold text-[#94A3B8]">
                Are you sure you want to delete the promotion "{deletePromotion?.name}"? This will also delete all usage history. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="border-t border-[#E5EAF1] bg-[#F6F8FB] p-5">
              <AlertDialogCancel className="h-11 rounded-[14px] border-[#E5EAF1] bg-white font-black text-[#020617] hover:bg-white">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="h-11 rounded-[14px] bg-[#FB6B7A] font-black text-white hover:bg-[#FB6B7A]/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
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
  const inputClass = "h-11 rounded-[14px] border-[#E5EAF1] bg-[#F6F8FB] font-semibold text-[#020617] focus-visible:ring-[#020617]";
  const labelClass = "font-black text-[#020617]";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-[95vw] overflow-y-auto border-[#E5EAF1] bg-white p-0 shadow-[0_24px_60px_rgba(2,6,23,0.18)] sm:max-w-2xl">
        <DialogHeader className="border-b border-[#E5EAF1] bg-[#F6F8FB] p-5 text-left">
          <DialogTitle className="text-xl font-black text-[#020617]">
            {editingPromotion ? "Edit Promotion" : "Create New Promotion"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 p-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="code" className={labelClass}>Promo Code *</Label>
                <div className="flex gap-2">
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(event) => setFormData((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))}
                    placeholder="SAVE20"
                    className={`${inputClass} uppercase`}
                  />
                  <Button type="button" variant="outline" onClick={generateCode} className="h-11 rounded-[14px] border-[#E5EAF1] bg-white font-black text-[#020617] hover:bg-[#F6F8FB]">
                    Generate
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name" className={labelClass}>Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Summer Sale 20% Off"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className={labelClass}>Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
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
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed Amount ({CURRENCY.symbol})</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="discount_value" className={labelClass}>
                  Discount Value * {formData.discount_type === "percentage" ? "(%)" : `(${CURRENCY.symbol})`}
                </Label>
                <Input
                  id="discount_value"
                  type="number"
                  inputMode={formData.discount_type === "percentage" ? "numeric" : "decimal"}
                  min="0"
                  max={formData.discount_type === "percentage" ? 100 : undefined}
                  value={formData.discount_value}
                  onChange={(event) => setFormData((prev) => ({ ...prev, discount_value: event.target.value }))}
                  placeholder={formData.discount_type === "percentage" ? "20" : "10.00"}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="min_order_amount" className={labelClass}>Minimum Order Amount ({CURRENCY.symbol})</Label>
                <Input
                  id="min_order_amount"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={formData.min_order_amount}
                  onChange={(event) => setFormData((prev) => ({ ...prev, min_order_amount: event.target.value }))}
                  placeholder="0"
                  className={inputClass}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_discount_amount" className={labelClass}>Max Discount Amount ({CURRENCY.symbol})</Label>
                <Input
                  id="max_discount_amount"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={formData.max_discount_amount}
                  onChange={(event) => setFormData((prev) => ({ ...prev, max_discount_amount: event.target.value }))}
                  placeholder="No limit"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="max_uses" className={labelClass}>Total Usage Limit</Label>
                <Input
                  id="max_uses"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  value={formData.max_uses}
                  onChange={(event) => setFormData((prev) => ({ ...prev, max_uses: event.target.value }))}
                  placeholder="Unlimited"
                  className={inputClass}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_uses_per_user" className={labelClass}>Uses Per Customer</Label>
                <Input
                  id="max_uses_per_user"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  value={formData.max_uses_per_user}
                  onChange={(event) => setFormData((prev) => ({ ...prev, max_uses_per_user: event.target.value }))}
                  placeholder="1"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="valid_from" className={labelClass}>Valid From *</Label>
                <Input
                  id="valid_from"
                  type="datetime-local"
                  value={formData.valid_from}
                  onChange={(event) => setFormData((prev) => ({ ...prev, valid_from: event.target.value }))}
                  className={inputClass}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="valid_until" className={labelClass}>Valid Until</Label>
                <Input
                  id="valid_until"
                  type="datetime-local"
                  value={formData.valid_until}
                  onChange={(event) => setFormData((prev) => ({ ...prev, valid_until: event.target.value }))}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-[18px] bg-[#F6F8FB] p-4 ring-1 ring-[#E5EAF1]">
              <Label htmlFor="is_active" className="font-black text-[#020617]">Active</Label>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, is_active: checked }))}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-[#E5EAF1] bg-[#F6F8FB] p-5">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="h-11 rounded-[14px] border-[#E5EAF1] bg-white font-black text-[#020617] hover:bg-white">
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="h-11 rounded-[14px] bg-[#020617] font-black text-white hover:bg-[#020617]/90">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingPromotion ? "Update" : "Create"} Promotion
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
