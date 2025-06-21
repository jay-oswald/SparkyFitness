
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { usePreferences } from "@/contexts/PreferencesContext"; // Import usePreferences
import { debug, info, warn, error } from '@/utils/logging'; // Import logging utility

interface FoodVariant {
  id: string;
  serving_size: number;
  serving_unit: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

interface FoodUnitSelectorProps {
  food: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (food: any, quantity: number, unit: string, variantId?: string) => void;
}

const FoodUnitSelector = ({ food, open, onOpenChange, onSelect }: FoodUnitSelectorProps) => {
  const { loggingLevel } = usePreferences(); // Get logging level
  debug(loggingLevel, "FoodUnitSelector component rendered.", { food, open });
  const [variants, setVariants] = useState<FoodVariant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<FoodVariant | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    debug(loggingLevel, "FoodUnitSelector open/food useEffect triggered.", { open, food });
    if (open && food) {
      loadVariants();
      setQuantity(1); // Reset quantity when dialog opens
    }
  }, [open, food]);

  const loadVariants = async () => {
    debug(loggingLevel, "Loading food variants for food ID:", food?.id);
    setLoading(true);
    try {

      const { data, error: supabaseError } = await supabase
        .from('food_variants')
        .select('*')
        .eq('food_id', food.id);

      if (supabaseError) {
        error(loggingLevel, 'Error loading variants:', supabaseError);
      }


      if (data && data.length > 0) {
        info(loggingLevel, "Food variants loaded successfully:", data);
        const variantsWithNutrition = data.map(variant => ({
          id: variant.id,
          serving_size: variant.serving_size,
          serving_unit: variant.serving_unit,
          calories: variant.calories || 0,
          protein: variant.protein || 0,
          carbs: variant.carbs || 0,
          fat: variant.fat || 0
        }));
        setVariants(variantsWithNutrition);
        setSelectedVariant(variantsWithNutrition[0]);
      } else {
        info(loggingLevel, "No variants found, falling back to default food unit.");
        // Fallback to default food unit
        const defaultVariant = {
          id: '',
          serving_size: food.serving_size || 100,
          serving_unit: food.serving_unit || 'g',
          calories: food.calories || 0,
          protein: food.protein || 0,
          carbs: food.carbs || 0,
          fat: food.fat || 0
        };
        setVariants([defaultVariant]);
        setSelectedVariant(defaultVariant);
      }
    } catch (err) {
      error(loggingLevel, 'Error loading variants:', err);
      // Fallback to default food unit on error
      const defaultVariant = {
        id: '',
        serving_size: food.serving_size || 100,
        serving_unit: food.serving_unit || 'g',
        calories: food.calories || 0,
        protein: food.protein || 0,
        carbs: food.carbs || 0,
        fat: food.fat || 0
      };
      setVariants([defaultVariant]);
      setSelectedVariant(defaultVariant);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    debug(loggingLevel, "Handling submit.");
    if (selectedVariant) {
      info(loggingLevel, 'Submitting food selection:', {
        food,
        quantity,
        unit: selectedVariant.serving_unit,
        variantId: selectedVariant.id || undefined
      });

      // Fix: Pass the total quantity (quantity * serving_size) as the quantity
      // This ensures the calculation in other components is correct
      const totalQuantity = quantity * selectedVariant.serving_size;

      onSelect(food, totalQuantity, selectedVariant.serving_unit, selectedVariant.id || undefined);
      onOpenChange(false);
      setQuantity(1);
    } else {
      warn(loggingLevel, "Submit called with no selected variant.");
    }
  };

  const calculateNutrition = () => {
    debug(loggingLevel, "Calculating nutrition.");
    if (!selectedVariant) {
      warn(loggingLevel, "calculateNutrition called with no selected variant.");
      return null;
    }

    info(loggingLevel, 'Calculating nutrition for:', {
      selectedVariant,
      quantity
    });

    // Fix: Use the food's base nutrition values and calculate based on the actual serving
    // The selectedVariant represents one unit (e.g., 100g), so we multiply by quantity
    const baseFoodServingSize = food.serving_size || 100;
    const variantServingSize = selectedVariant.serving_size;

    // Calculate ratio: how much of the base food serving does this variant represent?
    const variantRatio = variantServingSize / baseFoodServingSize;
    debug(loggingLevel, "Calculated variant ratio:", variantRatio);

    // Then multiply by quantity to get total nutrition
    const result = {
      calories: (food.calories * variantRatio * quantity) || 0,
      protein: (food.protein * variantRatio * quantity) || 0,
      carbs: (food.carbs * variantRatio * quantity) || 0,
      fat: (food.fat * variantRatio * quantity) || 0,
    };
    debug(loggingLevel, "Calculated nutrition result:", result);

    return result;
  };

  const nutrition = calculateNutrition();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add {food?.name} to Meal</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div>Loading units...</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={quantity}
                  onChange={(e) => {
                    const newQuantity = Number(e.target.value);
                    debug(loggingLevel, "Quantity changed:", newQuantity);
                    setQuantity(newQuantity);
                  }}
                />
              </div>
              <div>
                <Label htmlFor="unit">Unit</Label>
                <Select
                  value={selectedVariant?.id || 'default'}
                  onValueChange={(value) => {
                    debug(loggingLevel, "Unit selected:", value);
                    const variant = variants.find(v => (v.id || 'default') === value);
                    setSelectedVariant(variant || null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {variants.map((variant) => (
                      <SelectItem key={variant.id || 'default'} value={variant.id || 'default'}>
                        {variant.serving_size} {variant.serving_unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {nutrition && selectedVariant && (
              <div className="bg-gray-50 p-3 rounded-lg">
                <h4 className="font-medium mb-2">Nutrition for {quantity} × {selectedVariant.serving_size} {selectedVariant.serving_unit}:</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>{nutrition.calories.toFixed(1)} calories</div>
                  <div>{nutrition.protein.toFixed(1)}g protein</div>
                  <div>{nutrition.carbs.toFixed(1)}g carbs</div>
                  <div>{nutrition.fat.toFixed(1)}g fat</div>
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={!selectedVariant}>
                Add to Meal
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default FoodUnitSelector;
