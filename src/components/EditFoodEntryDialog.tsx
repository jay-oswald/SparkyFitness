import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { usePreferences } from "@/contexts/PreferencesContext"; // Import usePreferences
import { debug, info, warn, error } from '@/utils/logging'; // Import logging utility
import {
  loadFoodVariants,
  updateFoodEntry,
} from '@/services/editFoodEntryService';
import { FoodVariant, FoodEntry } from '@/types/food';



interface EditFoodEntryDialogProps {
  entry: FoodEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}

const EditFoodEntryDialog = ({ entry, open, onOpenChange, onSave }: EditFoodEntryDialogProps) => {
  const { loggingLevel } = usePreferences(); // Get logging level
  debug(loggingLevel, "EditFoodEntryDialog component rendered.", { entry, open });
  const [quantity, setQuantity] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState<FoodVariant | null>(null);
  const [variants, setVariants] = useState<FoodVariant[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    debug(loggingLevel, "EditFoodEntryDialog entry/open useEffect triggered.", { entry, open });
    if (entry && open) {
      setQuantity(entry.quantity || 1);
      loadVariants();
    }
  }, [entry, open]);

  const loadVariants = async () => {
    debug(loggingLevel, "Loading food variants for food ID:", entry?.food_id);
    if (!entry) {
      warn(loggingLevel, "loadVariants called with no entry.");
      return;
    }

    setLoading(true);
    try {
      const data = await loadFoodVariants(entry.food_id);

      // The primary unit is now the food_variants object directly from the entry
      const primaryUnit: FoodVariant = {
        id: entry.food_variants?.id || entry.food_id, // Use variant ID if available, otherwise food ID
        serving_size: entry.food_variants?.serving_size || 100,
        serving_unit: entry.food_variants?.serving_unit || 'g',
        calories: entry.food_variants?.calories || 0,
        protein: entry.food_variants?.protein || 0,
        carbs: entry.food_variants?.carbs || 0,
        fat: entry.food_variants?.fat || 0,
        saturated_fat: entry.food_variants?.saturated_fat || 0,
        polyunsaturated_fat: entry.food_variants?.polyunsaturated_fat || 0,
        monounsaturated_fat: entry.food_variants?.monounsaturated_fat || 0,
        trans_fat: entry.food_variants?.trans_fat || 0,
        cholesterol: entry.food_variants?.cholesterol || 0,
        sodium: entry.food_variants?.sodium || 0,
        potassium: entry.food_variants?.potassium || 0,
        dietary_fiber: entry.food_variants?.dietary_fiber || 0,
        sugars: entry.food_variants?.sugars || 0,
        vitamin_a: entry.food_variants?.vitamin_a || 0,
        vitamin_c: entry.food_variants?.vitamin_c || 0,
        calcium: entry.food_variants?.calcium || 0,
        iron: entry.food_variants?.iron || 0
      };

      let combinedVariants: FoodVariant[] = [primaryUnit];

      if (data && data.length > 0) {
        info(loggingLevel, "Food variants loaded successfully:", data);
        const variantsFromDb = data.map(variant => ({
          id: variant.id,
          serving_size: variant.serving_size,
          serving_unit: variant.serving_unit,
          calories: variant.calories || 0,
          protein: variant.protein || 0,
          carbs: variant.carbs || 0,
          fat: variant.fat || 0,
          saturated_fat: variant.saturated_fat || 0,
          polyunsaturated_fat: variant.polyunsaturated_fat || 0,
          monounsaturated_fat: variant.monounsaturated_fat || 0,
          trans_fat: variant.trans_fat || 0,
          cholesterol: variant.cholesterol || 0,
          sodium: variant.sodium || 0,
          potassium: variant.potassium || 0,
          dietary_fiber: variant.dietary_fiber || 0,
          sugars: variant.sugars || 0,
          vitamin_a: variant.vitamin_a || 0,
          vitamin_c: variant.vitamin_c || 0,
          calcium: variant.calcium || 0,
          iron: variant.iron || 0
        }));

        // Ensure the primary unit is always included and is the first option.
        // Then, add any other variants from the database that are not the primary unit (based on ID).
        const otherVariants = variantsFromDb.filter(variant => variant.id !== primaryUnit.id);
        combinedVariants = [primaryUnit, ...otherVariants];
      } else {
        info(loggingLevel, "No additional variants found, using primary food unit only.");
      }
      
      setVariants(combinedVariants);

      // Set selected variant based on entry.variant_id or default to primaryUnit
      const initialSelectedVariant = combinedVariants.find(v =>
        (entry.variant_id && v.id === entry.variant_id) ||
        (!entry.variant_id && v.id === primaryUnit.id) // If no variant_id, use the default variant
      ) || primaryUnit;
      setSelectedVariant(initialSelectedVariant);
      debug(loggingLevel, "Selected variant:", initialSelectedVariant);
    } catch (err) {
      error(loggingLevel, 'Error loading variants:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!entry) return null;

  const handleSave = async () => {
    debug(loggingLevel, "Handling save food entry.");
    if (!selectedVariant) {
      warn(loggingLevel, "Save called with no selected variant.");
      return;
    }

    try {
      const updateData: any = {
        quantity: quantity,
        unit: selectedVariant.serving_unit,
        variant_id: selectedVariant.id === 'default-variant' ? null : selectedVariant.id || null
      };
      debug(loggingLevel, "Update data for food entry:", updateData);

      await updateFoodEntry(entry.id, updateData);

      info(loggingLevel, "Food entry updated successfully:", entry.id);
      toast({
        title: "Success",
        description: "Food entry updated successfully",
      });

      onSave();
      onOpenChange(false);
    } catch (err) {
      error(loggingLevel, 'Error updating food entry:', err);
      toast({
        title: "Error",
        description: "Failed to update food entry",
        variant: "destructive",
      });
    }
  };

  const calculateNutrition = () => {
    debug(loggingLevel, "Calculating nutrition for edit dialog.");
    if (!selectedVariant || !entry) {
      warn(loggingLevel, "calculateNutrition called with missing data.", { selectedVariant, entry });
      return null;
    }

    // Calculate the ratio based on quantity vs serving size of the selected variant
    const ratio = quantity / selectedVariant.serving_size;
    debug(loggingLevel, "Calculated ratio for edit dialog:", ratio);

    // Apply the ratio to the selected variant's nutrition values
    const nutrition = {
      calories: (selectedVariant.calories * ratio) || 0,
      protein: (selectedVariant.protein * ratio) || 0,
      carbs: (selectedVariant.carbs * ratio) || 0,
      fat: (selectedVariant.fat * ratio) || 0,
      saturated_fat: (selectedVariant.saturated_fat * ratio) || 0,
      polyunsaturated_fat: (selectedVariant.polyunsaturated_fat * ratio) || 0,
      monounsaturated_fat: (selectedVariant.monounsaturated_fat * ratio) || 0,
      trans_fat: (selectedVariant.trans_fat * ratio) || 0,
      cholesterol: (selectedVariant.cholesterol * ratio) || 0,
      sodium: (selectedVariant.sodium * ratio) || 0,
      potassium: (selectedVariant.potassium * ratio) || 0,
      dietary_fiber: (selectedVariant.dietary_fiber * ratio) || 0,
      sugars: (selectedVariant.sugars * ratio) || 0,
      vitamin_a: (selectedVariant.vitamin_a * ratio) || 0,
      vitamin_c: (selectedVariant.vitamin_c * ratio) || 0,
      calcium: (selectedVariant.calcium * ratio) || 0,
      iron: (selectedVariant.iron * ratio) || 0,
    };
    debug(loggingLevel, "Calculated nutrition for edit dialog:", nutrition);
    return nutrition;
  };

  const nutrition = calculateNutrition();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Food Entry</DialogTitle>
          <DialogDescription>
            Edit the quantity and serving unit for your food entry.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div>Loading units...</div>
        ) : (
          <>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">{entry.foods.name}</h3>
                {entry.foods.brand && (
                  <p className="text-sm text-gray-600 mb-4">{entry.foods.brand}</p>
                )}
              </div>

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
                      debug(loggingLevel, "Quantity changed in edit dialog:", e.target.value);
                      setQuantity(Number(e.target.value));
                    }}
                  />
                </div>

                <div>
                  <Label htmlFor="unit">Unit</Label>
                  <Select
                    value={selectedVariant?.id || ''}
                    onValueChange={(value) => {
                      debug(loggingLevel, "Unit selected in edit dialog:", value);
                      const variant = variants.find(v => v.id === value);
                      setSelectedVariant(variant || null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {variants.map((variant) => (
                        <SelectItem key={variant.id} value={variant.id}>
                          {variant.serving_unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {nutrition && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-3">Macronutrients</h4>
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <Label className="text-sm">Calories</Label>
                        <div className="text-lg font-medium">{nutrition.calories.toFixed(1)}</div>
                      </div>
                      <div>
                        <Label className="text-sm">Protein (g)</Label>
                        <div className="text-lg font-medium">{nutrition.protein.toFixed(1)}</div>
                      </div>
                      <div>
                        <Label className="text-sm">Carbs (g)</Label>
                        <div className="text-lg font-medium">{nutrition.carbs.toFixed(1)}</div>
                      </div>
                      <div>
                        <Label className="text-sm">Fat (g)</Label>
                        <div className="text-lg font-medium">{nutrition.fat.toFixed(1)}</div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">Fat Breakdown</h4>
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <Label className="text-sm">Saturated Fat (g)</Label>
                        <div className="text-lg font-medium">{nutrition.saturated_fat.toFixed(1)}</div>
                      </div>
                      <div>
                        <Label className="text-sm">Polyunsaturated Fat (g)</Label>
                        <div className="text-lg font-medium">{nutrition.polyunsaturated_fat.toFixed(1)}</div>
                      </div>
                      <div>
                        <Label className="text-sm">Monounsaturated Fat (g)</Label>
                        <div className="text-lg font-medium">{nutrition.monounsaturated_fat.toFixed(1)}</div>
                      </div>
                      <div>
                        <Label className="text-sm">Trans Fat (g)</Label>
                        <div className="text-lg font-medium">{nutrition.trans_fat.toFixed(1)}</div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">Minerals & Other Nutrients</h4>
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <Label className="text-sm">Cholesterol (mg)</Label>
                        <div className="text-lg font-medium">{nutrition.cholesterol.toFixed(1)}</div>
                      </div>
                      <div>
                        <Label className="text-sm">Sodium (mg)</Label>
                        <div className="text-lg font-medium">{nutrition.sodium.toFixed(1)}</div>
                      </div>
                      <div>
                        <Label className="text-sm">Potassium (mg)</Label>
                        <div className="text-lg font-medium">{nutrition.potassium.toFixed(1)}</div>
                      </div>
                      <div>
                        <Label className="text-sm">Dietary Fiber (g)</Label>
                        <div className="text-lg font-medium">{nutrition.dietary_fiber.toFixed(1)}</div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">Sugars & Vitamins</h4>
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <Label className="text-sm">Sugars (g)</Label>
                        <div className="text-lg font-medium">{nutrition.sugars.toFixed(1)}</div>
                      </div>
                      <div>
                        <Label className="text-sm">Vitamin A (μg)</Label>
                        <div className="text-lg font-medium">{nutrition.vitamin_a.toFixed(1)}</div>
                      </div>
                      <div>
                        <Label className="text-sm">Vitamin C (mg)</Label>
                        <div className="text-lg font-medium">{nutrition.vitamin_c.toFixed(1)}</div>
                      </div>
                      <div>
                        <Label className="text-sm">Calcium (mg)</Label>
                        <div className="text-lg font-medium">{nutrition.calcium.toFixed(1)}</div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <Label className="text-sm">Iron (mg)</Label>
                        <div className="text-lg font-medium">{nutrition.iron.toFixed(1)}</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-muted p-4 rounded-lg">
                    <h4 className="font-medium mb-2">Base Values (per {selectedVariant?.serving_size} {selectedVariant?.serving_unit}):</h4>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>{selectedVariant?.calories || 0} cal</div>
                      <div>{selectedVariant?.protein || 0}g protein</div>
                      <div>{selectedVariant?.carbs || 0}g carbs</div>
                      <div>{selectedVariant?.fat || 0}g fat</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-2 mt-6">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  Save Changes
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EditFoodEntryDialog;
