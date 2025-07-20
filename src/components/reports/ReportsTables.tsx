
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download } from "lucide-react";
import { usePreferences } from "@/contexts/PreferencesContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { debug, info, warn, error } from "@/utils/logging";
import { parseISO } from "date-fns";
import { formatNutrientValue, getNutrientUnit } from '@/lib/utils';

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

interface MeasurementData {
  entry_date: string; // Changed from 'date' to 'entry_date'
  weight?: number;
  neck?: number;
  waist?: number;
  hips?: number;
  steps?: number;
}

interface CustomCategory {
  id: string;
  name: string;
  measurement_type: string;
  frequency: string;
}

interface CustomMeasurementData {
  category_id: string;
  entry_date: string; // Changed from 'date' to 'entry_date'
  hour?: number;
  value: number;
  timestamp: string;
}

interface ReportsTablesProps {
  tabularData: DailyFoodEntry[];
  measurementData: MeasurementData[];
  customCategories: CustomCategory[];
  customMeasurementsData: Record<string, CustomMeasurementData[]>;
  showWeightInKg: boolean;
  showMeasurementsInCm: boolean;
  onExportFoodDiary: () => void;
  onExportBodyMeasurements: () => void;
  onExportCustomMeasurements: (category: CustomCategory) => void;
}

