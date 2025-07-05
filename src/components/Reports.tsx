import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { BarChart3, TrendingUp, Activity } from "lucide-react";
import { usePreferences } from "@/contexts/PreferencesContext";
import { useActiveUser } from "@/contexts/ActiveUserContext";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import ZoomableChart from "./ZoomableChart";
import ReportsControls from "./reports/ReportsControls";
import NutritionChartsGrid from "./reports/NutritionChartsGrid";
import MeasurementChartsGrid from "./reports/MeasurementChartsGrid";
import ReportsTables from "./reports/ReportsTables";
import { log, debug, info, warn, error, UserLoggingLevel } from "@/utils/logging";
import { format, parseISO, addDays } from 'date-fns'; // Import format, parseISO, addDays from date-fns
import { calculateFoodEntryNutrition } from '@/utils/nutritionCalculations'; // Import the new utility function

import {
  loadReportsData,
  NutritionData,
  MeasurementData as ReportsMeasurementData, // Alias to avoid naming conflict if needed
  DailyFoodEntry,
  CustomCategory,
  CustomMeasurementData,
} from '@/services/reportsService';

// At the very top of Reports.tsx, before the functional component definition
const Reports = () => {
  // At the very top of Reports.tsx, before the functional component definition
  // These console.log statements were moved inside the component to access loggingLevel
  const { user } = useAuth();
  const { activeUserId } = useActiveUser();
  const { weightUnit, measurementUnit, convertWeight, convertMeasurement, formatDateInUserTimezone, parseDateInUserTimezone, loggingLevel, timezone } = usePreferences();
  const [nutritionData, setNutritionData] = useState<NutritionData[]>([]);
  const [measurementData, setMeasurementData] = useState<ReportsMeasurementData[]>([]);
  const [tabularData, setTabularData] = useState<DailyFoodEntry[]>([]);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [customMeasurementsData, setCustomMeasurementsData] = useState<Record<string, CustomMeasurementData[]>>({});
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [showWeightInKg, setShowWeightInKg] = useState(true);
  const [showMeasurementsInCm, setShowMeasurementsInCm] = useState(true);

  // Effect to re-initialize startDate and endDate when timezone preference changes
  useEffect(() => {
    debug(loggingLevel, 'Reports: Timezone preference changed or component mounted, initializing/re-initializing default date range.');
    const today = new Date();
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(today.getDate() - 14);
    debug(loggingLevel, 'Reports: Inside date re-initialization useEffect - today:', today, 'twoWeeksAgo:', twoWeeksAgo);
    debug(loggingLevel, 'Reports: Inside date re-initialization useEffect - formatted today:', formatDateInUserTimezone(today, 'yyyy-MM-dd'), 'formatted twoWeeksAgo:', formatDateInUserTimezone(twoWeeksAgo, 'yyyy-MM-dd'));
    setStartDate(formatDateInUserTimezone(twoWeeksAgo, 'yyyy-MM-dd'));
    setEndDate(formatDateInUserTimezone(today, 'yyyy-MM-dd'));

    // Debug logs for new Date() and toISOString() moved here to access loggingLevel
    debug(loggingLevel, "Reports.tsx - Raw new Date():", new Date());
    debug(loggingLevel, "Reports.tsx - Raw new Date().toISOString():", new Date().toISOString());

  }, [timezone, formatDateInUserTimezone, loggingLevel]); // Depend on timezone from usePreferences

  // Effect to load reports when user, activeUser, date range changes, or refresh events are triggered
  useEffect(() => {
    info(loggingLevel, 'Reports: Component mounted/updated with:', {
      user: !!user,
      activeUserId,
      startDate,
      endDate,
      showWeightInKg,
      showMeasurementsInCm,
      weightUnit,
      measurementUnit,
      loggingLevel
    });
    
    if (user && activeUserId && startDate && endDate) { // Only load reports if dates are set
      loadReports();
    } else {
      info(loggingLevel, 'Reports: Skipping initial report load because user, activeUserId, startDate, or endDate is not yet available.');
    }

    const handleRefresh = () => {
      info(loggingLevel, "Reports: Received refresh event, triggering data reload.");
      loadReports();
    };

    window.addEventListener('foodDiaryRefresh', handleRefresh);
    window.addEventListener('measurementsRefresh', handleRefresh);

    return () => {
      window.removeEventListener('foodDiaryRefresh', handleRefresh);
      window.removeEventListener('measurementsRefresh', handleRefresh);
    };
  }, [user, activeUserId, startDate, endDate, loggingLevel, formatDateInUserTimezone, parseDateInUserTimezone, showWeightInKg, showMeasurementsInCm, weightUnit, measurementUnit]); // Added showWeightInKg, showMeasurementsInCm, weightUnit, measurementUnit to dependencies

  const loadReports = async () => {
    info(loggingLevel, 'Reports: Loading reports...');
    try {
      setLoading(true);
      
      const {
        nutritionData: fetchedNutritionData,
        tabularData: fetchedTabularData,
        measurementData: fetchedMeasurementData,
        customCategories: fetchedCustomCategories,
        customMeasurementsData: fetchedCustomMeasurementsData,
      } = await loadReportsData(activeUserId, startDate, endDate);

      setNutritionData(fetchedNutritionData);
      setTabularData(fetchedTabularData);
      
      // Apply unit conversions to fetchedMeasurementData
      const measurementDataFormatted = fetchedMeasurementData.map(m => ({
        entry_date: m.entry_date,
        weight: m.weight ? convertWeight(m.weight, 'kg', showWeightInKg ? 'kg' : 'lbs') : undefined,
        neck: m.neck ? convertMeasurement(m.neck, 'cm', showMeasurementsInCm ? 'cm' : 'inches') : undefined,
        waist: m.waist ? convertMeasurement(m.waist, 'cm', showMeasurementsInCm ? 'cm' : 'inches') : undefined,
        hips: m.hips ? convertMeasurement(m.hips, 'cm', showMeasurementsInCm ? 'cm' : 'inches') : undefined,
        steps: m.steps || undefined,
      }));
      setMeasurementData(measurementDataFormatted);

      setCustomCategories(fetchedCustomCategories);
      setCustomMeasurementsData(fetchedCustomMeasurementsData);
      info(loggingLevel, 'Reports: Reports loaded successfully.');
    } catch (error) {
      error(loggingLevel, 'Reports: Error loading reports:', error);
      toast({
        title: "Error",
        description: "Failed to load reports.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      debug(loggingLevel, 'Reports: Loading state set to false.');
    }
  };

  const exportFoodDiary = async () => {
    info(loggingLevel, 'Reports: Attempting to export food diary.');
    try {
      if (!tabularData.length) {
        warn(loggingLevel, 'Reports: No food diary data to export.');
        toast({
          title: "No Data",
          description: "No food diary data to export",
          variant: "destructive",
          });
        return;
      }

      const csvHeaders = [
        'Date', 'Meal', 'Food', 'Brand', 'Quantity', 'Unit',
        'Calories', 'Protein (g)', 'Carbs (g)', 'Fat (g)',
        'Saturated Fat (g)', 'Polyunsaturated Fat (g)', 'Monounsaturated Fat (g)', 'Trans Fat (g)',
        'Cholesterol (mg)', 'Sodium (mg)', 'Potassium (mg)', 'Dietary Fiber (g)', 'Sugars (g)',
        'Vitamin A (μg)', 'Vitamin C (mg)', 'Calcium (mg)', 'Iron (mg)'
      ];

      // Group data by date and include totals
      const groupedData = tabularData.reduce((acc, entry) => {
        const date = entry.entry_date;
        if (!acc[date]) {
          acc[date] = [];
        }
        acc[date].push(entry);
        return acc;
      }, {} as Record<string, DailyFoodEntry[]>);

      const calculateDayTotal = (entries: DailyFoodEntry[]) => {
        return entries.reduce((total, entry) => {
          const calculatedNutrition = calculateFoodEntryNutrition(entry as any); // Cast to any for now

          return {
            calories: total.calories + calculatedNutrition.calories,
            protein: total.protein + calculatedNutrition.protein,
            carbs: total.carbs + calculatedNutrition.carbs,
            fat: total.fat + calculatedNutrition.fat,
            saturated_fat: total.saturated_fat + (calculatedNutrition.saturated_fat || 0),
            polyunsaturated_fat: total.polyunsaturated_fat + (calculatedNutrition.polyunsaturated_fat || 0),
            monounsaturated_fat: total.monounsaturated_fat + (calculatedNutrition.monounsaturated_fat || 0),
            trans_fat: total.trans_fat + (calculatedNutrition.trans_fat || 0),
            cholesterol: total.cholesterol + (calculatedNutrition.cholesterol || 0),
            sodium: total.sodium + (calculatedNutrition.sodium || 0),
            potassium: total.potassium + (calculatedNutrition.potassium || 0),
            dietary_fiber: total.dietary_fiber + (calculatedNutrition.dietary_fiber || 0),
            sugars: total.sugars + (calculatedNutrition.sugars || 0),
            vitamin_a: total.vitamin_a + (calculatedNutrition.vitamin_a || 0),
            vitamin_c: total.vitamin_c + (calculatedNutrition.vitamin_c || 0),
            calcium: total.calcium + (calculatedNutrition.calcium || 0),
            iron: total.iron + (calculatedNutrition.iron || 0),
          };
        }, {
          calories: 0, protein: 0, carbs: 0, fat: 0, saturated_fat: 0,
          polyunsaturated_fat: 0, monounsaturated_fat: 0, trans_fat: 0,
          cholesterol: 0, sodium: 0, potassium: 0, dietary_fiber: 0,
          sugars: 0, vitamin_a: 0, vitamin_c: 0, calcium: 0, iron: 0
        });
      };

      const csvRows: string[][] = [];
      
      // Sort dates descending
      Object.keys(groupedData)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
        .forEach(date => {
          const entries = groupedData[date];
          
          // Add individual entries
          entries.forEach(entry => {
            const calculatedNutrition = calculateFoodEntryNutrition(entry as any); // Cast to any for now

            csvRows.push([
              formatDateInUserTimezone(entry.entry_date, 'MMM dd, yyyy'), // Format date for display
              entry.meal_type,
              entry.foods.name,
              entry.foods.brand || '',
              entry.quantity.toString(),
              entry.unit,
              Math.round(calculatedNutrition.calories).toString(),
              calculatedNutrition.protein.toFixed(1),
              calculatedNutrition.carbs.toFixed(1),
              calculatedNutrition.fat.toFixed(1),
              (calculatedNutrition.saturated_fat || 0).toFixed(1),
              (calculatedNutrition.polyunsaturated_fat || 0).toFixed(1),
              (calculatedNutrition.monounsaturated_fat || 0).toFixed(1),
              (calculatedNutrition.trans_fat || 0).toFixed(1),
              (calculatedNutrition.cholesterol || 0).toFixed(1),
              (calculatedNutrition.sodium || 0).toFixed(1),
              (calculatedNutrition.potassium || 0).toFixed(1),
              (calculatedNutrition.dietary_fiber || 0).toFixed(1),
              (calculatedNutrition.sugars || 0).toFixed(1),
              (calculatedNutrition.vitamin_a || 0).toFixed(1),
              (calculatedNutrition.vitamin_c || 0).toFixed(1),
              (calculatedNutrition.calcium || 0).toFixed(1),
              (calculatedNutrition.iron || 0).toFixed(1)
            ]);
          });
          
          // Add total row
          const totals = calculateDayTotal(entries);
          csvRows.push([
            formatDateInUserTimezone(date, 'MMM dd, yyyy'), // Format date for display
            'Total',
            '',
            '',
            '',
            '',
            Math.round(totals.calories).toString(),
            totals.protein.toFixed(1),
            totals.carbs.toFixed(1),
            totals.fat.toFixed(1),
            totals.saturated_fat.toFixed(1),
            totals.polyunsaturated_fat.toFixed(1),
            totals.monounsaturated_fat.toFixed(1),
            totals.trans_fat.toFixed(1),
            totals.cholesterol.toFixed(1),
            totals.sodium.toFixed(1),
            totals.potassium.toFixed(1),
            totals.dietary_fiber.toFixed(1),
            totals.sugars.toFixed(1),
            totals.vitamin_a.toFixed(1),
            totals.vitamin_c.toFixed(1),
            totals.calcium.toFixed(1),
            totals.iron.toFixed(1)
          ]);
        });

      const csvContent = [csvHeaders, ...csvRows].map(row =>
        row.map(cell => `"${cell}"`).join(',')
      ).join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `food-diary-${startDate}-to-${endDate}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      info(loggingLevel, 'Reports: Food diary exported successfully.');
      toast({
        title: "Success",
        description: "Food diary exported successfully",
      });
    } catch (err) {
      error(loggingLevel, 'Reports: Error exporting food diary:', err);
      toast({
        title: "Error",
        description: "Failed to export food diary",
        variant: "destructive",
      });
    }
  };

  const exportBodyMeasurements = async () => {
    info(loggingLevel, 'Reports: Attempting to export body measurements.');
    try {
      debug(loggingLevel, 'Reports: Fetching body measurements for export...');
      // Data is already loaded by loadReportsData, so we just use the state
      const measurements = measurementData;

      if (!measurements || measurements.length === 0) {
        warn(loggingLevel, 'Reports: No body measurements to export.');
        toast({
          title: "No Data",
          description: "No body measurements to export",
          variant: "destructive",
        });
        return;
      }

      info(loggingLevel, `Reports: Fetched ${measurements.length} body measurement entries for export.`);

      const csvHeaders = [
        'Date',
        `Weight (${showWeightInKg ? 'kg' : 'lbs'})`,
        `Neck (${showMeasurementsInCm ? 'cm' : 'inches'})`,
        `Waist (${showMeasurementsInCm ? 'cm' : 'inches'})`,
        `Hips (${showMeasurementsInCm ? 'cm' : 'inches'})`,
        'Steps'
      ];

      const csvRows = measurements
        .filter(measurement =>
          measurement.weight ||
          measurement.neck ||
          measurement.waist ||
          measurement.hips ||
          measurement.steps
        )
        .map(measurement => [
          formatDateInUserTimezone(measurement.entry_date, 'MMM dd, yyyy'), // Format date for display
          measurement.weight ? convertWeight(measurement.weight, 'kg', showWeightInKg ? 'kg' : 'lbs').toFixed(1) : '',
          measurement.neck ? convertMeasurement(measurement.neck, 'cm', showMeasurementsInCm ? 'cm' : 'inches').toFixed(1) : '',
          measurement.waist ? convertMeasurement(measurement.waist, 'cm', showMeasurementsInCm ? 'cm' : 'inches').toFixed(1) : '',
          measurement.hips ? convertMeasurement(measurement.hips, 'cm', showMeasurementsInCm ? 'cm' : 'inches').toFixed(1) : '',
          measurement.steps || ''
        ]);

      const csvContent = [csvHeaders, ...csvRows].map(row =>
        row.map(cell => `"${cell}"`).join(',')
      ).join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `body-measurements-${startDate}-to-${endDate}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      info(loggingLevel, 'Reports: Body measurements exported successfully.');
      toast({
        title: "Success",
        description: "Body measurements exported successfully",
      });
    } catch (err) {
      error(loggingLevel, 'Reports: Error exporting body measurements:', err);
      toast({
        title: "Error",
        description: "Failed to export body measurements",
        variant: "destructive",
      });
    }
  };

  const exportCustomMeasurements = async (category: CustomCategory) => {
    info(loggingLevel, `Reports: Attempting to export custom measurements for category: ${category.name} (${category.id})`);
    try {
      const measurements = customMeasurementsData[category.id];
      if (!measurements || measurements.length === 0) {
        warn(loggingLevel, `Reports: No custom measurement data to export for category: ${category.name}.`);
        toast({
          title: "No Data",
          description: `No ${category.name} data to export`,
          variant: "destructive",
        });
        return;
      }

      info(loggingLevel, `Reports: Found ${measurements.length} custom measurement entries for category: ${category.name}.`);

      // Sort by timestamp descending
      const sortedMeasurements = [...measurements].sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      const csvHeaders = ['Date', 'Hour', 'Value'];
      const csvRows = sortedMeasurements.map(measurement => {
        const timestamp = new Date(measurement.timestamp);
        const hour = timestamp.getHours();
        const formattedHour = `${hour.toString().padStart(2, '0')}:00`;
        
        return [
          formatDateInUserTimezone(measurement.entry_date, 'MMM dd, yyyy'), // Format date for display
          formattedHour,
          measurement.value.toString()
        ];
      });

      const csvContent = [csvHeaders, ...csvRows].map(row =>
        row.map(cell => `"${cell}"`).join(',')
      ).join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${category.name.toLowerCase().replace(/\s+/g, '-')}-${startDate}-to-${endDate}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      info(loggingLevel, `Reports: Custom measurements exported successfully for category: ${category.name}.`);
      toast({
        title: "Success",
        description: `${category.name} data exported successfully`,
      });
    } catch (err) {
      error(loggingLevel, `Reports: Error exporting custom measurements for category ${category.name}:`, err);
      toast({
        title: "Error",
        description: "Failed to export data",
        variant: "destructive",
      });
    }
  };

  const formatCustomChartData = (category: CustomCategory, data: CustomMeasurementData[]) => {
    debug(loggingLevel, `Reports: Formatting custom chart data for category: ${category.name} (${category.frequency})`);
    if (category.frequency === 'Hourly' || category.frequency === 'All') {
      return data.map(d => ({
        date: `${d.entry_date} ${d.hour !== null ? String(d.hour).padStart(2, '0') + ':00' : ''}`,
        value: d.value
      }));
    } else {
      // For daily, group by date and take the latest value
      const grouped = data.reduce((acc, d) => {
        if (!acc[d.entry_date] || new Date(d.timestamp) > new Date(acc[d.entry_date].timestamp)) {
          acc[d.entry_date] = d;
        }
        return acc;
      }, {} as Record<string, CustomMeasurementData>);
      
      return Object.values(grouped).map(d => ({
        date: d.entry_date,
        value: d.value
      }));
    }
  };

  const handleWeightUnitToggle = (showInKg: boolean) => {
    debug(loggingLevel, 'Reports: Weight unit toggle handler called:', {
      showInKg,
      currentShowWeightInKg: showWeightInKg,
      currentWeightUnit: weightUnit
    });
    setShowWeightInKg(showInKg);
  };

  const handleMeasurementUnitToggle = (showInCm: boolean) => {
    debug(loggingLevel, 'Reports: Measurement unit toggle handler called:', {
      showInCm,
      currentShowMeasurementsInCm: showMeasurementsInCm,
      currentMeasurementUnit: measurementUnit
    });
    setShowMeasurementsInCm(showInCm);
  };

  const handleStartDateChange = (date: string) => {
    debug(loggingLevel, 'Reports: Start date change handler called:', {
      newDate: date,
      currentStartDate: startDate
    });
    setStartDate(date);
  };

  const handleEndDateChange = (date: string) => {
    debug(loggingLevel, 'Reports: End date change handler called:', {
      newDate: date,
      currentEndDate: endDate
    });
    setEndDate(date);
  };

  if (!user || !activeUserId) {
    info(loggingLevel, 'Reports: User not signed in, displaying sign-in message.');
    return <div>Please sign in to view reports.</div>;
  }

  info(loggingLevel, 'Reports: Rendering reports component.');
  return (
    <div className="space-y-6">
      {startDate && endDate ? ( // Only render ReportsControls if dates are initialized
        <ReportsControls
          startDate={startDate}
          endDate={endDate}
          showWeightInKg={showWeightInKg}
          showMeasurementsInCm={showMeasurementsInCm}
          onStartDateChange={handleStartDateChange}
          onEndDateChange={handleEndDateChange}
          onWeightUnitToggle={handleWeightUnitToggle}
          onMeasurementUnitToggle={handleMeasurementUnitToggle}
        />
      ) : (
        <div>Loading date controls...</div> // Or a loading spinner
      )}

      {loading ? (
        <div>Loading reports...</div>
      ) : (
        <Tabs defaultValue="charts" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="charts" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Charts
            </TabsTrigger>
            <TabsTrigger value="table" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Table View
            </TabsTrigger>
          </TabsList>

          <TabsContent value="charts" className="space-y-6">
            <NutritionChartsGrid nutritionData={nutritionData} />
            <MeasurementChartsGrid
              measurementData={measurementData}
              showWeightInKg={showWeightInKg}
              showMeasurementsInCm={showMeasurementsInCm}
            />

            {/* Custom Measurements Charts */}
            {customCategories.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Custom Measurements</h3>
                <div className="space-y-4">
                  {customCategories.map((category) => {
                    const data = customMeasurementsData[category.id] || [];
                    const chartData = formatCustomChartData(category, data);
                    
                    return (
                      <ZoomableChart key={category.id} title={`${category.name} (${category.measurement_type})`}>
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center">
                              <Activity className="w-5 h-5 mr-2" />
                              {category.name} ({category.measurement_type})
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="h-80">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="date" />
                                  <YAxis />
                                  <Tooltip />
                                  <Line type="monotone" dataKey="value" stroke="#8884d8" strokeWidth={2} dot={false} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          </CardContent>
                        </Card>
                      </ZoomableChart>
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="table" className="space-y-6">
            <ReportsTables
              tabularData={tabularData}
              measurementData={measurementData}
              customCategories={customCategories}
              customMeasurementsData={customMeasurementsData}
              showWeightInKg={showWeightInKg}
              showMeasurementsInCm={showMeasurementsInCm}
              onExportFoodDiary={exportFoodDiary}
              onExportBodyMeasurements={exportBodyMeasurements}
              onExportCustomMeasurements={exportCustomMeasurements}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default Reports;
