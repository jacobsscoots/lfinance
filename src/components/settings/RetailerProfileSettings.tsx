import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Save, Truck } from "lucide-react";
import {
  useRetailerProfiles,
  type RetailerProfile,
} from "@/hooks/useRetailerProfiles";

export function RetailerProfileSettings() {
  const { profiles, isLoading, upsertProfile, deleteProfile } =
    useRetailerProfiles();
  const [newName, setNewName] = useState("");

  const handleAddRetailer = () => {
    if (!newName.trim()) return;
    upsertProfile.mutate({ retailer_name: newName.trim() });
    setNewName("");
  };

  const handleUpdate = (profile: RetailerProfile, field: string, value: any) => {
    upsertProfile.mutate({
      ...profile,
      [field]: value,
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading…
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Retailer Shipping Profiles
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Configure estimated dispatch and delivery times for each retailer.
          These are used to calculate "Order by" dates.
        </p>

        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Retailer</TableHead>
                <TableHead>Dispatch (days)</TableHead>
                <TableHead>Delivery (days)</TableHead>
                <TableHead>Weekends?</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium text-sm">
                    {p.retailer_name}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-xs">
                      <Input
                        type="number"
                        min={0}
                        className="h-7 w-14"
                        value={p.dispatch_days_min}
                        onChange={(e) =>
                          handleUpdate(p, "dispatch_days_min", parseInt(e.target.value) || 0)
                        }
                      />
                      <span>–</span>
                      <Input
                        type="number"
                        min={0}
                        className="h-7 w-14"
                        value={p.dispatch_days_max}
                        onChange={(e) =>
                          handleUpdate(p, "dispatch_days_max", parseInt(e.target.value) || 0)
                        }
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-xs">
                      <Input
                        type="number"
                        min={0}
                        className="h-7 w-14"
                        value={p.delivery_days_min}
                        onChange={(e) =>
                          handleUpdate(p, "delivery_days_min", parseInt(e.target.value) || 0)
                        }
                      />
                      <span>–</span>
                      <Input
                        type="number"
                        min={0}
                        className="h-7 w-14"
                        value={p.delivery_days_max}
                        onChange={(e) =>
                          handleUpdate(p, "delivery_days_max", parseInt(e.target.value) || 0)
                        }
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1">
                        <Switch
                          checked={p.dispatches_weekends}
                          onCheckedChange={(v) =>
                            handleUpdate(p, "dispatches_weekends", v)
                          }
                          className="scale-75"
                        />
                        <span className="text-xs">D</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Switch
                          checked={p.delivers_weekends}
                          onCheckedChange={(v) =>
                            handleUpdate(p, "delivers_weekends", v)
                          }
                          className="scale-75"
                        />
                        <span className="text-xs">Del</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => deleteProfile.mutate(p.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="New retailer name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="max-w-xs"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddRetailer}
            disabled={!newName.trim()}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
