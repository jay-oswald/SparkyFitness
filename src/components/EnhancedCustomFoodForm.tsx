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
  isUUID,
  saveFood,
  loadFoodVariants, // Also re-add loadFoodVariants as it's used
} from '@/services/enhancedCustomFoodFormService';
import { Food, FoodVariant } from '@/types/food';

type NumericFoodVariantKeys = Exclude<keyof FoodVariant, 'id' | 'serving_unit' | 'is_default' | 'is_locked'>;

interface EnhancedCustomFoodFormProps {
  onSave: (foodData: any) => void;
  food?: Food;
  initialVariants?: FoodVariant[]; // New prop for pre-populating variants
}

const COMMON_UNITS = [
  'g', 'kg', 'mg', 'oz', 'lb', 'ml', 'l', 'cup', 'tbsp', 'tsp', 
  'piece', 'slice', 'serving', 'can', 'bottle', 'packet', 'bag',
  'bowl', 'plate', 'handful', 'scoop', 'bar', 'stick'
];

const EnhancedCustomFoodForm = ({ onSave, food, initialVariants }: EnhancedCustomFoodFormProps) => {
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
      // If food has variants from the API, use them. Otherwise, load existing variants from the backend.
      if (food.variants && food.variants.length > 0) {
        setVariants(food.variants.map(v => ({ ...v, is_locked: false }))); // Initialize is_locked to false for existing food variants
      } else {
        loadExistingVariants(); // Load variants for existing food from DB
      }
    } else if (initialVariants && initialVariants.length > 0) {
      // If initialVariants are provided (e.g., from online search), use them
      setFormData({
        name: "", // Will be set by the parent component if food is passed
        brand: "", // Will be set by the parent component if food is passed
      });
      setVariants(initialVariants);
    } else {
      // For completely new foods with no initial variants, initialize with a single default variant
      setFormData({
        name: "",
        brand: "",
      });
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
        is_default: true, // Mark as default
        is_locked: false, // New field for locking nutrient details
      }]);
    }
  }, [food, initialVariants]); // Add initialVariants to dependency array

  const loadExistingVariants = async () => {
    if (!food?.id || !isUUID(food.id)) return; // Ensure food.id is a valid UUID

    try {
      const data = await loadFoodVariants(food.id);
      
      let loadedVariants: FoodVariant[] = [];
      let defaultVariant: FoodVariant | undefined;

      if (data && data.length > 0) {
        // Find the default variant
        defaultVariant = data.find(v => v.is_default);
        
        // If no explicit default, try to use the one that matches the food's primary details
        // This might be redundant if the backend always ensures one is_default=true
        if (!defaultVariant && food.default_variant) {
          defaultVariant = data.find(v => v.id === food.default_variant?.id);
        }

        // If still no default, pick the first one or create a new one
        if (!defaultVariant) {
          defaultVariant = data[0];
          if (defaultVariant) {
            defaultVariant.is_default = true; // Mark it as default for the UI
          }
        }

        // Ensure the default variant is always first in the list
        if (defaultVariant) {
          loadedVariants.push({ ...defaultVariant, is_locked: false }); // Initialize is_locked to false
          loadedVariants = loadedVariants.concat(data.filter(v => v.id !== defaultVariant?.id).map(v => ({ ...v, is_locked: false }))); // Initialize is_locked to false
        } else {
          loadedVariants = data.map(v => ({ ...v, is_locked: false })); // Fallback if no default is found, initialize is_locked to false
        }
      } else {
        // If no variants are returned, initialize with a single default variant
        loadedVariants = [{
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
          is_default: true,
          is_locked: false, // Initialize as unlocked
        }];
      }
      setVariants(loadedVariants);
    } catch (error) {
      console.error('Error loading variants:', error);
      // Fallback to a single default variant on error
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
        is_default: true,
        is_locked: false, // Initialize as unlocked
      }]);
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
      is_default: false, // New variants are not default
      is_locked: false, // New variants are not locked
    }]);
  };

  const removeVariant = (index: number) => {
    // Prevent removing the primary unit (index 0)
    if (index === 0) {
      toast({
        title: "Cannot remove default unit",
        description: "The default unit represents the food's primary serving and cannot be removed.",
        variant: "destructive",
      });
      return;
    }
    setVariants(variants.filter((_, i) => i !== index));
  };

  const updateVariant = (index: number, field: keyof FoodVariant, value: string | number | boolean) => {
    const updatedVariants = [...variants];
    const currentVariant = updatedVariants[index];
    const newVariant = { ...currentVariant, [field]: value };

    // If this variant is set to be the default, ensure all others are not
    if (field === 'is_default' && value === true) {
      updatedVariants.forEach((v, i) => {
        if (i !== index) {
          v.is_default = false;
        }
      });
    }

    // Handle proportional scaling for locked variants when serving_size changes
    if (field === 'serving_size' && currentVariant.is_locked) {
      const oldServingSize = currentVariant.serving_size;
      const newServingSize = Number(value);

      if (oldServingSize > 0 && newServingSize >= 0) {
        const ratio = newServingSize / oldServingSize;

        const nutrientFields: NumericFoodVariantKeys[] = [
          'calories', 'protein', 'carbs', 'fat', 'saturated_fat',
          'polyunsaturated_fat', 'monounsaturated_fat', 'trans_fat',
          'cholesterol', 'sodium', 'potassium', 'dietary_fiber',
          'sugars', 'vitamin_a', 'vitamin_c', 'calcium', 'iron'
        ];

        nutrientFields.forEach(nutrientField => {
          // No need for typeof check here, as NumericFoodVariantKeys ensures it's a number type
          newVariant[nutrientField] = Number(((currentVariant[nutrientField] as number) * ratio).toFixed(2));
        });
      }
    }
    
    updatedVariants[index] = newVariant;
    setVariants(updatedVariants);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      // The first variant in the array is always the primary unit for the food
      // Ensure exactly one variant is marked as default
      const defaultVariantCount = variants.filter(v => v.is_default).length;
      if (defaultVariantCount === 0) {
        toast({
          title: "Validation Error",
          description: "At least one variant must be marked as the default unit.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      } else if (defaultVariantCount > 1) {
        toast({
          title: "Validation Error",
          description: "Only one variant can be marked as the default unit. Please correct this.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const primaryVariant = variants.find(v => v.is_default);
      if (!primaryVariant) {
        // This case should ideally be caught by the validation above, but as a fallback
        toast({
          title: "Error",
          description: "No default variant found. This should not happen.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

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
        // When creating a new food, reset variants to include only the default unit
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
          is_default: true,
          is_locked: false, // Reset to unlocked for new food
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
                        // serving_size should always be editable, even if locked, to allow scaling
                        // disabled={variant.is_locked} // Removed this line
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
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`is-default-${index}`}
                          checked={variant.is_default || false}
                          onChange={(e) => updateVariant(index, 'is_default', e.target.checked)}
                          className="form-checkbox h-4 w-4 text-blue-600"
                        />
                        <Label htmlFor={`is-default-${index}`} className="text-sm">Default</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`is-locked-${index}`}
                          checked={variant.is_locked || false}
                          onChange={(e) => updateVariant(index, 'is_locked', e.target.checked)}
                          className="form-checkbox h-4 w-4 text-blue-600"
                        />
                        <Label htmlFor={`is-locked-${index}`} className="text-sm">Auto-Scale</Label>
                      </div>
                      {/* Removed Primary Unit Badge */}
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
                              disabled={variant.is_locked}
                            />
                          </div>
                          <div>
                            <Label>Protein (g)</Label>
                            <Input
                              type="number"
                              step="0.1"
                              value={variant.protein}
                              onChange={(e) => updateVariant(index, 'protein', Number(e.target.value))}
                              disabled={variant.is_locked}
                            />
                          </div>
                          <div>
                            <Label>Carbs (g)</Label>
                            <Input
                              type="number"
                              step="0.1"
                              value={variant.carbs}
                              onChange={(e) => updateVariant(index, 'carbs', Number(e.target.value))}
                              disabled={variant.is_locked}
                            />
                          </div>
                          <div>
                            <Label>Fat (g)</Label>
                            <Input
                              type="number"
                              step="0.1"
                              value={variant.fat}
                              onChange={(e) => updateVariant(index, 'fat', Number(e.target.value))}
                              disabled={variant.is_locked}
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
                              disabled={variant.is_locked}
                            />
                          </div>
                          <div>
                            <Label>Polyunsaturated Fat (g)</Label>
                            <Input
                              type="number"
                              step="0.1"
                              value={variant.polyunsaturated_fat}
                              onChange={(e) => updateVariant(index, 'polyunsaturated_fat', Number(e.target.value))}
                              disabled={variant.is_locked}
                            />
                          </div>
                          <div>
                            <Label>Monounsaturated Fat (g)</Label>
                            <Input
                              type="number"
                              step="0.1"
                              value={variant.monounsaturated_fat}
                              onChange={(e) => updateVariant(index, 'monounsaturated_fat', Number(e.target.value))}
                              disabled={variant.is_locked}
                            />
                          </div>
                          <div>
                            <Label>Trans Fat (g)</Label>
                            <Input
                              type="number"
                              step="0.1"
                              value={variant.trans_fat}
                              onChange={(e) => updateVariant(index, 'trans_fat', Number(e.target.value))}
                              disabled={variant.is_locked}
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
                              disabled={variant.is_locked}
                            />
                          </div>
                          <div>
                            <Label>Sodium (mg)</Label>
                            <Input
                              type="number"
                              step="0.1"
                              value={variant.sodium}
                              onChange={(e) => updateVariant(index, 'sodium', Number(e.target.value))}
                              disabled={variant.is_locked}
                            />
                          </div>
                          <div>
                            <Label>Potassium (mg)</Label>
                            <Input
                              type="number"
                              step="0.1"
                              value={variant.potassium}
                              onChange={(e) => updateVariant(index, 'potassium', Number(e.target.value))}
                              disabled={variant.is_locked}
                            />
                          </div>
                          <div>
                            <Label>Dietary Fiber (g)</Label>
                            <Input
                              type="number"
                              step="0.1"
                              value={variant.dietary_fiber}
                              onChange={(e) => updateVariant(index, 'dietary_fiber', Number(e.target.value))}
                              disabled={variant.is_locked}
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
                              disabled={variant.is_locked}
                            />
                          </div>
                          <div>
                            <Label>Vitamin A (μg)</Label>
                            <Input
                              type="number"
                              step="0.1"
                              value={variant.vitamin_a}
                              onChange={(e) => updateVariant(index, 'vitamin_a', Number(e.target.value))}
                              disabled={variant.is_locked}
                            />
                          </div>
                          <div>
                            <Label>Vitamin C (mg)</Label>
                            <Input
                              type="number"
                              step="0.1"
                              value={variant.vitamin_c}
                              onChange={(e) => updateVariant(index, 'vitamin_c', Number(e.target.value))}
                              disabled={variant.is_locked}
                            />
                          </div>
                          <div>
                            <Label>Calcium (mg)</Label>
                            <Input
                              type="number"
                              step="0.1"
                              value={variant.calcium}
                              onChange={(e) => updateVariant(index, 'calcium', Number(e.target.value))}
                              disabled={variant.is_locked}
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
                              disabled={variant.is_locked}
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
