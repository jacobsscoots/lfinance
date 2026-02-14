import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useEnergyProfile, EnergyProfile } from "@/hooks/useEnergyProfile";
import { Home, Thermometer, Zap, ChevronDown, Loader2, Save, AlertTriangle, CheckCircle, Building } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const DEFAULT_FORM_DATA: Partial<EnergyProfile> = {
  eco_mode_dishwasher: false,
  eco_mode_washer: false,
  low_temp_washing: false,
  tumble_dryer_rare: false,
  dishwasher_runs_per_week: 0,
  washer_runs_per_week: 0,
  dryer_runs_per_week: 0,
  smart_thermostat: false,
  occupants: 1,
  work_from_home_days: 0,
  smart_meter: false,
  has_ev: false,
  has_solar: false,
  peak_time_avoidance: false,
  home_type: null,
  heating_type: null,
  tariff_type: null,
  thermostat_temp_c: null,
  shower_minutes_avg: null,
  notes: null,
  ownership_type: null,
  boiler_type: null,
  hot_water_type: null,
  has_electric_boiler: false,
  has_heat_pump: false,
  insulation_level: null,
  epc_rating: null,
  property_age: null,
};

/** Fields that affect tariff eligibility — used to show completion status */
const ELIGIBILITY_FIELDS: (keyof EnergyProfile)[] = [
  "ownership_type",
  "home_type",
  "heating_type",
  "boiler_type",
  "has_heat_pump",
  "has_electric_boiler",
];

