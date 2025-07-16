
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Goals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  dietary_fiber: number;
}

interface DayTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  dietary_fiber: number;
}

interface NutritionSummaryProps {
  dayTotals: DayTotals;
  goals: Goals;
  selectedDate: string;
}

const NutritionSummary = ({ dayTotals, goals, selectedDate }: NutritionSummaryProps) => {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Nutrition Summary</CardTitle>
      </CardHeader>
      <CardContent className="pt-2 pb-3">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="text-center">
            <div className="text-lg sm:text-xl font-bold">{Math.round(dayTotals.calories)}</div>
            <div className="text-xs text-gray-500">of {goals.calories} cal</div>
            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
              <div
                className="bg-green-500 h-1.5 rounded-full"
                style={{ width: `${Math.min((dayTotals.calories / goals.calories) * 100, 100)}%` }}
              />
            </div>
          </div>
          <div className="text-center">
            <div className="text-lg sm:text-xl font-bold text-blue-600">{dayTotals.protein.toFixed(1)}g</div>
            <div className="text-xs text-gray-500">of {goals.protein}g protein</div>
            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
              <div
                className="bg-blue-500 h-1.5 rounded-full"
                style={{ width: `${Math.min((dayTotals.protein / goals.protein) * 100, 100)}%` }}
              />
            </div>
          </div>
          <div className="text-center">
            <div className="text-lg sm:text-xl font-bold text-orange-600">{dayTotals.carbs.toFixed(1)}g</div>
            <div className="text-xs text-gray-500">of {goals.carbs}g carbs</div>
            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
              <div
                className="bg-orange-500 h-1.5 rounded-full"
                style={{ width: `${Math.min((dayTotals.carbs / goals.carbs) * 100, 100)}%` }}
              />
            </div>
          </div>
          <div className="text-center">
            <div className="text-lg sm:text-xl font-bold text-yellow-600">{dayTotals.fat.toFixed(1)}g</div>
            <div className="text-xs text-gray-500">of {goals.fat}g fat</div>
            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
              <div
                className="bg-yellow-500 h-1.5 rounded-full"
                style={{ width: `${Math.min((dayTotals.fat / goals.fat) * 100, 100)}%` }}
              />
            </div>
          </div>
          <div className="text-center">
            <div className="text-lg sm:text-xl font-bold text-green-600">{dayTotals.dietary_fiber.toFixed(1)}g</div>
            <div className="text-xs text-gray-500">of {goals.dietary_fiber}g fiber</div>
            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
              <div
                className="bg-green-500 h-1.5 rounded-full"
                style={{ width: `${Math.min((dayTotals.dietary_fiber / goals.dietary_fiber) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default NutritionSummary;
