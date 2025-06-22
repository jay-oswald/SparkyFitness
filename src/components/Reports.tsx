
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { BarChart3, TrendingUp, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveUser } from "@/contexts/ActiveUserContext";
import { usePreferences } from "@/contexts/PreferencesContext";
import { toast } from "@/hooks/use-toast";
import ZoomableChart from "./ZoomableChart";
import ReportsControls from "./reports/ReportsControls";
import NutritionChartsGrid from "./reports/NutritionChartsGrid";
import MeasurementChartsGrid from "./reports/MeasurementChartsGrid";
import ReportsTables from "./reports/ReportsTables";
import { log, debug, info, warn, error, UserLoggingLevel } from "@/utils/logging";
import { format } from 'date-fns'; // Import format from date-fns

interface NutritionData {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  saturated_fat: number;
  polyunsaturated_fat: number;
  monounsaturated_fat: number;
  trans_fat: number;
  cholesterol: number;
  sodium: number;
  potassium: number;
  dietary_fiber: number;
  sugars: number;
  vitamin_a: number;
  vitamin_c: number;
  calcium: number;
  iron: number;
}

interface MeasurementData {
  date: string;
  weight?: number;
  neck?: number;
  waist?: number;
  hips?: number;
  steps?: number;
}

interface DailyFoodEntry {
  entry_date: string;
  meal_type: string;
  quantity: number;
  unit: string;
  foods: {
    name: string;
    brand?: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    saturated_fat?: number;
    polyunsaturated_fat?: number;
    monounsaturated_fat?: number;
    trans_fat?: number;
    cholesterol?: number;
    sodium?: number;
    potassium?: number;
    dietary_fiber?: number;
    sugars?: number;
    vitamin_a?: number;
    vitamin_c?: number;
    calcium?: number;
    iron?: number;
    serving_size: number;
  };
}

interface CustomCategory {
  id: string;
  name: string;
  measurement_type: string;
  frequency: string;
}

interface CustomMeasurementData {
  category_id: string;
  date: string;
  hour?: number;
  value: number;
  timestamp: string;
}