const ReportsTables = ({
  tabularData,
  measurementData,
  customCategories,
  customMeasurementsData,
  showWeightInKg,
  showMeasurementsInCm,
  onExportFoodDiary,
  onExportBodyMeasurements,
  onExportCustomMeasurements,
}: ReportsTablesProps) => {
  const { loggingLevel, dateFormat, formatDateInUserTimezone, nutrientDisplayPreferences } = usePreferences();
  const isMobile = useIsMobile();
  const platform = isMobile ? 'mobile' : 'desktop';
  const reportTabularPreferences = nutrientDisplayPreferences.find(p => p.view_group === 'report_tabular' && p.platform === platform);
  const visibleNutrients = reportTabularPreferences ? reportTabularPreferences.visible_nutrients : ['calories', 'protein', 'carbs', 'fat'];

  info(loggingLevel, 'ReportsTables: Rendering component.');

  // Sort tabular data by date descending, then by meal type
  debug(loggingLevel, 'ReportsTables: Sorting tabular data.');
  const sortedTabularData = [...tabularData].sort((a, b) => {
    const dateCompare = new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime();
    if (dateCompare !== 0) return dateCompare;
    
    const mealOrder = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 };
    return (mealOrder[a.meal_type] || 4) - (mealOrder[b.meal_type] || 4);
  });

  // Sort measurement data by date descending
  debug(loggingLevel, 'ReportsTables: Sorting measurement data.');
  const sortedMeasurementData = [...measurementData]
    .filter(measurement =>
      measurement.weight !== undefined ||
      measurement.neck !== undefined ||
      measurement.waist !== undefined ||
      measurement.hips !== undefined ||
      measurement.steps !== undefined
    )
    .sort((a, b) =>
      new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime()
    );

  // Group food entries by date and calculate daily totals
  debug(loggingLevel, 'ReportsTables: Grouping food data by date and calculating totals.');
  const groupedFoodData = sortedTabularData.reduce((acc, entry) => {
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

  // Create flattened data with totals for rendering
  debug(loggingLevel, 'ReportsTables: Creating flattened food data with totals.');
  const foodDataWithTotals: (DailyFoodEntry & { isTotal?: boolean })[] = [];
  Object.keys(groupedFoodData)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
    .forEach(date => {
      const entries = groupedFoodData[date];
      foodDataWithTotals.push(...entries);
      
      // Add total row
      const totals = calculateDayTotal(entries);
      foodDataWithTotals.push({
        entry_date: date,
        meal_type: 'Total',
        quantity: 0,
        unit: '',
        isTotal: true,
        foods: {
          name: '',
          calories: totals.calories,
          protein: totals.protein,
          carbs: totals.carbs,
          fat: totals.fat,
          saturated_fat: totals.saturated_fat,
          polyunsaturated_fat: totals.polyunsaturated_fat,
          monounsaturated_fat: totals.monounsaturated_fat,
          trans_fat: totals.trans_fat,
          cholesterol: totals.cholesterol,
          sodium: totals.sodium,
          potassium: totals.potassium,
          dietary_fiber: totals.dietary_fiber,
          sugars: totals.sugars,
          vitamin_a: totals.vitamin_a,
          vitamin_c: totals.vitamin_c,
          calcium: totals.calcium,
          iron: totals.iron,
          serving_size: 100
        }
      });
    });
  debug(loggingLevel, `ReportsTables: Generated ${foodDataWithTotals.length} rows for food diary table.`);

  return (
    <div className="space-y-6">
      {/* Food Diary Table with Export Button */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Food Diary Table</CardTitle>
            <Button
              onClick={onExportFoodDiary}
              variant="outline"
              size="sm"
            >
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Meal</TableHead>
                  <TableHead className="min-w-[250px]">Food</TableHead>
                  <TableHead>Quantity</TableHead>
                  {visibleNutrients.map(nutrient => (
                    <TableHead key={nutrient}>{nutrient.replace(/_/g, ' ')} ({getNutrientUnit(nutrient)})</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {foodDataWithTotals.map((entry, index) => {
                  const food = entry.foods;
                  const multiplier = entry.isTotal ? 1 : entry.quantity / (food.serving_size || 100);

                  return (
                    <TableRow key={index} className={entry.isTotal ? "bg-gray-50 font-semibold border-t-2" : ""}>
                      <TableCell>{formatDateInUserTimezone(parseISO(entry.entry_date), dateFormat)}</TableCell>
                      <TableCell className="capitalize">{entry.meal_type}</TableCell>
                      <TableCell className="min-w-[250px]">
                        {!entry.isTotal && (
                          <div>
                            <div className="font-medium">{food.name}</div>
                            {food.brand && <div className="text-sm text-gray-500">{food.brand}</div>}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{entry.isTotal ? '' : `${entry.quantity} ${entry.unit}`}</TableCell>
                      {visibleNutrients.map(nutrient => {
                        const value = (food[nutrient as keyof typeof food] as number || 0) * multiplier;
                        return <TableCell key={nutrient}>{formatNutrientValue(value, nutrient)}</TableCell>
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Body Measurements Table with Export Button */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Body Measurements Table</CardTitle>
            <Button
              onClick={onExportBodyMeasurements}
              variant="outline"
              size="sm"
            >
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Weight ({showWeightInKg ? 'kg' : 'lbs'})</TableHead>
                  <TableHead>Neck ({showMeasurementsInCm ? 'cm' : 'inches'})</TableHead>
                  <TableHead>Waist ({showMeasurementsInCm ? 'cm' : 'inches'})</TableHead>
                  <TableHead>Hips ({showMeasurementsInCm ? 'cm' : 'inches'})</TableHead>
                  <TableHead>Steps</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedMeasurementData.map((measurement, index) => (
                  <TableRow key={index}>
                    <TableCell>{formatDateInUserTimezone(parseISO(measurement.entry_date), dateFormat)}</TableCell>
                    <TableCell>{measurement.weight ? measurement.weight.toFixed(1) : '-'}</TableCell>
                    <TableCell>{measurement.neck ? measurement.neck.toFixed(1) : '-'}</TableCell>
                    <TableCell>{measurement.waist ? measurement.waist.toFixed(1) : '-'}</TableCell>
                    <TableCell>{measurement.hips ? measurement.hips.toFixed(1) : '-'}</TableCell>
                    <TableCell>{measurement.steps || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Custom Measurements Tables */}
      {customCategories.map((category) => {
        const data = customMeasurementsData[category.id] || [];
        // Sort by timestamp descending (latest first)
        debug(loggingLevel, `ReportsTables: Sorting custom measurement data for category: ${category.name}.`);
        const sortedData = [...data].sort((a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        
        return (
          <Card key={category.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{category.name} ({category.measurement_type})</CardTitle>
                <Button
                  onClick={() => onExportCustomMeasurements(category)}
                  variant="outline"
                  size="sm"
                >
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Hour</TableHead>
                      <TableHead>Value ({category.measurement_type})</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedData.map((measurement, index) => {
                      // Extract hour from timestamp
                      const timestamp = parseISO(measurement.timestamp);
                      const hour = timestamp.getHours();
                      const formattedHour = `${hour.toString().padStart(2, '0')}:00`;
                      
                      return (
                        <TableRow key={index}>
                          <TableCell>{measurement.entry_date && !isNaN(parseISO(measurement.entry_date).getTime()) ? formatDateInUserTimezone(parseISO(measurement.entry_date), dateFormat) : ''}</TableCell>
                          <TableCell>{formattedHour}</TableCell>
                          <TableCell>{measurement.value}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default ReportsTables;
