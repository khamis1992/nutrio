import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Receipt, 
  Download, 
  Mail, 
  CheckCircle, 
  XCircle,
  Clock,
  Wallet,
  Crown,
  Truck,
  User
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { downloadInvoice } from "@/services/walletService";
import { CustomerNavigation } from "@/components/CustomerNavigation";
import { formatCurrency } from "@/lib/currency";
import { format } from "date-fns";

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_type: 'wallet_topup' | 'subscription' | 'order' | 'partner_payout' | 'driver_payout';
  amount: number;
  tax_amount: number;
  total_amount: number;
  status: 'draft' | 'sent' | 'paid' | 'cancelled';
  paid_at: string | null;
  created_at: string;
  pdf_url: string | null;
}

const invoiceTypeConfig: Record<string, { icon: typeof Receipt; color: string; label: string }> = {
  'wallet_topup': { icon: Wallet, color: 'text-green-600', label: 'Wallet Top-up' },
  'subscription': { icon: Crown, color: 'text-purple-600', label: 'Subscription' },
  'order': { icon: Truck, color: 'text-blue-600', label: 'Order' },
  'partner_payout': { icon: User, color: 'text-amber-600', label: 'Partner Payout' },
  'driver_payout': { icon: User, color: 'text-amber-600', label: 'Driver Payout' },
};

export default function InvoiceHistory() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchInvoices();
    }
  }, [user]);

  const fetchInvoices = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      const { data, error } = await (supabase as any)
        .from('invoices')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      setInvoices(data || []);
    } catch (error: any) {
      console.error('Error fetching invoices:', error);
      toast({
        title: "Error",
        description: "Failed to load invoices",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (invoiceId: string) => {
    try {
      setDownloading(invoiceId);
      await downloadInvoice(invoiceId);
    } catch (error: any) {
      console.error('Download failed:', error);
      toast({
        title: "Download Failed",
        description: error.message || "Could not download invoice",
        variant: "destructive",
      });
    } finally {
      setDownloading(null);
    }
  };

  const handleResend = async (invoiceId: string) => {
    // This would call the Supabase Edge Function
    toast({
      title: "Feature Coming Soon",
      description: "Email resend will be available soon",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <CustomerNavigation />
        <main className="container max-w-md mx-auto px-4 py-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">Invoice History</h1>
              <Receipt className="h-6 w-6 text-muted-foreground" />
            </div>

            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-4">
                    <div className="h-4 bg-muted rounded w-32 mb-2" />
                    <div className="h-3 bg-muted rounded w-24" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <CustomerNavigation />
      
      <main className="container max-w-md mx-auto px-4 py-6 pb-24">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Invoice History</h1>
            <p className="text-muted-foreground">All your invoices in one place</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
            <Receipt className="h-6 w-6 text-blue-600" />
          </div>
        </div>

        {invoices.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Receipt className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-muted-foreground">No invoices yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your invoices will appear here after you make purchases
              </p>
            </CardContent>
          </Card>
        ) : (
          <ScrollArea className="h-[600px]">
            <div className="space-y-3">
              {invoices.map((invoice) => {
                const config = invoiceTypeConfig[invoice.invoice_type] || invoiceTypeConfig.wallet_topup;
                const Icon = config.icon;
                const statusConfig = {
                  'paid': { color: 'bg-green-100 text-green-800', icon: CheckCircle },
                  'sent': { color: 'bg-blue-100 text-blue-800', icon: Mail },
                  'draft': { color: 'bg-amber-100 text-amber-800', icon: Clock },
                  'cancelled': { color: 'bg-red-100 text-red-800', icon: XCircle },
                };
                const status = statusConfig[invoice.status as keyof typeof statusConfig] || statusConfig.draft;
                const StatusIcon = status.icon;

                return (
                  <Card key={invoice.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full ${config.color}/10 flex items-center justify-center`}>
                          <Icon className={`h-5 w-5 ${config.color}`} />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="font-semibold truncate">
                              {config.label}
                            </p>
                            <Badge className={status.color}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {invoice.status}
                            </Badge>
                          </div>
                          
                          <p className="text-sm text-muted-foreground">
                            {invoice.invoice_number}
                          </p>
                          
                          <p className="text-sm mt-1">
                            {format(new Date(invoice.created_at), 'dd MMM yyyy')}
                            {invoice.paid_at && invoice.status === 'paid' && (
                              <span className="text-muted-foreground ml-2">
                                • Paid {format(new Date(invoice.paid_at), 'dd MMM')}
                              </span>
                            )}
                          </p>
                        </div>
                        
                        <div className="text-right">
                          <p className="font-bold text-lg">
                            {formatCurrency(invoice.total_amount)}
                          </p>
                          <div className="flex gap-1 mt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDownload(invoice.id)}
                              disabled={downloading === invoice.id}
                            >
                              <Download className="h-3 w-3 mr-1" />
                              {downloading === invoice.id ? 'Downloading...' : 'PDF'}
                            </Button>
                            {invoice.status === 'paid' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleResend(invoice.id)}
                              >
                                <Mail className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </main>
    </div>
  );
}