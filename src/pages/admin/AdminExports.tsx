import { useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import {
  AdminKpiStrip,
  AdminPanel,
  AdminPanelHeader,
  AdminWorkbenchHeader,
} from "@/components/admin/AdminPrimitives";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Download,
  Users,
  CreditCard,
  ShoppingBag,
  FileSpreadsheet,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { downloadCsv as downloadCsvFile } from "@/lib/csv";
import { toast } from "sonner";
import { format, subDays, subMonths } from "date-fns";

type ExportType = "users" | "subscriptions" | "orders";
type DateRange = "7days" | "30days" | "90days" | "all";

const C = {
  text: "#020617",
  muted: "#94A3B8",
  surface: "#F6F8FB",
  water: "#38BDF8",
  danger: "#FB6B7A",
  protein: "#7C83F6",
  progress: "#22C7A1",
};

const formatOptionalDate = (value: string | null, pattern: string) =>
  value ? format(new Date(value), pattern) : "N/A";

const AdminExports = () => {
  const [exporting, setExporting] = useState<ExportType | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>("30days");

  const getDateFilter = () => {
    const now = new Date();
    switch (dateRange) {
      case "7days":
        return subDays(now, 7).toISOString();
      case "30days":
        return subDays(now, 30).toISOString();
      case "90days":
        return subMonths(now, 3).toISOString();
      default:
        return null;
    }
  };

  const downloadCSV = (data: Record<string, unknown>[], filename: string) => {
    if (data.length === 0) {
      toast.error("No data to export");
      return;
    }

    const headers = Object.keys(data[0]);
    downloadCsvFile(
      [headers, ...data.map((row) => headers.map((header) => row[header]))],
      `${filename}_${format(new Date(), "yyyy-MM-dd")}.csv`,
    );
  };

  const exportUsers = async () => {
    setExporting("users");
    try {
      const dateFilter = getDateFilter();
      let query = supabase
        .from("profiles")
        .select(
          "id, user_id, full_name, gender, age, health_goal, activity_level, daily_calorie_target, onboarding_completed, created_at",
        );

      if (dateFilter) {
        query = query.gte("created_at", dateFilter);
      }

      const { data, error } = await query.order("created_at", {
        ascending: false,
      });

      if (error) throw error;

      const formattedData = (data || []).map((user) => ({
        ID: user.id,
        "User ID": user.user_id,
        "Full Name": user.full_name || "N/A",
        Gender: user.gender || "N/A",
        Age: user.age || "N/A",
        "Health Goal": user.health_goal || "N/A",
        "Activity Level": user.activity_level || "N/A",
        "Daily Calorie Target": user.daily_calorie_target || "N/A",
        "Onboarding Completed": user.onboarding_completed ? "Yes" : "No",
        "Created At": format(new Date(user.created_at), "yyyy-MM-dd HH:mm:ss"),
      }));

      downloadCSV(formattedData, "users_export");
      toast.success(`Exported ${formattedData.length} users`);
    } catch (error) {
      console.error("Error exporting users:", error);
      toast.error("Failed to export users");
    } finally {
      setExporting(null);
    }
  };

  const exportSubscriptions = async () => {
    setExporting("subscriptions");
    try {
      const dateFilter = getDateFilter();
      let query = supabase
        .from("subscriptions")
        .select(
          "id, user_id, plan, status, price, start_date, end_date, meals_per_week, auto_renew, created_at",
        );

      if (dateFilter) {
        query = query.gte("created_at", dateFilter);
      }

      const { data, error } = await query.order("created_at", {
        ascending: false,
      });

      if (error) throw error;

      const formattedData = (data || []).map((sub) => ({
        ID: sub.id,
        "User ID": sub.user_id,
        Plan: sub.plan,
        Status: sub.status || "N/A",
        Price: `${sub.price ?? 0} QAR`,
        "Start Date": formatOptionalDate(sub.start_date, "yyyy-MM-dd"),
        "End Date": formatOptionalDate(sub.end_date, "yyyy-MM-dd"),
        "Meals Per Week": sub.meals_per_week || "N/A",
        "Auto Renew": sub.auto_renew ? "Yes" : "No",
        "Created At": formatOptionalDate(sub.created_at, "yyyy-MM-dd HH:mm:ss"),
      }));

      downloadCSV(formattedData, "subscriptions_export");
      toast.success(`Exported ${formattedData.length} subscriptions`);
    } catch (error) {
      console.error("Error exporting subscriptions:", error);
      toast.error("Failed to export subscriptions");
    } finally {
      setExporting(null);
    }
  };

  const exportOrders = async () => {
    setExporting("orders");
    try {
      const dateFilter = getDateFilter();
      let query = supabase.from("orders").select(`
          id, 
          user_id, 
          restaurant_id,
          status, 
          total_amount, 
          estimated_delivery_time,
          delivered_at,
          order_type,
          notes,
          created_at,
          restaurants (name)
        `);

      if (dateFilter) {
        query = query.gte("created_at", dateFilter);
      }

      const { data, error } = await query.order("created_at", {
        ascending: false,
      });

      if (error) throw error;

      const formattedData = (data || []).map((order) => {
        const restaurant = Array.isArray(order.restaurants)
          ? order.restaurants[0]
          : order.restaurants;

        return {
          ID: order.id,
          "User ID": order.user_id,
          Restaurant: restaurant?.name || "N/A",
          Status: order.status || "N/A",
          "Total Amount": `${order.total_amount ?? 0} QAR`,
          "Delivery Date": formatOptionalDate(
            order.delivered_at ??
              order.estimated_delivery_time ??
              order.created_at,
            "yyyy-MM-dd",
          ),
          "Order Type": order.order_type || "N/A",
          Notes: order.notes || "N/A",
          "Created At": format(
            new Date(order.created_at),
            "yyyy-MM-dd HH:mm:ss",
          ),
        };
      });

      downloadCSV(formattedData, "orders_export");
      toast.success(`Exported ${formattedData.length} orders`);
    } catch (error) {
      console.error("Error exporting orders:", error);
      toast.error("Failed to export orders");
    } finally {
      setExporting(null);
    }
  };

  const exports = [
    {
      type: "users" as ExportType,
      title: "Users Report",
      description:
        "Export all user profiles including demographics and health goals",
      icon: Users,
      action: exportUsers,
      color: C.protein,
    },
    {
      type: "subscriptions" as ExportType,
      title: "Subscriptions Report",
      description:
        "Export all subscription data including plans, status, and pricing",
      icon: CreditCard,
      action: exportSubscriptions,
      color: C.progress,
    },
    {
      type: "orders" as ExportType,
      title: "Orders Report",
      description:
        "Export all orders with restaurant details and delivery information",
      icon: ShoppingBag,
      action: exportOrders,
      color: C.water,
    },
  ];

  return (
    <AdminLayout
      title="Exports"
      subtitle="Download operational reports for customers, subscriptions, and orders"
    >
      <div className="space-y-6 bg-[#F6F8FB] p-1 text-[#020617]">
        <AdminWorkbenchHeader
          eyebrow="Data operations"
          title="Data export workbench"
          icon={FileSpreadsheet}
          accent="#22C7A1"
          description="Download operational CSV reports for users, subscriptions, and orders with a controlled date range."
          meta={[
            {
              label: "Selected range",
              value: dateRange.replace("days", " days"),
            },
            { label: "Available exports", value: exports.length },
            { label: "Status", value: exporting ? "Exporting" : "Ready" },
          ]}
        />

        <AdminKpiStrip
          className="lg:grid-cols-3 2xl:grid-cols-3"
          items={[
            {
              label: "Customers",
              value: "Users CSV",
              helper: "Profile data",
              icon: Users,
              accent: "#7C83F6",
            },
            {
              label: "Subscriptions",
              value: "Plans CSV",
              helper: "Billing records",
              icon: CreditCard,
              accent: "#22C7A1",
            },
            {
              label: "Orders",
              value: "Orders CSV",
              helper: "Operational report",
              icon: ShoppingBag,
              accent: "#F97316",
            },
          ]}
        />

        <AdminPanel>
          <AdminPanelHeader
            title="Export settings"
            eyebrow="Report controls"
            description="Configure your export preferences"
            actions={<FileSpreadsheet className="h-5 w-5 text-[#22C7A1]" />}
          />
          <div className="p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                  Date Range
                </Label>
                <Select
                  value={dateRange}
                  onValueChange={(value: DateRange) => setDateRange(value)}
                >
                  <SelectTrigger className="h-12 w-full rounded-2xl border border-[#E5EAF1] bg-[#F6F8FB] font-bold text-[#020617] focus:ring-2 focus:ring-[#22C7A1]/30 sm:w-[220px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-[18px] border-[#E5EAF1] bg-white text-[#020617] shadow-[0_18px_42px_rgba(2,6,23,0.12)]">
                    <SelectItem value="7days">Last 7 days</SelectItem>
                    <SelectItem value="30days">Last 30 days</SelectItem>
                    <SelectItem value="90days">Last 90 days</SelectItem>
                    <SelectItem value="all">All time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-2xl bg-[#F6F8FB] px-4 py-3 text-sm font-semibold text-[#94A3B8]">
                Exports include records created within the selected range.
              </div>
            </div>
          </div>
        </AdminPanel>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {exports.map((exportItem) => (
            <AdminPanel
              key={exportItem.type}
              className="flex flex-col transition hover:-translate-y-0.5 hover:shadow-[0_22px_52px_rgba(2,6,23,0.08)]"
            >
              <div className="p-6">
                <div className="mb-5 flex items-center justify-between">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-2xl"
                    style={{
                      backgroundColor: `${exportItem.color}18`,
                      color: exportItem.color,
                    }}
                  >
                    <exportItem.icon className="h-6 w-6" />
                  </div>
                  <span className="rounded-full bg-[#F6F8FB] px-3 py-1 text-xs font-black text-[#94A3B8]">
                    CSV
                  </span>
                </div>
                <h3 className="text-xl font-black text-[#020617]">
                  {exportItem.title}
                </h3>
                <p className="mt-2 min-h-12 font-medium leading-6 text-[#94A3B8]">
                  {exportItem.description}
                </p>
              </div>
              <div className="mt-auto p-6 pt-0">
                <Button
                  onClick={exportItem.action}
                  disabled={exporting !== null}
                  className="h-12 w-full rounded-2xl text-sm font-black text-white shadow-[0_14px_28px_rgba(2,6,23,0.14)] hover:opacity-95 disabled:opacity-60"
                  style={{ backgroundColor: exportItem.color }}
                >
                  {exporting === exportItem.type ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Download CSV
                    </>
                  )}
                </Button>
              </div>
            </AdminPanel>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminExports;
