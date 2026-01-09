import { useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Download, Users, CreditCard, ShoppingBag, FileSpreadsheet, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, subDays, subMonths } from "date-fns";

type ExportType = "users" | "subscriptions" | "orders";
type DateRange = "7days" | "30days" | "90days" | "all";

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
    const csvContent = [
      headers.join(","),
      ...data.map(row =>
        headers.map(header => {
          const value = row[header];
          if (value === null || value === undefined) return "";
          const stringValue = String(value);
          if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        }).join(",")
      )
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const exportUsers = async () => {
    setExporting("users");
    try {
      const dateFilter = getDateFilter();
      let query = supabase
        .from("profiles")
        .select("id, user_id, full_name, gender, age, health_goal, activity_level, daily_calorie_target, onboarding_completed, created_at");

      if (dateFilter) {
        query = query.gte("created_at", dateFilter);
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) throw error;

      const formattedData = (data || []).map(user => ({
        ID: user.id,
        "User ID": user.user_id,
        "Full Name": user.full_name || "N/A",
        Gender: user.gender || "N/A",
        Age: user.age || "N/A",
        "Health Goal": user.health_goal || "N/A",
        "Activity Level": user.activity_level || "N/A",
        "Daily Calorie Target": user.daily_calorie_target || "N/A",
        "Onboarding Completed": user.onboarding_completed ? "Yes" : "No",
        "Created At": format(new Date(user.created_at), "yyyy-MM-dd HH:mm:ss")
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
        .select("id, user_id, plan, status, price, start_date, end_date, meals_per_week, auto_renew, created_at");

      if (dateFilter) {
        query = query.gte("created_at", dateFilter);
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) throw error;

      const formattedData = (data || []).map(sub => ({
        ID: sub.id,
        "User ID": sub.user_id,
        Plan: sub.plan,
        Status: sub.status || "N/A",
        Price: `$${sub.price}`,
        "Start Date": format(new Date(sub.start_date), "yyyy-MM-dd"),
        "End Date": format(new Date(sub.end_date), "yyyy-MM-dd"),
        "Meals Per Week": sub.meals_per_week || "N/A",
        "Auto Renew": sub.auto_renew ? "Yes" : "No",
        "Created At": format(new Date(sub.created_at), "yyyy-MM-dd HH:mm:ss")
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
      let query = supabase
        .from("orders")
        .select(`
          id, 
          user_id, 
          restaurant_id,
          status, 
          total_price, 
          delivery_date,
          meal_type,
          notes,
          created_at,
          restaurants (name)
        `);

      if (dateFilter) {
        query = query.gte("created_at", dateFilter);
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) throw error;

      const formattedData = (data || []).map(order => ({
        ID: order.id,
        "User ID": order.user_id,
        Restaurant: (order.restaurants as { name: string } | null)?.name || "N/A",
        Status: order.status || "N/A",
        "Total Price": `$${order.total_price}`,
        "Delivery Date": format(new Date(order.delivery_date), "yyyy-MM-dd"),
        "Meal Type": order.meal_type || "N/A",
        Notes: order.notes || "N/A",
        "Created At": format(new Date(order.created_at), "yyyy-MM-dd HH:mm:ss")
      }));

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
      description: "Export all user profiles including demographics and health goals",
      icon: Users,
      action: exportUsers
    },
    {
      type: "subscriptions" as ExportType,
      title: "Subscriptions Report",
      description: "Export all subscription data including plans, status, and pricing",
      icon: CreditCard,
      action: exportSubscriptions
    },
    {
      type: "orders" as ExportType,
      title: "Orders Report",
      description: "Export all orders with restaurant details and delivery information",
      icon: ShoppingBag,
      action: exportOrders
    }
  ];

  return (
    <AdminLayout title="Data Export" subtitle="Download reports as CSV files">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Export Settings
            </CardTitle>
            <CardDescription>Configure your export preferences</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="space-y-2">
                <Label>Date Range</Label>
                <Select value={dateRange} onValueChange={(value: DateRange) => setDateRange(value)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7days">Last 7 days</SelectItem>
                    <SelectItem value="30days">Last 30 days</SelectItem>
                    <SelectItem value="90days">Last 90 days</SelectItem>
                    <SelectItem value="all">All time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {exports.map((exportItem) => (
            <Card key={exportItem.type} className="flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <exportItem.icon className="h-5 w-5 text-primary" />
                  {exportItem.title}
                </CardTitle>
                <CardDescription>{exportItem.description}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto">
                <Button
                  onClick={exportItem.action}
                  disabled={exporting !== null}
                  className="w-full"
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
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminExports;