const Reports = () => {
  const { user } = useAuth();
  const { activeUserId } = useActiveUser();
  const { weightUnit, measurementUnit, convertWeight, convertMeasurement, formatDateInUserTimezone, parseDateInUserTimezone, loggingLevel } = usePreferences();
  const [nutritionData, setNutritionData] = useState<NutritionData[]>([]);
  const [measurementData, setMeasurementData] = useState<MeasurementData[]>([]);
  const [tabularData, setTabularData] = useState<DailyFoodEntry[]>([]);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [customMeasurementsData, setCustomMeasurementsData] = useState<Record<string, CustomMeasurementData[]>>({});
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 14); // Default to 2 weeks ago
    return formatDateInUserTimezone(date, 'yyyy-MM-dd'); // Use formatDateInUserTimezone for initial date
  });
  const [endDate, setEndDate] = useState(formatDateInUserTimezone(new Date(), 'yyyy-MM-dd')); // Use formatDateInUserTimezone for initial date
  const [showWeightInKg, setShowWeightInKg] = useState(true);
  const [showMeasurementsInCm, setShowMeasurementsInCm] = useState(true);

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
    
    if (user && activeUserId) {
      loadReports();
    }
  }, [user, activeUserId, startDate, endDate, loggingLevel, formatDateInUserTimezone, parseDateInUserTimezone]);

  const loadReports = async () => {
    info(loggingLevel, 'Reports: Loading reports...');
    try {
      setLoading(true);
      
      // Load nutrition data with all nutrients - use activeUserId
      debug(loggingLevel, 'Reports: Fetching food entries...');
      const { data: entries, error: entriesError } = await supabase
        .from('food_entries')
        .select(`
          entry_date,
          quantity,
          unit,
          foods (
            calories,
            protein,
            carbs,
            fat,
            saturated_fat,
            polyunsaturated_fat,
            monounsaturated_fat,
            trans_fat,
            cholesterol,
            sodium,
            potassium,
            dietary_fiber,
            sugars,
            vitamin_a,
            vitamin_c,
            calcium,
            iron,
            serving_size
          )
        `)
        .eq('user_id', activeUserId)
        .gte('entry_date', startDate) // Use startDate directly
        .lte('entry_date', endDate) // Use endDate directly
        .order('entry_date');

      if (entriesError) {
        error(loggingLevel, 'Reports: Error fetching food entries:', entriesError);
        throw entriesError;
      }

      if (entries) {
        info(loggingLevel, `Reports: Fetched ${entries.length} food entries.`);
        const nutritionByDate = entries.reduce((acc, entry) => {
          const date = entry.entry_date;
          const food = entry.foods;
          if (!food) return acc;

          const multiplier = entry.quantity / (food.serving_size || 100);
          
          if (!acc[date]) {
            acc[date] = {
              date,
              calories: 0,
              protein: 0,
              carbs: 0,
              fat: 0,
              saturated_fat: 0,
              polyunsaturated_fat: 0,
              monounsaturated_fat: 0,
              trans_fat: 0,
              cholesterol: 0,
              sodium: 0,
              potassium: 0,
              dietary_fiber: 0,
              sugars: 0,
              vitamin_a: 0,
              vitamin_c: 0,
              calcium: 0,
              iron: 0
            };
          }

          acc[date].calories += (food.calories || 0) * multiplier;
          acc[date].protein += (food.protein || 0) * multiplier;
          acc[date].carbs += (food.carbs || 0) * multiplier;
          acc[date].fat += (food.fat || 0) * multiplier;
          acc[date].saturated_fat += (food.saturated_fat || 0) * multiplier;
          acc[date].polyunsaturated_fat += (food.polyunsaturated_fat || 0) * multiplier;
          acc[date].monounsaturated_fat += (food.monounsaturated_fat || 0) * multiplier;
          acc[date].trans_fat += (food.trans_fat || 0) * multiplier;
          acc[date].cholesterol += (food.cholesterol || 0) * multiplier;
          acc[date].sodium += (food.sodium || 0) * multiplier;
          acc[date].potassium += (food.potassium || 0) * multiplier;
          acc[date].dietary_fiber += (food.dietary_fiber || 0) * multiplier;
          acc[date].sugars += (food.sugars || 0) * multiplier;
          acc[date].vitamin_a += (food.vitamin_a || 0) * multiplier;
          acc[date].vitamin_c += (food.vitamin_c || 0) * multiplier;
          acc[date].calcium += (food.calcium || 0) * multiplier;
          acc[date].iron += (food.iron || 0) * multiplier;

          return acc;
        }, {} as Record<string, NutritionData>);

        setNutritionData(Object.values(nutritionByDate));
        debug(loggingLevel, 'Reports: Processed nutrition data.');
      }

      // Load tabular data for the table view with all nutrients - use activeUserId
      debug(loggingLevel, 'Reports: Fetching tabular food entries...');
      const { data: tabularEntries, error: tabularEntriesError } = await supabase
        .from('food_entries')
        .select(`
          entry_date,
          meal_type,
          quantity,
          unit,
          foods (
            name,
            brand,
            calories,
            protein,
            carbs,
            fat,
            saturated_fat,
            polyunsaturated_fat,
            monounsaturated_fat,
            trans_fat,
            cholesterol,
            sodium,
            potassium,
            dietary_fiber,
            sugars,
            vitamin_a,
            vitamin_c,
            calcium,
            iron,
            serving_size
          )
        `)
        .eq('user_id', activeUserId)
        .gte('entry_date', startDate) // Use startDate directly
        .lte('entry_date', endDate) // Use endDate directly
        .order('entry_date', { ascending: false })
        .order('meal_type');

      if (tabularEntriesError) {
        error(loggingLevel, 'Reports: Error fetching tabular food entries:', tabularEntriesError);
        throw tabularEntriesError;
      }

      if (tabularEntries) {
        info(loggingLevel, `Reports: Fetched ${tabularEntries.length} tabular food entries.`);
        setTabularData(tabularEntries);
      }

      // Load measurement data - use activeUserId
      debug(loggingLevel, 'Reports: Fetching measurement data...');
      const { data: measurements, error: measurementsError } = await supabase
        .from('check_in_measurements')
        .select('*')
        .eq('user_id', activeUserId)
        .gte('entry_date', startDate) // Use startDate directly
        .lte('entry_date', endDate) // Use endDate directly
        .order('entry_date');

      if (measurementsError) {
        error(loggingLevel, 'Reports: Error fetching measurement data:', measurementsError);
        throw measurementsError;
      }

      if (measurements) {
        info(loggingLevel, `Reports: Fetched ${measurements.length} measurement entries.`);
        debug(loggingLevel, 'Reports: Converting measurement data with units:', {
          showWeightInKg,
          showMeasurementsInCm,
          weightUnit,
          measurementUnit
        });

        const measurementDataFormatted = measurements.map(m => ({
          date: m.entry_date,
          weight: m.weight ? convertWeight(m.weight, 'kg', showWeightInKg ? 'kg' : 'lbs') : undefined,
          neck: m.neck ? convertMeasurement(m.neck, 'cm', showMeasurementsInCm ? 'cm' : 'inches') : undefined,
          waist: m.waist ? convertMeasurement(m.waist, 'cm', showMeasurementsInCm ? 'cm' : 'inches') : undefined,
          hips: m.hips ? convertMeasurement(m.hips, 'cm', showMeasurementsInCm ? 'cm' : 'inches') : undefined,
          steps: m.steps || undefined,
        }));

        setMeasurementData(measurementDataFormatted);
        debug(loggingLevel, 'Reports: Processed measurement data.');
      }

      // Load custom categories - use activeUserId
      debug(loggingLevel, 'Reports: Fetching custom categories...');
      const { data: categories, error: categoriesError } = await supabase
        .from('custom_categories')
        .select('*')
        .eq('user_id', activeUserId)
        .order('created_at');

      if (categoriesError) {
        error(loggingLevel, 'Reports: Error fetching custom categories:', categoriesError);
        throw categoriesError;
      }

      if (categories) {
        info(loggingLevel, `Reports: Fetched ${categories.length} custom categories.`);
        setCustomCategories(categories);
        
        // Load custom measurements for each category - use activeUserId
        const customMeasurements: Record<string, CustomMeasurementData[]> = {};
        
        debug(loggingLevel, 'Reports: Fetching custom measurements for each category...');
        for (const category of categories) {
          debug(loggingLevel, `Reports: Fetching measurements for category: ${category.name} (${category.id})`);
          const { data: measurements, error: customMeasurementsError } = await supabase
            .from('custom_measurements')
            .select('*')
            .eq('user_id', activeUserId)
            .eq('category_id', category.id)
            .gte('entry_date', startDate) // Use startDate directly
            .lte('entry_date', endDate) // Use endDate directly
            .order('entry_date')
            .order('entry_timestamp');

          if (customMeasurementsError) {
            error(loggingLevel, `Reports: Error fetching custom measurements for category ${category.name}:`, customMeasurementsError);
            throw customMeasurementsError;
          }

          if (measurements) {
            debug(loggingLevel, `Reports: Fetched ${measurements.length} custom measurement entries for category ${category.name}.`);
            customMeasurements[category.id] = measurements.map(m => ({
              category_id: m.category_id,
              date: m.entry_date,
              hour: m.entry_hour,
              value: m.value,
              timestamp: m.entry_timestamp
            }));
          }
        }
        
        setCustomMeasurementsData(customMeasurements);
        debug(loggingLevel, 'Reports: Processed custom measurements data.');
      }
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
          const food = entry.foods;
          const multiplier = entry.quantity / (food.serving_size || 100);
          
          return {
            calories: total.calories + (food.calories || 0) * multiplier,
            protein: total.protein + (food.protein || 0) * multiplier,
            carbs: total.carbs + (food.carbs || 0) * multiplier,
            fat: total.fat + (food.fat || 0) * multiplier,
            saturated_fat: total.saturated_fat + (food.saturated_fat || 0) * multiplier,
            polyunsaturated_fat: total.polyunsaturated_fat + (food.polyunsaturated_fat || 0) * multiplier,
            monounsaturated_fat: total.monounsaturated_fat + (food.monounsaturated_fat || 0) * multiplier,
            trans_fat: total.trans_fat + (food.trans_fat || 0) * multiplier,
            cholesterol: total.cholesterol + (food.cholesterol || 0) * multiplier,
            sodium: total.sodium + (food.sodium || 0) * multiplier,
            potassium: total.potassium + (food.potassium || 0) * multiplier,
            dietary_fiber: total.dietary_fiber + (food.dietary_fiber || 0) * multiplier,
            sugars: total.sugars + (food.sugars || 0) * multiplier,
            vitamin_a: total.vitamin_a + (food.vitamin_a || 0) * multiplier,
            vitamin_c: total.vitamin_c + (food.vitamin_c || 0) * multiplier,
            calcium: total.calcium + (food.calcium || 0) * multiplier,
            iron: total.iron + (food.iron || 0) * multiplier,
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
            const food = entry.foods;
            const multiplier = entry.quantity / (food.serving_size || 100);
            
            csvRows.push([
              formatDateInUserTimezone(entry.entry_date, 'MMM DD, YYYY'), // Format date for display
              entry.meal_type,
              food.name,
              food.brand || '',
              entry.quantity.toString(),
              entry.unit,
              Math.round((food.calories || 0) * multiplier).toString(),
              ((food.protein || 0) * multiplier).toFixed(1),
              ((food.carbs || 0) * multiplier).toFixed(1),
              ((food.fat || 0) * multiplier).toFixed(1),
              ((food.saturated_fat || 0) * multiplier).toFixed(1),
              ((food.polyunsaturated_fat || 0) * multiplier).toFixed(1),
              ((food.monounsaturated_fat || 0) * multiplier).toFixed(1),
              ((food.trans_fat || 0) * multiplier).toFixed(1),
              ((food.cholesterol || 0) * multiplier).toFixed(1),
              ((food.sodium || 0) * multiplier).toFixed(1),
              ((food.potassium || 0) * multiplier).toFixed(1),
              ((food.dietary_fiber || 0) * multiplier).toFixed(1),
              ((food.sugars || 0) * multiplier).toFixed(1),
              ((food.vitamin_a || 0) * multiplier).toFixed(1),
              ((food.vitamin_c || 0) * multiplier).toFixed(1),
              ((food.calcium || 0) * multiplier).toFixed(1),
              ((food.iron || 0) * multiplier).toFixed(1)
            ]);
          });
          
          // Add total row
          const totals = calculateDayTotal(entries);
          csvRows.push([
            formatDateInUserTimezone(date, 'MMM DD, YYYY'), // Format date for display
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
    } catch (error) {
      error(loggingLevel, 'Reports: Error exporting food diary:', error);
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
      const { data: measurements, error: measurementsError } = await supabase
        .from('check_in_measurements')
        .select('*')
        .eq('user_id', activeUserId)
        .gte('entry_date', startDate)
        .lte('entry_date', endDate)
        .order('entry_date');

      if (measurementsError) {
        error(loggingLevel, 'Reports: Error fetching body measurements for export:', measurementsError);
        throw measurementsError;
      }

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

      const csvRows = measurements.map(measurement => [
        formatDateInUserTimezone(measurement.entry_date, 'MMM DD, YYYY'), // Format date for display
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
    } catch (error) {
      error(loggingLevel, 'Reports: Error exporting body measurements:', error);
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
          formatDateInUserTimezone(measurement.date, 'MMM DD, YYYY'), // Format date for display
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
    } catch (error) {
      error(loggingLevel, `Reports: Error exporting custom measurements for category ${category.name}:`, error);
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
        date: `${d.date} ${d.hour !== null ? String(d.hour).padStart(2, '0') + ':00' : ''}`,
        value: d.value
      }));
    } else {
      // For daily, group by date and take the latest value
      const grouped = data.reduce((acc, d) => {
        if (!acc[d.date] || new Date(d.timestamp) > new Date(acc[d.date].timestamp)) {
          acc[d.date] = d;
        }
        return acc;
      }, {} as Record<string, CustomMeasurementData>);
      
      return Object.values(grouped).map(d => ({
        date: d.date,
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
