import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useActiveUser } from "@/contexts/ActiveUserContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import CheckInPreferences from "./CheckInPreferences";
import { usePreferences } from "@/contexts/PreferencesContext";
import { Trash2 } from "lucide-react";
import { toast as sonnerToast } from "sonner";
import { debug, info, warn, error } from '@/utils/logging'; // Import logging utility


interface CustomCategory {
  id: string;
  name: string;
  measurement_type: string;
  frequency: string;
}

interface CustomMeasurement {
  id: string;
  category_id: string;
  value: number;
  entry_date: string;
  entry_hour: number | null;
  entry_timestamp: string;
  custom_categories: {
    name: string;
    measurement_type: string;
    frequency: string;
  };
}

const CheckIn = () => {
  const { user } = useAuth();
  const { activeUserId } = useActiveUser();
  const {
    weightUnit,
    measurementUnit,
    loadPreferences,
    setWeightUnit: updateWeightUnit,
    setMeasurementUnit: updateMeasurementUnit,
    loggingLevel // Get logging level
  } = usePreferences();
  debug(loggingLevel, "CheckIn component rendered.");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [weight, setWeight] = useState("");
  const [neck, setNeck] = useState("");
  const [waist, setWaist] = useState("");
  const [hips, setHips] = useState("");
  const [steps, setSteps] = useState("");
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [customValues, setCustomValues] = useState<{[key: string]: string}>({});
  const [loading, setLoading] = useState(false);
  const [recentMeasurements, setRecentMeasurements] = useState<CustomMeasurement[]>([]);

  const currentUserId = activeUserId || user?.id;
  debug(loggingLevel, "Current user ID:", currentUserId);

  useEffect(() => {
    debug(loggingLevel, "currentUserId or selectedDate useEffect triggered.", { currentUserId, selectedDate });
    if (currentUserId) {
      loadExistingData();
      loadPreferences();
      loadCustomCategories();
      fetchRecentMeasurements();
    }
  }, [currentUserId, selectedDate]);

  const loadCustomCategories = async () => {
    debug(loggingLevel, "Loading custom categories.");
    if (!currentUserId) {
      warn(loggingLevel, "loadCustomCategories called with no current user ID.");
      return;
    }

    try {
      const { data, error: supabaseError } = await supabase
        .from('custom_categories')
        .select('*')
        .eq('user_id', currentUserId)
        .order('created_at');

      if (supabaseError) {
        error(loggingLevel, 'Error loading custom categories:', supabaseError);
        throw supabaseError; // Re-throw to be caught by the outer catch
      }
      info(loggingLevel, "Custom categories loaded successfully:", data);
      setCustomCategories(data || []);
    } catch (err) {
      error(loggingLevel, 'Error loading custom categories:', err);
    }
  };

  const fetchRecentMeasurements = async () => {
    debug(loggingLevel, "Fetching recent measurements.");
    if (!currentUserId) {
      warn(loggingLevel, "fetchRecentMeasurements called with no current user ID.");
      return;
    }


    const { data, error: supabaseError } = await supabase
      .from('custom_measurements')
      .select(`
        id,
        category_id,
        value,
        entry_date,
        entry_hour,
        entry_timestamp,
        custom_categories (
          name,
          measurement_type,
          frequency
        )
      `)
      .eq('user_id', currentUserId)
      .gt('value', 0)  // Only get non-zero values
      .order('entry_timestamp', { ascending: false })
      .limit(20);  // Limit to 20 recent measurements

    if (supabaseError) {
      error(loggingLevel, 'Error fetching recent measurements:', supabaseError);
      sonnerToast.error('Failed to load recent measurements');
    } else {
      info(loggingLevel, "Recent measurements fetched successfully:", data);
      setRecentMeasurements(data || []);
    }
  };

  const handleDeleteMeasurement = async (measurementId: string) => {
    debug(loggingLevel, "Handling delete measurement:", measurementId);
    if (!currentUserId) {
      warn(loggingLevel, "handleDeleteMeasurement called with no current user ID.");
      return;
    }

    const { error: supabaseError } = await supabase
      .from('custom_measurements')
      .delete()
      .eq('id', measurementId)
      .eq('user_id', currentUserId);

    if (supabaseError) {
      error(loggingLevel, 'Error deleting measurement:', supabaseError);
      sonnerToast.error('Failed to delete measurement');
    } else {
      info(loggingLevel, 'Measurement deleted successfully:', measurementId);
      sonnerToast.success('Measurement deleted successfully');
      fetchRecentMeasurements();
      loadExistingData(); // Reload today's values
    }
  };

  const loadExistingData = async () => {
    debug(loggingLevel, "Loading existing data for date:", selectedDate);
    try {
      // Load check-in measurements
      const { data, error: supabaseError } = await supabase
        .from('check_in_measurements')
        .select('*')
        .eq('user_id', currentUserId)
        .eq('entry_date', selectedDate)
        .maybeSingle();

      if (supabaseError && supabaseError.code !== 'PGRST116') {
        error(loggingLevel, 'Error loading check-in data:', supabaseError);
        return;
      }

      if (data) {
        info(loggingLevel, "Existing check-in data loaded:", data);
        setWeight(data.weight?.toString() || "");
        setNeck(data.neck?.toString() || "");
        setWaist(data.waist?.toString() || "");
        setHips(data.hips?.toString() || "");
        setSteps(data.steps?.toString() || "");
      } else {
        info(loggingLevel, "No existing check-in data for this date, clearing form.");
        // Clear form if no data for this date
        setWeight("");
        setNeck("");
        setWaist("");
        setHips("");
        setSteps("");
      }

      // Load custom measurements for the selected date
      const { data: customData, error: customError } = await supabase
        .from('custom_measurements')
        .select('*')
        .eq('user_id', currentUserId)
        .eq('entry_date', selectedDate);

      if (customError) {
        error(loggingLevel, 'Error loading custom measurements:', customError);
        return;
      }

      info(loggingLevel, "Custom measurements loaded for date:", { selectedDate, customData });
      const newCustomValues: {[key: string]: string} = {};
      if (customData) {
        customData.forEach((measurement) => {
          newCustomValues[measurement.category_id] = measurement.value.toString();
        });
      }
      setCustomValues(newCustomValues);
    } catch (err) {
      error(loggingLevel, 'Error loading existing data:', err);
    }
  };

  const handleWeightUnitChange = async (unit: string) => {
    debug(loggingLevel, "Handling weight unit change:", unit);
    try {
      await updateWeightUnit(unit as 'kg' | 'lbs');

      info(loggingLevel, `Weight unit updated to ${unit}`);
      toast({
        title: "Success",
        description: `Weight unit updated to ${unit}`,
      });
    } catch (err) {
      error(loggingLevel, 'Error updating weight unit preference:', err);
      toast({
        title: "Error",
        description: "Failed to update weight unit preference",
        variant: "destructive",
      });
    }
  };

  const handleMeasurementUnitChange = async (unit: string) => {
    debug(loggingLevel, "Handling measurement unit change:", unit);
    try {
      await updateMeasurementUnit(unit as 'cm' | 'inches');

      info(loggingLevel, `Measurement unit updated to ${unit}`);
      toast({
        title: "Success",
        description: `Measurement unit updated to ${unit}`,
      });
    } catch (err) {
      error(loggingLevel, 'Error updating measurement unit preference:', err);
      toast({
        title: "Error",
        description: "Failed to update measurement unit preference",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    debug(loggingLevel, "Handling form submit.");
    e.preventDefault();

    if (!currentUserId) {
      warn(loggingLevel, "Submit called with no current user ID.");
      toast({
        title: "Error",
        description: "You must be logged in to save check-in data",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    debug(loggingLevel, "Saving check-in data...");

    try {
      // Save standard check-in measurements
      const measurementData: any = {
        user_id: currentUserId,
        entry_date: selectedDate,
      };

      // Only include fields that have values
      if (weight) measurementData.weight = parseFloat(weight);
      if (neck) measurementData.neck = parseFloat(neck);
      if (waist) measurementData.waist = parseFloat(waist);
      if (hips) measurementData.hips = parseFloat(hips);
      if (steps) measurementData.steps = parseInt(steps);

      debug(loggingLevel, "Standard measurement data:", measurementData);
      const { error: supabaseError } = await supabase
        .from('check_in_measurements')
        .upsert(measurementData, {
          onConflict: 'user_id,entry_date'
        });

      if (supabaseError) {
        error(loggingLevel, 'Error saving check-in data:', supabaseError);
        toast({
          title: "Error",
          description: "Failed to save check-in data",
          variant: "destructive",
        });
        return;
      }
      info(loggingLevel, "Standard check-in data saved successfully.");

      // Save custom measurements
      debug(loggingLevel, "Saving custom measurements:", customValues);
      for (const [categoryId, value] of Object.entries(customValues)) {
        if (value && parseFloat(value) > 0) {
          const category = customCategories.find(c => c.id === categoryId);
          if (category) {
            const currentTime = new Date();
            let entryHour: number | null = null;
            let entryTimestamp: string;

            if (category.frequency === 'Hourly') {
              entryHour = currentTime.getHours();
              const selectedDateTime = new Date();
              selectedDateTime.setHours(currentTime.getHours(), 0, 0, 0);
              entryTimestamp = selectedDateTime.toISOString();
              debug(loggingLevel, `Saving hourly custom measurement for category ${category.name} at hour ${entryHour}.`);
            } else {
              entryTimestamp = currentTime.toISOString();
              debug(loggingLevel, `Saving custom measurement for category ${category.name}.`);
            }

            const customMeasurementData = {
              user_id: currentUserId,
              category_id: categoryId,
              value: parseFloat(value),
              entry_date: selectedDate,
              entry_hour: entryHour,
              entry_timestamp: entryTimestamp,
            };
            debug(loggingLevel, "Custom measurement data:", customMeasurementData);

            let result;
            if (category.frequency === 'All') {
              result = await supabase
                .from('custom_measurements')
                .insert(customMeasurementData);
              debug(loggingLevel, "Inserting custom measurement (frequency: All).");
            } else {
              result = await supabase
                .from('custom_measurements')
                .upsert(customMeasurementData, {
                  onConflict: 'user_id,category_id,entry_date,entry_hour'
                });
              debug(loggingLevel, "Upserting custom measurement (frequency: Daily/Hourly).");
            }

            if (result.error) {
              error(loggingLevel, 'Error saving custom measurement:', result.error);
            } else {
              info(loggingLevel, `Custom measurement for category ${category.name} saved successfully.`);
            }
          } else {
            warn(loggingLevel, `Custom category not found for ID: ${categoryId}`);
          }
        }
      }

      info(loggingLevel, "Check-in data saved successfully!");
      toast({
        title: "Success",
        description: "Check-in data saved successfully!",
      });

      // Refresh recent measurements after saving
      fetchRecentMeasurements();
    } catch (err) {
      error(loggingLevel, 'Error saving check-in data:', err);
      toast({
        title: "Error",
        description: "Failed to save check-in data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      debug(loggingLevel, "Finished saving check-in data.");
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Preferences Section */}
      <CheckInPreferences
        weightUnit={weightUnit}
        measurementUnit={measurementUnit}
        selectedDate={selectedDate}
        onWeightUnitChange={handleWeightUnitChange}
        onMeasurementUnitChange={handleMeasurementUnitChange}
        onDateChange={setSelectedDate}
      />

      {/* Check-In Form */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Check-In</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="weight">Weight ({weightUnit})</Label>
                <Input
                  id="weight"
                  type="number"
                  step="0.1"
                  value={weight}
                  onChange={(e) => {
                    debug(loggingLevel, "Weight input changed:", e.target.value);
                    setWeight(e.target.value);
                  }}
                  placeholder={`Enter weight in ${weightUnit}`}
                />
              </div>

              <div>
                <Label htmlFor="steps">Steps</Label>
                <Input
                  id="steps"
                  type="number"
                  value={steps}
                  onChange={(e) => {
                    debug(loggingLevel, "Steps input changed:", e.target.value);
                    setSteps(e.target.value);
                  }}
                  placeholder="Enter daily steps"
                />
              </div>

              <div>
                <Label htmlFor="neck">Neck ({measurementUnit})</Label>
                <Input
                  id="neck"
                  type="number"
                  step="0.1"
                  value={neck}
                  onChange={(e) => {
                    debug(loggingLevel, "Neck input changed:", e.target.value);
                    setNeck(e.target.value);
                  }}
                  placeholder={`Enter neck measurement in ${measurementUnit}`}
                />
              </div>

              <div>
                <Label htmlFor="waist">Waist ({measurementUnit})</Label>
                <Input
                  id="waist"
                  type="number"
                  step="0.1"
                  value={waist}
                  onChange={(e) => {
                    debug(loggingLevel, "Waist input changed:", e.target.value);
                    setWaist(e.target.value);
                  }}
                  placeholder={`Enter waist measurement in ${measurementUnit}`}
                />
              </div>

              <div>
                <Label htmlFor="hips">Hips ({measurementUnit})</Label>
                <Input
                  id="hips"
                  type="number"
                  step="0.1"
                  value={hips}
                  onChange={(e) => {
                    debug(loggingLevel, "Hips input changed:", e.target.value);
                    setHips(e.target.value);
                  }}
                  placeholder={`Enter hips measurement in ${measurementUnit}`}
                />
              </div>

              {/* Custom Categories */}
              {customCategories.map((category) => (
                <div key={category.id}>
                  <Label htmlFor={`custom-${category.id}`}>
                    {category.name} ({category.measurement_type})
                  </Label>
                  <Input
                    id={`custom-${category.id}`}
                    type="number"
                    step="0.01"
                    value={customValues[category.id] || ''}
                    onChange={(e) => {
                      debug(loggingLevel, `Custom measurement input changed for category ${category.name}:`, e.target.value);
                      setCustomValues(prev => ({
                      ...prev,
                      [category.id]: e.target.value
                    }))}}
                    placeholder={`Enter ${category.name.toLowerCase()} in ${category.measurement_type}`}
                  />
                </div>
              ))}
            </div>

            <div className="flex justify-center">
              <Button type="submit" disabled={loading} size="sm">
                {loading ? 'Saving...' : 'Save Check-In'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Recent Measurements */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Measurements (Last 20)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {recentMeasurements.length === 0 ? (
              <p className="text-muted-foreground">No measurements recorded yet</p>
            ) : (
              recentMeasurements.map((measurement) => (
                <div
                  key={measurement.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <div className="font-medium">
                      {measurement.custom_categories.name}: {measurement.value} {measurement.custom_categories.measurement_type}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(measurement.entry_date).toLocaleDateString()}
                      {measurement.entry_hour !== null && (
                        <span> at {measurement.entry_hour.toString().padStart(2, '0')}:00</span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      debug(loggingLevel, "Delete measurement button clicked:", measurement.id);
                      handleDeleteMeasurement(measurement.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CheckIn;
