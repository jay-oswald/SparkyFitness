import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import {
  loadFoodVariants,
  saveFood,
  isUUID,
  Food,
  FoodVariant,
} from '@/services/enhancedCustomFoodFormService';


interface EnhancedCustomFoodFormProps {
  onSave: (foodData: any) => void;
  food?: Food;
}

const COMMON_UNITS = [
  'g', 'kg', 'mg', 'oz', 'lb', 'ml', 'l', 'cup', 'tbsp', 'tsp', 
  'piece', 'slice', 'serving', 'can', 'bottle', 'packet', 'bag',
  'bowl', 'plate', 'handful', 'scoop', 'bar', 'stick'
];

const EnhancedCustomFoodForm = ({ onSave, food }: EnhancedCustomFoodFormProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [variants, setVariants] = useState<FoodVariant[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    brand: "",
  });

  useEffect(() => {
    if (food) {
      setFormData({
        name: food.name || "",
        brand: food.brand || "",
      });
      
      // Initialize variants with the primary food unit
      const primaryFoodUnit: FoodVariant = {
        id: food.id, // Keep food.id for existing foods
        serving_size: food.serving_size || 100,
        serving_unit: food.serving_unit || "g",
        calories: food.calories || 0,
        protein: food.protein || 0,
        carbs: food.carbs || 0,
        fat: food.fat || 0,
        saturated_fat: food.saturated_fat || 0,
        polyunsaturated_fat: food.polyunsaturated_fat || 0,
        monounsaturated_fat: food.monounsaturated_fat || 0,
        trans_fat: food.trans_fat || 0,
        cholesterol: food.cholesterol || 0,
        sodium: food.sodium || 0,
        potassium: food.potassium || 0,
        dietary_fiber: food.dietary_fiber || 0,
        sugars: food.sugars || 0,
        vitamin_a: food.vitamin_a || 0,
        vitamin_c: food.vitamin_c || 0,
        calcium: food.calcium || 0,
        iron: food.iron || 0,
      };
      setVariants([primaryFoodUnit]);

      if (food.id && isUUID(food.id)) { // Only load variants if food.id is a valid UUID
        loadExistingVariants();
      }
    } else {
      // For completely new foods, initialize with a default empty variant
      setVariants([{
        serving_size: 100,
        serving_unit: "g",
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
        iron: 0,
      }]);
    }
  }, [food]);

  const loadExistingVariants = async () => {
    if (!food?.id || !isUUID(food.id)) return; // Ensure food.id is a valid UUID

    try {
      const data = await loadFoodVariants(food.id);

      if (data && data.length > 0) {
        // Filter out any variants that are identical to the primary food unit
        const filteredVariants = data.filter(variant => 
          !(variant.serving_size === food.serving_size && variant.serving_unit === food.serving_unit)
        ).map(variant => ({
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
          iron: variant.iron || 0,
        }));
        
        // Prepend the primary food unit to the variants list
        setVariants(prevVariants => [prevVariants[0], ...filteredVariants]);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const addVariant = () => {
    setVariants([...variants, { 
      serving_size: 1, 
      serving_unit: "g",
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
      iron: 0,
    }]);
  };

  const removeVariant = (index: number) => {
    // Prevent removing the primary unit (index 0)
    if (index === 0) {
      toast({
        title: "Cannot remove primary unit",
        description: "The first unit represents the food's primary serving and cannot be removed.",
        variant: "destructive",
      });
      return;
    }
    setVariants(variants.filter((_, i) => i !== index));
  };

  const updateVariant = (index: number, field: keyof FoodVariant, value: string | number) => {
    const updatedVariants = [...variants];
    updatedVariants[index] = { ...updatedVariants[index], [field]: value };
    setVariants(updatedVariants);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      // The first variant in the array is always the primary unit for the food
      const primaryVariant = variants[0];
      const foodData: Food = {
        name: formData.name,
        brand: formData.brand,
        serving_size: primaryVariant.serving_size,
        serving_unit: primaryVariant.serving_unit,
        calories: primaryVariant.calories,
        protein: primaryVariant.protein,
        carbs: primaryVariant.carbs,
        fat: primaryVariant.fat,
        saturated_fat: primaryVariant.saturated_fat,
        polyunsaturated_fat: primaryVariant.polyunsaturated_fat,
        monounsaturated_fat: primaryVariant.monounsaturated_fat,
        trans_fat: primaryVariant.trans_fat,
        cholesterol: primaryVariant.cholesterol,
        sodium: primaryVariant.sodium,
        potassium: primaryVariant.potassium,
        dietary_fiber: primaryVariant.dietary_fiber,
        sugars: primaryVariant.sugars,
        vitamin_a: primaryVariant.vitamin_a,
        vitamin_c: primaryVariant.vitamin_c,
        calcium: primaryVariant.calcium,
        iron: primaryVariant.iron,
      };

      const savedFood = await saveFood(foodData, variants, user.id, food?.id);

      toast({
        title: "Success",
        description: `Food ${food && food.id ? 'updated' : 'saved'} successfully with ${variants.length} unit variant(s)`,
      });
      
      if (!food || !food.id) {
        setFormData({
          name: "",
          brand: "",
        });
        // When creating a new food, reset variants to include only the primary unit
        setVariants([{
          serving_size: 100,
          serving_unit: "g",
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
          iron: 0,
        }]);
      }
      
      onSave(savedFood);
    } catch (error) {
      console.error('Error saving food:', error);
      toast({
        title: "Error",
        description: `Failed to ${food && food.id ? 'update' : 'save'} food`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{food && food.id ? 'Edit Food' : 'Add Custom Food'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Food Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="brand">Brand</Label>
              <Input
                id="brand"
                value={formData.brand}
                onChange={(e) => updateField('brand', e.target.value)}
              />
            </div>
          </div>
          {/* Unit Variants with Individual Nutrition */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Unit Variants</h3>
              <Button type="button" onClick={addVariant} size="sm">
                <Plus className="w-4 h-4 mr-1" />
                Add Unit
              </Button>
            </div>
            <p className="text-sm text-gray-600">
              Add different unit measurements for this food with specific nutrition values for each unit.
            </p>
            
            <div className="space-y-6">
              {variants.map((variant, index) => (
                <Card key={index} className="p-4">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.1"
                        value={variant.serving_size}
                        onChange={(e) => updateVariant(index, 'serving_size', Number(e.target.value))}
                        className="w-24"
                      />
                      <Select
                        value={variant.serving_unit}
                        onValueChange={(value) => updateVariant(index, 'serving_unit', value)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {COMMON_UNITS.map(unit => (
                            <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {index === 0 && (
                        <Badge variant="secondary" className="text-xs">Primary Unit</Badge>
                      )}
                      {index > 0 && ( // Only allow removing non-primary units
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeVariant(index)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>

                    {/* Nutrition for this specific variant */}
                    <div className="space-y-4">
                      <h4 className="text-md font-medium">
                        Nutrition per {variant.serving_size} {variant.serving_unit}
                      </h4>
                      
                      {/* Main Macros */}
                      <div>
                        <h5 className="text-sm font-medium text-gray-700 mb-3">Main Nutrients</h5>
                        <div className="grid grid-cols-4 gap-4">
                          <div>
                            <Label>Calories</Label>
                            <Input
                              type="number"
                              value={variant.calories}
                              onChange={(e) => updateVariant(index, 'calories', Number(e.target.value))}
                            />
                          </div>
                          <div>
                            <Label>Protein (g)</Label>
                            <Input
                              type="number"
                              step="0.1"
                              value={variant.protein}
                              onChange={(e) => updateVariant(index, 'protein', Number(e.target.value))}
                            />
                          </div>
                          <div>
                            <Label>Carbs (g)</Label>
                            <Input
                              type="number"
                              step="0.1"
                              value={variant.carbs}
                              onChange={(e) => updateVariant(index, 'carbs', Number(e.target.value))}
                            />
                          </div>
                          <div>
                            <Label>Fat (g)</Label>
                            <Input
                              type="number"
                              step="0.1"
                              value={variant.fat}
                              onChange={(e) => updateVariant(index, 'fat', Number(e.target.value))}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Detailed Fat Information */}
                      <div>
                        <h5 className="text-sm font-medium text-gray-700 mb-3">Fat Breakdown</h5>
                        <div className="grid grid-cols-4 gap-4">
                          <div>
                            <Label>Saturated Fat (g)</Label>
                            <Input
                              type="number"
                              step="0.1"
                              value={variant.saturated_fat}
                              onChange={(e) => updateVariant(index, 'saturated_fat', Number(e.target.value))}
                            />
                          </div>
                          <div>
                            <Label>Polyunsaturated Fat (g)</Label>
                            <Input
                              type="number"
                              step="0.1"
                              value={variant.polyunsaturated_fat}
                              onChange={(e) => updateVariant(index, 'polyunsaturated_fat', Number(e.target.value))}
                            />
                          </div>
                          <div>
                            <Label>Monounsaturated Fat (g)</Label>
                            <Input
                              type="number"
                              step="0.1"
                              value={variant.monounsaturated_fat}
                              onChange={(e) => updateVariant(index, 'monounsaturated_fat', Number(e.target.value))}
                            />
                          </div>
                          <div>
                            <Label>Trans Fat (g)</Label>
                            <Input
                              type="number"
                              step="0.1"
                              value={variant.trans_fat}
                              onChange={(e) => updateVariant(index, 'trans_fat', Number(e.target.value))}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Minerals and Other Nutrients */}
                      <div>
                        <h5 className="text-sm font-medium text-gray-700 mb-3">Minerals & Other</h5>
                        <div className="grid grid-cols-4 gap-4">
                          <div>
                            <Label>Cholesterol (mg)</Label>
                            <Input
                              type="number"
                              step="0.1"
                              value={variant.cholesterol}
                              onChange={(e) => updateVariant(index, 'cholesterol', Number(e.target.value))}
                            />
                          </div>
                          <div>
                            <Label>Sodium (mg)</Label>
                            <Input
                              type="number"
                              step="0.1"
                              value={variant.sodium}
                              onChange={(e) => updateVariant(index, 'sodium', Number(e.target.value))}
                            />
                          </div>
                          <div>
                            <Label>Potassium (mg)</Label>
                            <Input
                              type="number"
                              step="0.1"
                              value={variant.potassium}
                              onChange={(e) => updateVariant(index, 'potassium', Number(e.target.value))}
                            />
                          </div>
                          <div>
                            <Label>Dietary Fiber (g)</Label>
                            <Input
                              type="number"
                              step="0.1"
                              value={variant.dietary_fiber}
                              onChange={(e) => updateVariant(index, 'dietary_fiber', Number(e.target.value))}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Sugars and Vitamins */}
                      <div>
                        <h5 className="text-sm font-medium text-gray-700 mb-3">Sugars & Vitamins</h5>
                        <div className="grid grid-cols-4 gap-4">
                          <div>
                            <Label>Sugars (g)</Label>
                            <Input
                              type="number"
                              step="0.1"
                              value={variant.sugars}
                              onChange={(e) => updateVariant(index, 'sugars', Number(e.target.value))}
                            />
                          </div>
                          <div>
                            <Label>Vitamin A (μg)</Label>
                            <Input
                              type="number"
                              step="0.1"
                              value={variant.vitamin_a}
                              onChange={(e) => updateVariant(index, 'vitamin_a', Number(e.target.value))}
                            />
                          </div>
                          <div>
                            <Label>Vitamin C (mg)</Label>
                            <Input
                              type="number"
                              step="0.1"
                              value={variant.vitamin_c}
                              onChange={(e) => updateVariant(index, 'vitamin_c', Number(e.target.value))}
                            />
                          </div>
                          <div>
                            <Label>Calcium (mg)</Label>
                            <Input
                              type="number"
                              step="0.1"
                              value={variant.calcium}
                              onChange={(e) => updateVariant(index, 'calcium', Number(e.target.value))}
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="grid grid-cols-4 gap-4">
                          <div>
                            <Label>Iron (mg)</Label>
                            <Input
                              type="number"
                              step="0.1"
                              value={variant.iron}
                              onChange={(e) => updateVariant(index, 'iron', Number(e.target.value))}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Saving...' : (food && food.id ? 'Update Food' : 'Add Food')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};


export default EnhancedCustomFoodForm;
