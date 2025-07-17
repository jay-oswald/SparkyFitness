
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import EditGoals from "./EditGoals";
import WaterIntake from "./WaterIntake";
import DailyProgress from "./DailyProgress";
import MiniNutritionTrends from "./MiniNutritionTrends";
import { usePreferences } from "@/contexts/PreferencesContext"; // Import usePreferences
import { debug, info, warn, error } from '@/utils/logging'; // Import logging utility

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

interface DiaryTopControlsProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  dayTotals?: DayTotals;
  goals?: Goals;
  onGoalsUpdated?: () => void;
  refreshTrigger?: number;
}

const DiaryTopControls = ({
  selectedDate,
  onDateChange,
  dayTotals = { calories: 0, protein: 0, carbs: 0, fat: 0, dietary_fiber: 0 },
  goals = { calories: 2000, protein: 150, carbs: 250, fat: 67, dietary_fiber: 25 },
  onGoalsUpdated = () => {},
  refreshTrigger = 0
}: DiaryTopControlsProps) => {
  const { loggingLevel } = usePreferences(); // Get logging level
  debug(loggingLevel, "DiaryTopControls component rendered.", { selectedDate, dayTotals, goals, refreshTrigger });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      {/* Left Column - Daily Calorie Goal (20% width) */}
      <div className="lg:col-span-1 space-y-4 h-full">
        <DailyProgress
          selectedDate={selectedDate}
          refreshTrigger={refreshTrigger}
        />
      </div>

      {/* Middle Column - Nutrition Summary with Edit Goals and Micro Charts (60% width) */}
      <div className="lg:col-span-3 h-full">
        <Card className="h-full">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Nutrition Summary</CardTitle>
              <EditGoals
                selectedDate={selectedDate}
                onGoalsUpdated={onGoalsUpdated}
              />
            </div>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="text-center">
                <div className="text-xl font-bold">{Math.round(Number(dayTotals.calories))}</div>
                <div className="text-xs text-gray-500">of {goals && goals.calories ? Math.round(Number(goals.calories)) : 0} cal</div>
                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                  <div
                    className="bg-green-500 h-1.5 rounded-full"
                    style={{ width: `${goals.calories ? Math.min((Number(dayTotals.calories) / Number(goals.calories)) * 100, 100) : 0}%` }}
                  />
                </div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-blue-600">{Number(dayTotals.protein).toFixed(1)}g</div>
                <div className="text-xs text-gray-500">of {goals && goals.protein ? Number(goals.protein).toFixed(1) : '0.0'}g protein</div>
                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full"
                    style={{ width: `${goals.protein ? Math.min((Number(dayTotals.protein) / Number(goals.protein)) * 100, 100) : 0}%` }}
                  />
                </div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-orange-600">{Number(dayTotals.carbs).toFixed(1)}g</div>
                <div className="text-xs text-gray-500">of {goals && goals.carbs ? Number(goals.carbs).toFixed(1) : '0.0'}g carbs</div>
                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                  <div
                    className="bg-orange-500 h-1.5 rounded-full"
                    style={{ width: `${goals.carbs ? Math.min((Number(dayTotals.carbs) / Number(goals.carbs)) * 100, 100) : 0}%` }}
                  />
                </div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-yellow-600">{Number(dayTotals.fat).toFixed(1)}g</div>
                <div className="text-xs text-gray-500">of {goals && goals.fat ? Number(goals.fat).toFixed(1) : '0.0'}g fat</div>
                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                  <div
                    className="bg-yellow-500 h-1.5 rounded-full"
                    style={{ width: `${goals.fat ? Math.min((Number(dayTotals.fat) / Number(goals.fat)) * 100, 100) : 0}%` }}
                  />
                </div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-green-600">{Number(dayTotals.dietary_fiber).toFixed(1)}g</div>
                <div className="text-xs text-gray-500">of {goals && goals.dietary_fiber ? Number(goals.dietary_fiber).toFixed(1) : '0.0'}g fiber</div>
                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                  <div
                    className="bg-green-500 h-1.5 rounded-full"
                    style={{ width: `${goals.dietary_fiber ? Math.min((Number(dayTotals.dietary_fiber) / Number(goals.dietary_fiber)) * 100, 100) : 0}%` }}
                  />
                </div>
              </div>
            </div>
            <MiniNutritionTrends selectedDate={selectedDate} refreshTrigger={refreshTrigger} />
          </CardContent>
        </Card>
      </div>

      {/* Right Column - Water Intake (20% width) */}
      <div className="lg:col-span-1 h-full">
        <WaterIntake selectedDate={selectedDate} />
      </div>
    </div>
  );
};

export default DiaryTopControls;
