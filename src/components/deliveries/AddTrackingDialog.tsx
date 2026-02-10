import { useState } from "react";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useShipments } from "@/hooks/useShipments";
import { useOnlineOrders } from "@/hooks/useOnlineOrders";

const UK_CARRIERS = [
  { value: "", label: "Auto-detect" },
  { value: "royal-mail", label: "Royal Mail" },
  { value: "evri", label: "Evri" },
  { value: "dpd", label: "DPD" },
  { value: "dhl", label: "DHL" },
  { value: "yodel", label: "Yodel" },
  { value: "ups", label: "UPS" },
  { value: "fedex", label: "FedEx" },
  { value: "amazon", label: "Amazon Logistics" },
  { value: "parcelforce", label: "Parcelforce" },
];

export function AddTrackingDialog() {
  const [open, setOpen] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrierCode, setCarrierCode] = useState("");
  const [orderId, setOrderId] = useState("");
  const { registerTracking } = useShipments();
  const { orders } = useOnlineOrders();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackingNumber.trim()) return;
    registerTracking.mutate(
      {
        tracking_number: trackingNumber.trim(),
        carrier_code: carrierCode && carrierCode !== "auto" ? carrierCode : undefined,
        order_id: orderId && orderId !== "none" ? orderId : undefined,
      },
      { onSuccess: () => { setOpen(false); setTrackingNumber(""); setCarrierCode(""); setOrderId(""); } }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1">
          <Plus className="h-4 w-4" /> Add Tracking
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Tracking Number</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="tracking">Tracking Number</Label>
            <Input
              id="tracking"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="e.g. AB123456789GB"
              required
            />
          </div>
          <div>
            <Label htmlFor="carrier">Carrier</Label>
            <Select value={carrierCode} onValueChange={setCarrierCode}>
              <SelectTrigger>
                <SelectValue placeholder="Auto-detect" />
              </SelectTrigger>
              <SelectContent>
                {UK_CARRIERS.map((c) => (
                  <SelectItem key={c.value || "auto"} value={c.value || "auto"}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {orders.length > 0 && (
            <div>
              <Label htmlFor="order">Link to Order (optional)</Label>
              <Select value={orderId} onValueChange={setOrderId}>
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {orders.slice(0, 20).map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.retailer_name} {o.order_number ? `#${o.order_number}` : ""} — {o.order_date}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button type="submit" className="w-full" disabled={registerTracking.isPending}>
            {registerTracking.isPending ? "Registering…" : "Track Parcel"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