export function EnergyProfileCard() {
  const { profile, isLoading, updateProfile, isUpdating } = useEnergyProfile();
  const [moreOpen, setMoreOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<EnergyProfile>>(DEFAULT_FORM_DATA);

  useEffect(() => {
    if (profile && !isLoading) {
      setFormData(profile);
    }
  }, [profile, isLoading]);

  const handleSave = () => {
    updateProfile(formData);
  };

  const updateField = <K extends keyof EnergyProfile>(key: K, value: EnergyProfile[K]) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const hasChanges = JSON.stringify(formData) !== JSON.stringify(profile);

  // Calculate completion of eligibility fields
  const filledEligibility = ELIGIBILITY_FIELDS.filter(
    (f) => formData[f] !== null && formData[f] !== undefined && formData[f] !== ""
  ).length;
  const profileComplete = filledEligibility === ELIGIBILITY_FIELDS.length;

  // Tariff eligibility warnings
  const warnings: string[] = [];
  if (!formData.has_heat_pump && !formData.has_electric_boiler) {
    warnings.push("Cosy Octopus requires a heat pump or electric boiler");
  }
  if (formData.ownership_type === "renter") {
    warnings.push("As a renter, you may need landlord approval for tariff changes or equipment");
  }

  return (
    <Card className={cn(!profileComplete && "border-warning/50")}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Building className="h-4 w-4 text-primary" />
            Your Home & Eligibility
          </CardTitle>
          <div className="flex items-center gap-2">
            {profileComplete ? (
              <Badge variant="outline" className="text-xs border-success/50 text-success gap-1">
                <CheckCircle className="h-3 w-3" />
                Complete
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs border-warning/50 text-warning gap-1">
                <AlertTriangle className="h-3 w-3" />
                {filledEligibility}/{ELIGIBILITY_FIELDS.length} fields
              </Badge>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Fill this in so we only recommend tariffs you actually qualify for
        </p>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Tariff eligibility warnings */}
        {warnings.length > 0 && formData.heating_type && (
          <div className="space-y-2">
            {warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2 text-xs p-2.5 rounded-md bg-warning/10 text-warning border border-warning/20">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}

        {/* Property basics — always visible */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Home className="h-4 w-4" />
            Property Details
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">I am a…</Label>
              <Select
                value={formData.ownership_type || "none"}
                onValueChange={(v) => updateField("ownership_type", v === "none" ? null : v)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select…</SelectItem>
                  <SelectItem value="owner">Homeowner</SelectItem>
                  <SelectItem value="renter">Renter</SelectItem>
                  <SelectItem value="shared_ownership">Shared Ownership</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Home Type</Label>
              <Select
                value={formData.home_type || "none"}
                onValueChange={(v) => updateField("home_type", v === "none" ? null : v)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select…</SelectItem>
                  <SelectItem value="flat">Flat</SelectItem>
                  <SelectItem value="terrace">Terrace</SelectItem>
                  <SelectItem value="semi">Semi-detached</SelectItem>
                  <SelectItem value="detached">Detached</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Property Age</Label>
              <Select
                value={formData.property_age || "none"}
                onValueChange={(v) => updateField("property_age", v === "none" ? null : v)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select…</SelectItem>
                  <SelectItem value="pre_1930">Pre 1930</SelectItem>
                  <SelectItem value="1930_1965">1930–1965</SelectItem>
                  <SelectItem value="1966_1995">1966–1995</SelectItem>
                  <SelectItem value="post_1995">Post 1995</SelectItem>
                  <SelectItem value="new_build">New Build</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Occupants</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={formData.occupants || 1}
                onChange={(e) => updateField("occupants", parseInt(e.target.value) || 1)}
                className="h-9"
              />
            </div>
          </div>
        </div>

        {/* Heating & Equipment — critical for eligibility */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Thermometer className="h-4 w-4" />
            Heating & Equipment
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Heating System</Label>
              <Select
                value={formData.heating_type || "none"}
                onValueChange={(v) => updateField("heating_type", v === "none" ? null : v)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select…</SelectItem>
                  <SelectItem value="gas_boiler">Gas Boiler</SelectItem>
                  <SelectItem value="heat_pump">Heat Pump</SelectItem>
                  <SelectItem value="electric_heaters">Electric Heaters</SelectItem>
                  <SelectItem value="storage_heaters">Storage Heaters</SelectItem>
                  <SelectItem value="district_heating">District Heating</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Boiler Type</Label>
              <Select
                value={formData.boiler_type || "none"}
                onValueChange={(v) => updateField("boiler_type", v === "none" ? null : v)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select…</SelectItem>
                  <SelectItem value="gas_combi">Gas Combi</SelectItem>
                  <SelectItem value="gas_system">Gas System</SelectItem>
                  <SelectItem value="gas_regular">Gas Regular</SelectItem>
                  <SelectItem value="electric">Electric</SelectItem>
                  <SelectItem value="oil">Oil</SelectItem>
                  <SelectItem value="lpg">LPG</SelectItem>
                  <SelectItem value="no_boiler">No Boiler</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hot Water</Label>
              <Select
                value={formData.hot_water_type || "none"}
                onValueChange={(v) => updateField("hot_water_type", v === "none" ? null : v)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select…</SelectItem>
                  <SelectItem value="boiler">From Boiler</SelectItem>
                  <SelectItem value="immersion">Immersion Heater</SelectItem>
                  <SelectItem value="heat_pump">Heat Pump</SelectItem>
                  <SelectItem value="solar_thermal">Solar Thermal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">EPC Rating</Label>
              <Select
                value={formData.epc_rating || "none"}
                onValueChange={(v) => updateField("epc_rating", v === "none" ? null : v)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Don't know</SelectItem>
                  <SelectItem value="A">A</SelectItem>
                  <SelectItem value="B">B</SelectItem>
                  <SelectItem value="C">C</SelectItem>
                  <SelectItem value="D">D</SelectItem>
                  <SelectItem value="E">E</SelectItem>
                  <SelectItem value="F">F</SelectItem>
                  <SelectItem value="G">G</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Key equipment checkboxes */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={formData.has_heat_pump}
                onCheckedChange={(c) => {
                  updateField("has_heat_pump", !!c);
                  if (c) updateField("heating_type", "heat_pump");
                }}
              />
              Heat Pump
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={formData.has_electric_boiler}
                onCheckedChange={(c) => {
                  updateField("has_electric_boiler", !!c);
                  if (c) updateField("boiler_type", "electric");
                }}
              />
              Electric Boiler
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={formData.has_solar}
                onCheckedChange={(c) => updateField("has_solar", !!c)}
              />
              Solar Panels
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={formData.has_ev}
                onCheckedChange={(c) => updateField("has_ev", !!c)}
              />
              Electric Vehicle
            </label>
          </div>
        </div>

        {/* More details — collapsible */}
        <Collapsible open={moreOpen} onOpenChange={setMoreOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between text-xs text-muted-foreground">
              More details (habits, usage, insulation)
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", moreOpen && "rotate-180")} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-5 pt-3">
            {/* Energy setup */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Energy Setup
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={formData.smart_meter}
                    onCheckedChange={(c) => updateField("smart_meter", !!c)}
                  />
                  Smart Meter
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={formData.smart_thermostat}
                    onCheckedChange={(c) => updateField("smart_thermostat", !!c)}
                  />
                  Smart Thermostat
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={formData.peak_time_avoidance}
                    onCheckedChange={(c) => updateField("peak_time_avoidance", !!c)}
                  />
                  Off-peak usage
                </label>
                <div className="space-y-1">
                  <Label className="text-xs">Tariff Type</Label>
                  <Select
                    value={formData.tariff_type || "none"}
                    onValueChange={(v) => updateField("tariff_type", v === "none" ? null : v)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select…</SelectItem>
                      <SelectItem value="variable">Variable</SelectItem>
                      <SelectItem value="fixed">Fixed</SelectItem>
                      <SelectItem value="economy7">Economy 7</SelectItem>
                      <SelectItem value="agile">Agile/Smart</SelectItem>
                      <SelectItem value="ev">EV Tariff</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Habits */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Appliance Habits</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={formData.eco_mode_dishwasher}
                    onCheckedChange={(c) => updateField("eco_mode_dishwasher", !!c)}
                  />
                  Dishwasher eco mode
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={formData.eco_mode_washer}
                    onCheckedChange={(c) => updateField("eco_mode_washer", !!c)}
                  />
                  Washing machine eco mode
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={formData.low_temp_washing}
                    onCheckedChange={(c) => updateField("low_temp_washing", !!c)}
                  />
                  Wash at 30°C
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={formData.tumble_dryer_rare}
                    onCheckedChange={(c) => updateField("tumble_dryer_rare", !!c)}
                  />
                  Rarely use tumble dryer
                </label>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">WFH Days/Week</Label>
                  <Input
                    type="number" min={0} max={7}
                    value={formData.work_from_home_days || 0}
                    onChange={(e) => updateField("work_from_home_days", parseInt(e.target.value) || 0)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Avg Shower (mins)</Label>
                  <Input
                    type="number" min={1} max={30} placeholder="e.g. 8"
                    value={formData.shower_minutes_avg || ""}
                    onChange={(e) => updateField("shower_minutes_avg", e.target.value ? parseInt(e.target.value) : null)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Thermostat °C</Label>
                  <Input
                    type="number" min={10} max={30} step={0.5} placeholder="e.g. 20"
                    value={formData.thermostat_temp_c || ""}
                    onChange={(e) => updateField("thermostat_temp_c", e.target.value ? parseFloat(e.target.value) : null)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Insulation</Label>
                  <Select
                    value={formData.insulation_level || "none"}
                    onValueChange={(v) => updateField("insulation_level", v === "none" ? null : v)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Don't know</SelectItem>
                      <SelectItem value="poor">Poor</SelectItem>
                      <SelectItem value="average">Average</SelectItem>
                      <SelectItem value="good">Good</SelectItem>
                      <SelectItem value="excellent">Excellent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label className="text-xs">Other notes (optional)</Label>
              <Textarea
                placeholder="Anything else that affects your energy use or tariff eligibility…"
                value={formData.notes || ""}
                onChange={(e) => updateField("notes", e.target.value || null)}
                className="h-20 text-sm"
              />
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Save */}
        <div className="flex items-center justify-between pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            We'll use this to filter tariffs you qualify for
          </p>
          <Button onClick={handleSave} disabled={isUpdating || !hasChanges} size="sm">
            {isUpdating ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            Save Profile
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
