import React, { useState, useEffect, useCallback } from 'react';
import { useActiveUser } from '@/contexts/ActiveUserContext';
import { getMeals } from '@/services/mealService';
import { Meal } from '@/types/meal';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { usePreferences } from '@/contexts/PreferencesContext';
import { error } from '@/utils/logging';

interface MealSelectionProps {
  onMealSelect: (meal: Meal) => void;
}

const MealSelection: React.FC<MealSelectionProps> = ({ onMealSelect }) => {
  const { activeUserId } = useActiveUser();
  const { loggingLevel } = usePreferences();
  const [meals, setMeals] = useState<Meal[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchMeals = useCallback(async () => {
    if (!activeUserId) return;
    setLoading(true);
    try {
      const fetchedMeals = await getMeals(activeUserId);
      setMeals(fetchedMeals || []);
    } catch (err) {
      error(loggingLevel, 'Failed to fetch meals for selection:', err);
      toast({
        title: 'Error',
        description: 'Could not load your meals.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [activeUserId, loggingLevel]);

  useEffect(() => {
    fetchMeals();
  }, [fetchMeals]);

  const filteredMeals = meals.filter(meal =>
    meal.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search your meals..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2">
        {loading ? (
          <p>Loading meals...</p>
        ) : filteredMeals.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">
            No meals found. Go to the 'Meal Management' page to create some!
          </p>
        ) : (
          filteredMeals.map(meal => (
            <Card 
              key={meal.id} 
              className="cursor-pointer hover:bg-accent"
              onClick={() => onMealSelect(meal)}
            >
              <CardContent className="p-3">
                <p className="font-semibold">{meal.name}</p>
                {meal.description && (
                  <p className="text-sm text-muted-foreground">{meal.description}</p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default MealSelection;