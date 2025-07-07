import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useActiveUser } from "@/contexts/ActiveUserContext";
import { toast } from "@/hooks/use-toast";
import CheckInPreferences from "./CheckInPreferences";
import { usePreferences } from "@/contexts/PreferencesContext";
import { Trash2 } from "lucide-react";
import { toast as sonnerToast } from "sonner";
import { debug, info, warn, error } from '@/utils/logging'; // Import logging utility
import { format } from 'date-fns'; // Import format from date-fns
import {
  loadCustomCategories as loadCustomCategoriesService,
  fetchRecentMeasurements as fetchRecentMeasurementsService,
  handleDeleteMeasurement,
  loadExistingCheckInMeasurements,
  loadExistingCustomMeasurements,
  saveCheckInMeasurements,
  saveCustomMeasurement,
  CustomCategory,
  CustomMeasurement,
} from '@/services/checkInService';



const CheckIn = () => {
  const { user } = useAuth();
  const { activeUserId } = useActiveUser();
  const {
    weightUnit: defaultWeightUnit, // Default from preferences
    measurementUnit: defaultMeasurementUnit, // Default from preferences
    loadPreferences,
    formatDateInUserTimezone,
    parseDateInUserTimezone,
    loggingLevel,
    convertWeight,
    convertMeasurement,
  } = usePreferences();

  const [selectedDate, setSelectedDate] = useState(formatDateInUserTimezone(new Date(), 'yyyy-MM-dd'));
  const [weight, setWeight] = useState("");
  const [neck, setNeck] = useState("");
  const [waist, setWaist] = useState("");
  const [hips, setHips] = useState("");
  const [steps, setSteps] = useState("");
  const [displayWeightUnit, setDisplayWeightUnit] = useState<'kg' | 'lbs'>(defaultWeightUnit);
  const [displayMeasurementUnit, setDisplayMeasurementUnit] = useState<'cm' | 'inches'>(defaultMeasurementUnit);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [customValues, setCustomValues] = useState<{[key: string]: string}>({});

  const [loading, setLoading] = useState(false);
  const [recentMeasurements, setRecentMeasurements] = useState<CustomMeasurement[]>([]);

  const currentUserId = activeUserId || user?.id;
  debug(loggingLevel, "Current user ID:", currentUserId);

  // Helper to determine if a custom measurement type should be converted
  const shouldConvertCustomMeasurement = (unit: string) => {
    const convertibleUnits = ['kg', 'lbs', 'cm', 'inches'];
    return convertibleUnits.includes(unit.toLowerCase());
  };

  useEffect(() => {
    if (currentUserId) {
      loadExistingData();
      loadPreferences(); // Load user's default preferences
      loadCustomCategories();
      fetchRecentMeasurements();
    }

    const handleRefresh = () => {
      info(loggingLevel, "CheckIn: Received measurementsRefresh event, triggering data reload.");
      loadExistingData();
      fetchRecentMeasurements();
    };

    window.addEventListener('measurementsRefresh', handleRefresh);

    return () => {
      window.removeEventListener('measurementsRefresh', handleRefresh);
      };
    }, [currentUserId, selectedDate, loadPreferences, formatDateInUserTimezone, parseDateInUserTimezone, convertWeight, convertMeasurement, defaultWeightUnit, defaultMeasurementUnit]);
  
    useEffect(() => {
      setDisplayWeightUnit(defaultWeightUnit);
      setDisplayMeasurementUnit(defaultMeasurementUnit);
      // Trigger data reload when default units change to ensure values are displayed in the new default unit
      loadExistingData();
    }, [defaultWeightUnit, defaultMeasurementUnit]);
  
    // Effect to re-convert displayed values when display units change
    useEffect(() => {
      // Only re-convert if there's a value to convert
      if (weight) {
        const converted = convertWeight(parseFloat(weight), displayWeightUnit === 'kg' ? 'lbs' : 'kg', displayWeightUnit);
        setWeight(typeof converted === 'number' && !isNaN(converted) ? converted.toFixed(1) : "");
      }
      if (neck) {
        const converted = convertMeasurement(parseFloat(neck), displayMeasurementUnit === 'cm' ? 'inches' : 'cm', displayMeasurementUnit);
        setNeck(typeof converted === 'number' && !isNaN(converted) ? converted.toFixed(1) : "");
      }
      if (waist) {
        const converted = convertMeasurement(parseFloat(waist), displayMeasurementUnit === 'cm' ? 'inches' : 'cm', displayMeasurementUnit);
        setWaist(typeof converted === 'number' && !isNaN(converted) ? converted.toFixed(1) : "");
      }
      if (hips) {
        const converted = convertMeasurement(parseFloat(hips), displayMeasurementUnit === 'cm' ? 'inches' : 'cm', displayMeasurementUnit);
        setHips(typeof converted === 'number' && !isNaN(converted) ? converted.toFixed(1) : "");
      }
      // Re-load custom values to ensure they are displayed in the correct unit
      loadExistingData();
    }, [displayWeightUnit, displayMeasurementUnit]);
  
  
    const loadCustomCategories = async () => {
    if (!currentUserId) {
      warn(loggingLevel, "loadCustomCategories called with no current user ID.");
      return;
    }

    try {
      const data = await loadCustomCategoriesService();
      info(loggingLevel, "Custom categories loaded successfully:", data);
      setCustomCategories(data || []);
    } catch (err) {
      error(loggingLevel, 'Error loading custom categories:', err);
    }
  };

  const fetchRecentMeasurements = async () => {
    if (!currentUserId) {
      warn(loggingLevel, "fetchRecentMeasurements called with no current user ID.");
      return;
    }

    try {
      const data = await fetchRecentMeasurementsService();
      info(loggingLevel, "Recent measurements fetched successfully:", data);
      setRecentMeasurements(data || []);
    } catch (err) {
      error(loggingLevel, 'Error fetching recent measurements:', err);
      sonnerToast.error('Failed to load recent measurements');
    }
  };

  const handleDeleteMeasurementClick = async (measurementId: string) => {
    if (!currentUserId) {
      warn(loggingLevel, "handleDeleteMeasurementClick called with no current user ID.");
      return;
    }

    try {
      await handleDeleteMeasurement(measurementId);
      info(loggingLevel, 'Measurement deleted successfully:', measurementId);
      sonnerToast.success('Measurement deleted successfully');
      fetchRecentMeasurements();
      loadExistingData(); // Reload today's values
    } catch (err) {
      error(loggingLevel, 'Error deleting measurement:', err);
      sonnerToast.error('Failed to delete measurement');
    }
  };

  const loadExistingData = async () => {
    try {
      // Load check-in measurements
      const data = await loadExistingCheckInMeasurements(selectedDate);
      if (data) {
        info(loggingLevel, "Existing check-in data loaded:", data);
        // Set internal state in canonical units (kg, cm)
        // Values are loaded in canonical units, then converted for display
        const convertedWeight = data.weight !== undefined && data.weight !== null ? convertWeight(data.weight, 'kg', displayWeightUnit) : NaN;
        setWeight(typeof convertedWeight === 'number' && !isNaN(convertedWeight) ? convertedWeight.toFixed(1) : "");

        const convertedNeck = data.neck !== undefined && data.neck !== null ? convertMeasurement(data.neck, 'cm', displayMeasurementUnit) : NaN;
        setNeck(typeof convertedNeck === 'number' && !isNaN(convertedNeck) ? convertedNeck.toFixed(1) : "");

        const convertedWaist = data.waist !== undefined && data.waist !== null ? convertMeasurement(data.waist, 'cm', displayMeasurementUnit) : NaN;
        setWaist(typeof convertedWaist === 'number' && !isNaN(convertedWaist) ? convertedWaist.toFixed(1) : "");

        const convertedHips = data.hips !== undefined && data.hips !== null ? convertMeasurement(data.hips, 'cm', displayMeasurementUnit) : NaN;
        setHips(typeof convertedHips === 'number' && !isNaN(convertedHips) ? convertedHips.toFixed(1) : "");
        setSteps(data.steps?.toString() || "");
      } else {
        info(loggingLevel, "No existing check-in data for this date, clearing form.");
        setWeight("");
        setNeck("");
        setWaist("");
        setHips("");
        setSteps("");
      }

      const customData = await loadExistingCustomMeasurements(selectedDate);
      info(loggingLevel, "Custom measurements loaded for date:", { selectedDate, customData });
      const newCustomValues: {[key: string]: string} = {};
      if (customData) {
        customData.forEach((measurement) => {
          const isConvertible = shouldConvertCustomMeasurement(measurement.custom_categories.measurement_type);
          newCustomValues[measurement.category_id] = isConvertible
            ? (() => {
                const converted = convertMeasurement(measurement.value, 'cm', displayMeasurementUnit);
                return typeof converted === 'number' && !isNaN(converted) ? converted.toFixed(1) : "";
              })()
            : measurement.value.toString();
        });
      }
      setCustomValues(newCustomValues);
    } catch (err) {
      error(loggingLevel, 'Error loading existing data:', err);
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
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

    try {
      // Save standard check-in measurements
      const measurementData: any = {
        user_id: currentUserId,
        entry_date: selectedDate, // Use selectedDate directly
      };

      // Convert values to canonical units (kg, cm) before saving
      if (weight) measurementData.weight = convertWeight(parseFloat(weight), displayWeightUnit, 'kg');
      if (neck) measurementData.neck = convertMeasurement(parseFloat(neck), displayMeasurementUnit, 'cm');
      if (waist) measurementData.waist = convertMeasurement(parseFloat(waist), displayMeasurementUnit, 'cm');
      if (hips) measurementData.hips = convertMeasurement(parseFloat(hips), displayMeasurementUnit, 'cm');
      if (steps) measurementData.steps = parseInt(steps);

      await saveCheckInMeasurements(measurementData);
      info(loggingLevel, "Standard check-in data saved successfully.");

      for (const [categoryId, value] of Object.entries(customValues)) {
        if (value && parseFloat(value) > 0) {
          const category = customCategories.find(c => c.id === categoryId);
          if (category) {
            const isConvertible = shouldConvertCustomMeasurement(category.measurement_type); // Recalculate here
            const currentTime = new Date();
            let entryHour: number | null = null;
            let entryTimestamp: string;

            if (category.frequency === 'Hourly') {
              entryHour = currentTime.getHours();
              const selectedDateTime = new Date();
              selectedDateTime.setHours(currentTime.getHours(), 0, 0, 0);
              entryTimestamp = selectedDateTime.toISOString();
            } else {
              entryTimestamp = currentTime.toISOString();
            }

            const customMeasurementData = {
              user_id: currentUserId,
              category_id: categoryId,
              value: isConvertible && !isNaN(parseFloat(value))
                ? convertMeasurement(parseFloat(value), displayMeasurementUnit, 'cm')
                : parseFloat(value), // No conversion if not convertible, or if value is not a number
              entry_date: selectedDate,
              entry_hour: entryHour,
              entry_timestamp: entryTimestamp,
            };

            await saveCustomMeasurement(customMeasurementData);
            info(loggingLevel, `Custom measurement for category ${category.name} saved successfully.`);
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
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Preferences Section */}
      <CheckInPreferences
        weightUnit={displayWeightUnit}
        measurementUnit={displayMeasurementUnit}
        setWeightUnit={setDisplayWeightUnit}
        setMeasurementUnit={setDisplayMeasurementUnit}
        selectedDate={selectedDate}
        onDateChange={(dateString) => {
          setSelectedDate(dateString);
          // When date changes, reload existing data for the new date
          // This will be triggered by the useEffect hook
        }}
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
                <Label htmlFor="weight">Weight ({displayWeightUnit})</Label>
                <Input
                  id="weight"
                  type="number"
                  step="0.1"
                  value={weight}
                  onChange={(e) => {
                    setWeight(e.target.value);
                  }}
                  placeholder={`Enter weight in ${displayWeightUnit}`}
                />
              </div>

              <div>
                <Label htmlFor="steps">Steps</Label>
                <Input
                  id="steps"
                  type="number"
                  value={steps}
                  onChange={(e) => {
                    setSteps(e.target.value);
                  }}
                  placeholder="Enter daily steps"
                />
              </div>

              <div>
                <Label htmlFor="neck">Neck ({displayMeasurementUnit})</Label>
                <Input
                  id="neck"
                  type="number"
                  step="0.1"
                  value={neck}
                  onChange={(e) => {
                    setNeck(e.target.value);
                  }}
                  placeholder={`Enter neck measurement in ${displayMeasurementUnit}`}
                />
              </div>

              <div>
                <Label htmlFor="waist">Waist ({displayMeasurementUnit})</Label>
                <Input
                  id="waist"
                  type="number"
                  step="0.1"
                  value={waist}
                  onChange={(e) => {
                    setWaist(e.target.value);
                  }}
                  placeholder={`Enter waist measurement in ${displayMeasurementUnit}`}
                />
              </div>

              <div>
                <Label htmlFor="hips">Hips ({displayMeasurementUnit})</Label>
                <Input
                  id="hips"
                  type="number"
                  step="0.1"
                  value={hips}
                  onChange={(e) => {
                    setHips(e.target.value);
                  }}
                  placeholder={`Enter hips measurement in ${displayMeasurementUnit}`}
                />
              </div>

              {/* Custom Categories */}
              {customCategories.map((category) => {
                const isConvertible = shouldConvertCustomMeasurement(category.measurement_type);
                return (
                  <div key={category.id}>
                    <Label htmlFor={`custom-${category.id}`}>
                      {category.name} ({isConvertible ? displayMeasurementUnit : category.measurement_type})
                    </Label>
                    <Input
                      id={`custom-${category.id}`}
                      type="number"
                      step="0.01"
                      value={customValues[category.id] || ''}
                      onChange={(e) => {
                        setCustomValues(prev => ({
                          ...prev,
                          [category.id]: e.target.value
                        }));
                      }}
                      placeholder={`Enter ${category.name.toLowerCase()} in ${isConvertible ? displayMeasurementUnit : category.measurement_type}`}
                    />
                  </div>
                );
              })}
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
              recentMeasurements.map((measurement) => {
                const isConvertible = shouldConvertCustomMeasurement(measurement.custom_categories.measurement_type);
                const displayValue = isConvertible
                  ? convertMeasurement(measurement.value, 'cm', displayMeasurementUnit).toFixed(1)
                  : measurement.value;
                const displayUnit = isConvertible ? displayMeasurementUnit : measurement.custom_categories.measurement_type;

                return (
                  <div
                    key={measurement.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <div className="font-medium">
                        {measurement.custom_categories.name}: {displayValue} {displayUnit}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatDateInUserTimezone(measurement.entry_date, 'PPP')}
                        {measurement.entry_hour !== null && (
                          <span> at {measurement.entry_hour.toString().padStart(2, '0')}:00</span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        handleDeleteMeasurementClick(measurement.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CheckIn;
