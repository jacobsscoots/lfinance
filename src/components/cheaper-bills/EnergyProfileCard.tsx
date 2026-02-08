import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
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
import { User, Home, Thermometer, Zap, ChevronDown, Loader2, Save, Lightbulb } from "lucide-react";
import { format } from "date-fns";

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
};

export function EnergyProfileCard() {
  const { profile, isLoading, updateProfile, isUpdating } = useEnergyProfile();
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<EnergyProfile>>(DEFAULT_FORM_DATA);

  // Sync form data when profile loads
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

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-2">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                Personalise AI Tips
              </CardTitle>
              <div className="flex items-center gap-2">
                {profile?.updated_at && (
                  <span className="text-xs text-muted-foreground">
                    Updated {format(new Date(profile.updated_at), "d MMM")}
                  </span>
                )}
                <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </div>
            </Button>
          </CollapsibleTrigger>
          {!isOpen && (
            <p className="text-xs text-muted-foreground mt-1">
              Tell us what you already do so we can give smarter recommendations
            </p>
          )}
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-6 pt-4">
            {/* Appliance habits */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Things I Already Do
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={formData.eco_mode_dishwasher}
                    onCheckedChange={(c) => updateField('eco_mode_dishwasher', !!c)}
                  />
                  Use dishwasher eco mode
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={formData.eco_mode_washer}
                    onCheckedChange={(c) => updateField('eco_mode_washer', !!c)}
                  />
                  Use washing machine eco mode
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={formData.low_temp_washing}
                    onCheckedChange={(c) => updateField('low_temp_washing', !!c)}
                  />
                  Wash at 30°C
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={formData.tumble_dryer_rare}
                    onCheckedChange={(c) => updateField('tumble_dryer_rare', !!c)}
                  />
                  Rarely use tumble dryer
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={formData.peak_time_avoidance}
                    onCheckedChange={(c) => updateField('peak_time_avoidance', !!c)}
                  />
                  Run appliances off-peak
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={formData.smart_thermostat}
                    onCheckedChange={(c) => updateField('smart_thermostat', !!c)}
                  />
                  Have smart thermostat
                </label>
              </div>
            </div>

            {/* Home details */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Home className="h-4 w-4" />
                About Your Home
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Home Type</Label>
                  <Select
                    value={formData.home_type || ''}
                    onValueChange={(v) => updateField('home_type', v || null)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="flat">Flat</SelectItem>
                      <SelectItem value="terrace">Terrace</SelectItem>
                      <SelectItem value="semi">Semi-detached</SelectItem>
                      <SelectItem value="detached">Detached</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
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
                    onChange={(e) => updateField('occupants', parseInt(e.target.value) || 1)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">WFH Days/Week</Label>
                  <Input
                    type="number"
                    min={0}
                    max={7}
                    value={formData.work_from_home_days || 0}
                    onChange={(e) => updateField('work_from_home_days', parseInt(e.target.value) || 0)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Heating</Label>
                  <Select
                    value={formData.heating_type || ''}
                    onValueChange={(v) => updateField('heating_type', v || null)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gas_boiler">Gas Boiler</SelectItem>
                      <SelectItem value="heat_pump">Heat Pump</SelectItem>
                      <SelectItem value="electric_heaters">Electric Heaters</SelectItem>
                      <SelectItem value="storage_heaters">Storage Heaters</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Energy setup */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Thermometer className="h-4 w-4" />
                Energy Setup
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={formData.smart_meter}
                    onCheckedChange={(c) => updateField('smart_meter', !!c)}
                  />
                  Smart Meter
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={formData.has_ev}
                    onCheckedChange={(c) => updateField('has_ev', !!c)}
                  />
                  Electric Vehicle
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={formData.has_solar}
                    onCheckedChange={(c) => updateField('has_solar', !!c)}
                  />
                  Solar Panels
                </label>
                <div className="space-y-1">
                  <Label className="text-xs">Tariff Type</Label>
                  <Select
                    value={formData.tariff_type || ''}
                    onValueChange={(v) => updateField('tariff_type', v || null)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
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

            {/* Usage details */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <User className="h-4 w-4" />
                Usage Details (optional)
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Avg Shower (mins)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    placeholder="e.g. 8"
                    value={formData.shower_minutes_avg || ''}
                    onChange={(e) => updateField('shower_minutes_avg', e.target.value ? parseInt(e.target.value) : null)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Thermostat °C</Label>
                  <Input
                    type="number"
                    min={10}
                    max={30}
                    step={0.5}
                    placeholder="e.g. 20"
                    value={formData.thermostat_temp_c || ''}
                    onChange={(e) => updateField('thermostat_temp_c', e.target.value ? parseFloat(e.target.value) : null)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Washes/Week</Label>
                  <Input
                    type="number"
                    min={0}
                    max={20}
                    value={formData.washer_runs_per_week || 0}
                    onChange={(e) => updateField('washer_runs_per_week', parseInt(e.target.value) || 0)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Dryer/Week</Label>
                  <Input
                    type="number"
                    min={0}
                    max={20}
                    value={formData.dryer_runs_per_week || 0}
                    onChange={(e) => updateField('dryer_runs_per_week', parseInt(e.target.value) || 0)}
                    className="h-9"
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label className="text-xs">Other notes (optional)</Label>
              <Textarea
                placeholder="Anything else that affects your energy use..."
                value={formData.notes || ''}
                onChange={(e) => updateField('notes', e.target.value || null)}
                className="h-20 text-sm"
              />
            </div>

            {/* Save button */}
            <div className="flex items-center justify-between pt-2 border-t">
              <p className="text-xs text-muted-foreground">
                This helps the AI give you relevant, non-repetitive tips
              </p>
              <Button 
                onClick={handleSave} 
                disabled={isUpdating || !hasChanges}
                size="sm"
              >
                {isUpdating ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                Save Profile
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
