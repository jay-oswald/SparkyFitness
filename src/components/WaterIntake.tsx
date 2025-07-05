
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Droplet } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

// Define the base URL for your backend API
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3010";

interface WaterIntakeProps {
  selectedDate: string;
}

const WaterIntake = ({ selectedDate }: WaterIntakeProps) => {
  const { user } = useAuth();
  const [waterGlasses, setWaterGlasses] = useState(0);
  const [waterGoal, setWaterGoal] = useState(8);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadWaterData();
    }

    const handleRefresh = () => {
      loadWaterData();
    };

    window.addEventListener('measurementsRefresh', handleRefresh);
    window.addEventListener('foodDiaryRefresh', handleRefresh); // Also listen for food diary refresh as it impacts overall progress

    return () => {
      window.removeEventListener('measurementsRefresh', handleRefresh);
      window.removeEventListener('foodDiaryRefresh', handleRefresh);
    };
  }, [user, selectedDate]);

  const loadWaterData = async () => {
    try {
      
      // Load water goal for selected date
      const goalResponse = await fetch(`${API_BASE_URL}/api/goals/for-date?userId=${user?.id}&date=${selectedDate}`);
      if (!goalResponse.ok) {
        console.error('Error loading water goal:', await goalResponse.json());
        setWaterGoal(8);
      }
      const goalData = await goalResponse.json();

      if (goalData && goalData.length > 0) {
        setWaterGoal(goalData[0].water_goal || 8);
      }

      // Load water intake for selected date - get all records and sum them
      const waterResponse = await fetch(`${API_BASE_URL}/api/water-intake/${user?.id}/${selectedDate}`);
      if (!waterResponse.ok) {
        console.error('Error loading water intake:', await waterResponse.json());
        setWaterGlasses(0);
        return;
      }
      const waterData = await waterResponse.json();


      if (waterData && waterData.length > 0) {
        // Sum all glasses consumed for the day
        const totalGlasses = waterData.reduce((sum, record) => sum + record.glasses_consumed, 0);
        setWaterGlasses(totalGlasses);
      } else {
        setWaterGlasses(0);
      }
    } catch (error) {
      console.error('Error loading water data:', error);
      setWaterGlasses(0);
    }
  };

  const saveWaterIntake = async (newGlasses: number) => {
    if (!user) return;

    try {
      setLoading(true);

      // Use upsert for atomic update/insert
      const response = await fetch(`${API_BASE_URL}/api/water-intake`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user.id,
          entry_date: selectedDate,
          glasses_consumed: newGlasses,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error saving water intake:', errorData);
        toast({
          title: "Error",
          description: "Failed to save water intake",
          variant: "destructive",
        });
        return;
      }


      toast({
        title: "Success",
        description: "Water intake updated",
      });
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "Failed to save water intake",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const adjustWater = async (change: number) => {
    const newValue = Math.max(0, waterGlasses + change);
    setWaterGlasses(newValue);
    await saveWaterIntake(newValue);
  };

  if (!user) {
    return null;
  }

  const fillPercentage = Math.min((waterGlasses / waterGoal) * 100, 100);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center text-base">
          <Droplet className="w-4 h-4 mr-2" />
          Water Intake
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-between p-3">
        {/* Water count display */}
        <div className="text-center mb-3">
          <div className="text-xl font-bold">
            {waterGlasses} / {waterGoal}
          </div>
          <div className="text-gray-500 text-xs">glasses of water</div>
        </div>
        
        {/* Water Bottle Visualization - takes up most space */}
        <div className="flex-1 flex items-center justify-center mb-3">
          <div className="relative flex flex-col items-center">
            {/* Bottle Cap */}
            <div className="w-5 h-1.5 bg-blue-400 rounded-t-sm mb-0.5"></div>
            
            {/* Bottle Neck */}
            <div className="w-7 h-5 bg-gray-100 border-2 border-blue-400 rounded-sm mb-0.5"></div>
            
            {/* Main Bottle Body */}
            <div className="relative w-16 h-32 border-3 border-blue-400 rounded-xl bg-gray-50 overflow-hidden">
              {/* Water Fill */}
              <div
                className="absolute bottom-0 w-full bg-gradient-to-t from-blue-500 via-blue-400 to-blue-300 transition-all duration-700 ease-out rounded-b-xl"
                style={{ height: `${fillPercentage}%` }}
              >
                {/* Water Surface Ripple Effect */}
                {fillPercentage > 0 && (
                  <div className="absolute top-0 w-full h-0.5 bg-blue-200 opacity-60 animate-pulse"></div>
                )}
              </div>
              
              {/* Bottle Highlight */}
              <div className="absolute top-3 left-2 w-2.5 h-10 bg-white opacity-30 rounded-full"></div>
              
              {/* Water Level Lines */}
              <div className="absolute inset-0 flex flex-col justify-between p-0.5">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="w-full h-px bg-blue-200 opacity-40"></div>
                ))}
              </div>
            </div>
            
            {/* Progress Percentage */}
            <div className="text-xs text-gray-600 mt-1.5 font-medium">
              {Math.round(fillPercentage)}%
            </div>
          </div>
        </div>
        
        {/* Water Control Buttons */}
        <div className="flex justify-center space-x-2">
          <Button
            variant="outline"
            onClick={() => adjustWater(-1)}
            disabled={waterGlasses === 0 || loading}
            size="sm"
            className="w-9 h-7 text-xs"
          >
            -1
          </Button>
          <Button
            onClick={() => adjustWater(1)}
            disabled={loading}
            size="sm"
            className="w-9 h-7 text-xs"
          >
            +1
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default WaterIntake;
