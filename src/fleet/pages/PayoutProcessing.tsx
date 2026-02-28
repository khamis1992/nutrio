import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  ArrowLeft,
  Calculator,
  CreditCard,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { useDrivers } from "@/fleet/hooks/useDrivers";
import { toast } from "@/hooks/use-toast";

// Mock driver data for calculation
const mockDriverEarnings = [
  { driverId: "1", driverName: "Ahmed M.", deliveries: 45, baseEarnings: 1125, rating: 4.8 },
  { driverId: "2", driverName: "Mohammed S.", deliveries: 38, baseEarnings: 950, rating: 4.9 },
  { driverId: "3", driverName: "Khalid A.", deliveries: 32, baseEarnings: 800, rating: 4.5 },
];

export default function PayoutProcessing() {
  const navigate = useNavigate();
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [processing, setProcessing] = useState(false);
  
  const { drivers } = useDrivers({});

  const toggleDriver = (driverId: string) => {
    setSelectedDrivers(prev => 
      prev.includes(driverId) 
        ? prev.filter(id => id !== driverId)
        : [...prev, driverId]
    );
  };

  const calculateEarnings = (driverId: string) => {
    const mock = mockDriverEarnings.find(m => m.driverId === driverId);
    if (!mock) return { base: 0, bonus: 0, penalty: 0, total: 0 };
    
    const bonus = mock.rating >= 4.8 ? mock.baseEarnings * 0.1 : 0;
    return {
      base: mock.baseEarnings,
      bonus: Math.round(bonus),
      penalty: 0,
      total: mock.baseEarnings + Math.round(bonus)
    };
  };

  const totalAmount = selectedDrivers.reduce((acc, driverId) => {
    return acc + calculateEarnings(driverId).total;
  }, 0);

  const handleProcess = async () => {
    if (selectedDrivers.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one driver",
        variant: "destructive",
      });
      return;
    }

    if (!periodStart || !periodEnd) {
      toast({
        title: "Error",
        description: "Please select a period",
        variant: "destructive",
      });
      return;
    }

    setShowConfirmation(true);
  };

  const confirmPayout = async () => {
    setProcessing(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    toast({
      title: "Success",
      description: `Processed payouts for ${selectedDrivers.length} drivers (QAR ${totalAmount.toLocaleString()})`,
    });
    
    setProcessing(false);
    navigate("/fleet/payouts");
  };

  if (showConfirmation) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => setShowConfirmation(false)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">Confirm Payouts</h1>
        </div>

        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <p className="font-medium text-amber-900">Please Review Carefully</p>
              <p className="text-sm text-amber-700">
                You are about to process payouts for {selectedDrivers.length} drivers. 
                This action cannot be undone.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payout Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Period</p>
                <p className="font-medium">{periodStart} to {periodEnd}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Drivers</p>
                <p className="font-medium">{selectedDrivers.length}</p>
              </div>
            </div>

            <div className="space-y-2">
              {selectedDrivers.map(driverId => {
                const driver = drivers.find(d => d.id === driverId);
                const earnings = calculateEarnings(driverId);
                return (
                  <div key={driverId} className="flex items-center justify-between p-3 border rounded-lg">
                    <span className="font-medium">{driver?.fullName || driverId}</span>
                    <span className="font-semibold">QAR {earnings.total.toLocaleString()}</span>
                  </div>
                );
              })}
            </div>

            <div className="pt-4 border-t">
              <div className="flex items-center justify-between text-lg font-bold">
                <span>Total Payout Amount</span>
                <span>QAR {totalAmount.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <Button 
                variant="outline" 
                className="flex-1" 
                onClick={() => setShowConfirmation(false)}
                disabled={processing}
              >
                Cancel
              </Button>
              <Button 
                className="flex-1" 
                onClick={confirmPayout}
                disabled={processing}
              >
                {processing ? (
                  <>
                    <div className="animate-spin mr-2 h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4 mr-2" />
                    Confirm & Process
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate("/fleet/payouts")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Process Payouts</h1>
          <p className="text-muted-foreground">Calculate and process driver payouts</p>
        </div>
      </div>

      {/* Period Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Payout Period
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="period-start">Start Date</Label>
              <Input
                id="period-start"
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="period-end">End Date</Label>
              <Input
                id="period-end"
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Driver Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Select Drivers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {drivers.map((driver) => {
              const earnings = calculateEarnings(driver.id);
              const isSelected = selectedDrivers.includes(driver.id);
              
              return (
                <div 
                  key={driver.id} 
                  className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors ${
                    isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                  }`}
                  onClick={() => toggleDriver(driver.id)}
                >
                  <div className="flex items-center gap-4">
                    <Checkbox checked={isSelected} />
                    <div>
                      <p className="font-medium">{driver.fullName}</p>
                      <p className="text-sm text-muted-foreground">{driver.phone}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {isSelected ? (
                      <div className="text-sm">
                        <p>Base: QAR {earnings.base}</p>
                        {earnings.bonus > 0 && <p className="text-green-600">Bonus: +QAR {earnings.bonus}</p>}
                        <p className="font-semibold">Total: QAR {earnings.total}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Click to calculate</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {drivers.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No drivers available</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary */}
      {selectedDrivers.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground">Selected Drivers</p>
                <p className="text-2xl font-bold">{selectedDrivers.length}</p>
              </div>
              <div className="text-right">
                <p className="text-muted-foreground">Total Payout</p>
                <p className="text-2xl font-bold">QAR {totalAmount.toLocaleString()}</p>
              </div>
            </div>
            <Button className="w-full mt-4" onClick={handleProcess}>
              <CreditCard className="h-4 w-4 mr-2" />
              Review & Process
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
