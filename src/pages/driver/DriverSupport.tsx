import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MessageCircle,
  Send,
  HelpCircle,
  FileText,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";


const categories = [
  { value: "delivery_issue", label: "Delivery Issue" },
  { value: "payment", label: "Payment & Earnings" },
  { value: "app_bug", label: "App Bug" },
  { value: "account", label: "Account Issue" },
  { value: "other", label: "Other" },
];

export default function DriverSupport() {
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    category: "",
    subject: "",
    message: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.category || !formData.subject || !formData.message) {
      toast({
        title: "Please fill all fields",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Ticket submitted!",
      description: "We'll get back to you as soon as possible.",
    });

    setFormData({ category: "", subject: "", message: "" });
  };

  return (
    <div className="p-4 space-y-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <HelpCircle className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium">Need help?</p>
                <p className="text-sm text-muted-foreground">
                  Submit a ticket and we'll assist you
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              Submit a Ticket
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  placeholder="Brief description of your issue"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  placeholder="Describe your issue in detail..."
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  rows={5}
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-green-600 hover:bg-green-700"
              >
                <Send className="mr-2 h-4 w-4" />
                Submit Ticket
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Quick Help</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Delivery Guide</p>
                <p className="text-xs text-muted-foreground">
                  Learn how to complete deliveries
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Troubleshooting</p>
                <p className="text-xs text-muted-foreground">
                  Common issues and solutions
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Response Time</p>
                <p className="text-xs text-muted-foreground">
                  We typically respond within 24 hours
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
    </div>
  );
}
