import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

interface ExpandedGoals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  water_goal: number;
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

const GoalsSettings = () => {
  const { user } = useAuth();
  const [goals, setGoals] = useState<ExpandedGoals>({
    calories: 2000,
    protein: 150,
    carbs: 250,
    fat: 67,
    water_goal: 8,
    saturated_fat: 20,
    polyunsaturated_fat: 10,
    monounsaturated_fat: 25,
    trans_fat: 0,
    cholesterol: 300,
    sodium: 2300,
    potassium: 3500,
    dietary_fiber: 25,
    sugars: 50,
    vitamin_a: 900,
    vitamin_c: 90,
    calcium: 1000,
    iron: 18
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      loadGoals();
    }
  }, [user]);

  const loadGoals = async () => {
    try {
      setLoading(true);
      
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase.rpc('get_goals_for_date', {
        p_user_id: user?.id,
        p_date: today
      });

      if (error) {
        console.error('Error loading goals:', error);
        return;
      }

      if (data && data.length > 0) {
        const goalData = data[0];
        setGoals({
          calories: goalData.calories || 2000,
          protein: goalData.protein || 150,
          carbs: goalData.carbs || 250,
          fat: goalData.fat || 67,
          water_goal: goalData.water_goal || 8,
          saturated_fat: goalData.saturated_fat || 20,
          polyunsaturated_fat: goalData.polyunsaturated_fat || 10,
          monounsaturated_fat: goalData.monounsaturated_fat || 25,
          trans_fat: goalData.trans_fat || 0,
          cholesterol: goalData.cholesterol || 300,
          sodium: goalData.sodium || 2300,
          potassium: goalData.potassium || 3500,
          dietary_fiber: goalData.dietary_fiber || 25,
          sugars: goalData.sugars || 50,
          vitamin_a: goalData.vitamin_a || 900,
          vitamin_c: goalData.vitamin_c || 90,
          calcium: goalData.calcium || 1000,
          iron: goalData.iron || 18
        });
      }
    } catch (error) {
      console.error('Error loading goals:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveGoals = async () => {
    if (!user) return;

    try {
      setSaving(true);
      
      const today = new Date().toISOString().split('T')[0];
      
      const { error } = await supabase.rpc('manage_goal_timeline', {
        p_user_id: user.id,
        p_start_date: today,
        p_calories: goals.calories,
        p_protein: goals.protein,
        p_carbs: goals.carbs,
        p_fat: goals.fat,
        p_water_goal: goals.water_goal,
        p_saturated_fat: goals.saturated_fat,
        p_polyunsaturated_fat: goals.polyunsaturated_fat,
        p_monounsaturated_fat: goals.monounsaturated_fat,
        p_trans_fat: goals.trans_fat,
        p_cholesterol: goals.cholesterol,
        p_sodium: goals.sodium,
        p_potassium: goals.potassium,
        p_dietary_fiber: goals.dietary_fiber,
        p_sugars: goals.sugars,
        p_vitamin_a: goals.vitamin_a,
        p_vitamin_c: goals.vitamin_c,
        p_calcium: goals.calcium,
        p_iron: goals.iron
      });

      if (error) {
        console.error('Error saving goals with cascade:', error);
        toast({
          title: "Error",
          description: "Failed to save goals",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Goals updated and will apply for the next 6 months (or until your next future goal)",
      });
      
      await loadGoals();
    } catch (error) {
      console.error('Error saving goals:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return <div>Please sign in to manage your goals.</div>;
  }

  if (loading) {
    return <div>Loading goals...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Goals Settings</h2>
        <Badge variant="outline" className="text-lg px-3 py-1">
          <Target className="w-4 h-4 mr-2" />
          Cascading Goals
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            Daily Nutrition Goals
            <div className="text-sm font-normal text-gray-600 ml-2">
              (Changes cascade for 6 months from today or until your next future goal)
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Primary Macros */}
            <div>
              <Label htmlFor="calories">Calories</Label>
              <Input
                id="calories"
                type="number"
                value={goals.calories}
                onChange={(e) => setGoals({ ...goals, calories: Number(e.target.value) })}
              />
            </div>
            
            <div>
              <Label htmlFor="protein">Protein (g)</Label>
              <Input
                id="protein"
                type="number"
                value={goals.protein}
                onChange={(e) => setGoals({ ...goals, protein: Number(e.target.value) })}
              />
            </div>
            
            <div>
              <Label htmlFor="carbs">Carbohydrates (g)</Label>
              <Input
                id="carbs"
                type="number"
                value={goals.carbs}
                onChange={(e) => setGoals({ ...goals, carbs: Number(e.target.value) })}
              />
            </div>
            
            <div>
              <Label htmlFor="fat">Fat (g)</Label>
              <Input
                id="fat"
                type="number"
                value={goals.fat}
                onChange={(e) => setGoals({ ...goals, fat: Number(e.target.value) })}
              />
            </div>

            {/* Fat Types */}
            <div>
              <Label htmlFor="saturated_fat">Saturated Fat (g)</Label>
              <Input
                id="saturated_fat"
                type="number"
                value={goals.saturated_fat}
                onChange={(e) => setGoals({ ...goals, saturated_fat: Number(e.target.value) })}
              />
            </div>

            <div>
              <Label htmlFor="polyunsaturated_fat">Polyunsaturated Fat (g)</Label>
              <Input
                id="polyunsaturated_fat"
                type="number"
                value={goals.polyunsaturated_fat}
                onChange={(e) => setGoals({ ...goals, polyunsaturated_fat: Number(e.target.value) })}
              />
            </div>

            <div>
              <Label htmlFor="monounsaturated_fat">Monounsaturated Fat (g)</Label>
              <Input
                id="monounsaturated_fat"
                type="number"
                value={goals.monounsaturated_fat}
                onChange={(e) => setGoals({ ...goals, monounsaturated_fat: Number(e.target.value) })}
              />
            </div>

            <div>
              <Label htmlFor="trans_fat">Trans Fat (g)</Label>
              <Input
                id="trans_fat"
                type="number"
                value={goals.trans_fat}
                onChange={(e) => setGoals({ ...goals, trans_fat: Number(e.target.value) })}
              />
            </div>

            {/* Other Nutrients */}
            <div>
              <Label htmlFor="cholesterol">Cholesterol (mg)</Label>
              <Input
                id="cholesterol"
                type="number"
                value={goals.cholesterol}
                onChange={(e) => setGoals({ ...goals, cholesterol: Number(e.target.value) })}
              />
            </div>

            <div>
              <Label htmlFor="sodium">Sodium (mg)</Label>
              <Input
                id="sodium"
                type="number"
                value={goals.sodium}
                onChange={(e) => setGoals({ ...goals, sodium: Number(e.target.value) })}
              />
            </div>

            <div>
              <Label htmlFor="potassium">Potassium (mg)</Label>
              <Input
                id="potassium"
                type="number"
                value={goals.potassium}
                onChange={(e) => setGoals({ ...goals, potassium: Number(e.target.value) })}
              />
            </div>

            <div>
              <Label htmlFor="dietary_fiber">Dietary Fiber (g)</Label>
              <Input
                id="dietary_fiber"
                type="number"
                value={goals.dietary_fiber}
                onChange={(e) => setGoals({ ...goals, dietary_fiber: Number(e.target.value) })}
              />
            </div>

            <div>
              <Label htmlFor="sugars">Sugars (g)</Label>
              <Input
                id="sugars"
                type="number"
                value={goals.sugars}
                onChange={(e) => setGoals({ ...goals, sugars: Number(e.target.value) })}
              />
            </div>

            {/* Vitamins and Minerals */}
            <div>
              <Label htmlFor="vitamin_a">Vitamin A (mcg)</Label>
              <Input
                id="vitamin_a"
                type="number"
                value={goals.vitamin_a}
                onChange={(e) => setGoals({ ...goals, vitamin_a: Number(e.target.value) })}
              />
            </div>

            <div>
              <Label htmlFor="vitamin_c">Vitamin C (mg)</Label>
              <Input
                id="vitamin_c"
                type="number"
                value={goals.vitamin_c}
                onChange={(e) => setGoals({ ...goals, vitamin_c: Number(e.target.value) })}
              />
            </div>

            <div>
              <Label htmlFor="calcium">Calcium (mg)</Label>
              <Input
                id="calcium"
                type="number"
                value={goals.calcium}
                onChange={(e) => setGoals({ ...goals, calcium: Number(e.target.value) })}
              />
            </div>

            <div>
              <Label htmlFor="iron">Iron (mg)</Label>
              <Input
                id="iron"
                type="number"
                value={goals.iron}
                onChange={(e) => setGoals({ ...goals, iron: Number(e.target.value) })}
              />
            </div>
            
            <div>
              <Label htmlFor="water">Water Goal (glasses)</Label>
              <Input
                id="water"
                type="number"
                value={goals.water_goal}
                onChange={(e) => setGoals({ ...goals, water_goal: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="mt-6">
            <Button 
              onClick={saveGoals} 
              className="w-full" 
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Goals'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GoalsSettings;
