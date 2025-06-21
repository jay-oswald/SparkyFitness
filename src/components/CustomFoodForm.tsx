
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { usePreferences } from "@/contexts/PreferencesContext";
import { debug, info, warn, error } from '@/utils/logging';

interface CustomFood {
  name: string;
  brand?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  servingSize: number;
  servingUnit: string;
}

interface CustomFoodFormProps {
  onSave: (food: CustomFood) => void;
}

const CustomFoodForm = ({ onSave }: CustomFoodFormProps) => {
 const { loggingLevel } = usePreferences();
 debug(loggingLevel, "CustomFoodForm: Component rendered.");
 const [formData, setFormData] = useState<CustomFood>({
   name: "",
   brand: "",
   calories: 0,
   protein: 0,
   carbs: 0,
   fat: 0,
   fiber: 0,
   sugar: 0,
   servingSize: 100,
   servingUnit: "g"
 });

 const handleSubmit = (e: React.FormEvent) => {
   e.preventDefault();
   debug(loggingLevel, "CustomFoodForm: Handling form submission.");
   if (!formData.name.trim()) {
     warn(loggingLevel, "CustomFoodForm: Food name is empty, submission aborted.");
     return;
   }
   
   info(loggingLevel, "CustomFoodForm: Saving custom food:", formData);
   onSave(formData);
   setFormData({
     name: "",
     brand: "",
     calories: 0,
     protein: 0,
     carbs: 0,
     fat: 0,
     fiber: 0,
     sugar: 0,
     servingSize: 100,
     servingUnit: "g"
   });
   info(loggingLevel, "CustomFoodForm: Form data reset.");
 };

 const handleInputChange = (field: keyof CustomFood, value: string | number) => {
   debug(loggingLevel, `CustomFoodForm: Input change for field "${field}":`, value);
   setFormData(prev => ({
     ...prev,
     [field]: value
   }));
 };

 return (
   <Card>
     <CardContent className="p-6">
       <form onSubmit={handleSubmit} className="space-y-4">
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <div className="space-y-2">
             <Label htmlFor="name">Food Name *</Label>
             <Input
               id="name"
               value={formData.name}
               onChange={(e) => handleInputChange("name", e.target.value)}
               placeholder="e.g., Homemade Pizza"
               required
             />
           </div>
           
           <div className="space-y-2">
             <Label htmlFor="brand">Brand (optional)</Label>
             <Input
               id="brand"
               value={formData.brand}
               onChange={(e) => handleInputChange("brand", e.target.value)}
               placeholder="e.g., Homemade"
             />
           </div>
         </div>

         <div className="grid grid-cols-2 gap-4">
           <div className="space-y-2">
             <Label htmlFor="servingSize">Serving Size</Label>
             <Input
               id="servingSize"
               type="number"
               value={formData.servingSize}
               onChange={(e) => handleInputChange("servingSize", Number(e.target.value))}
               min="0"
               step="0.1"
             />
           </div>
           
           <div className="space-y-2">
             <Label htmlFor="servingUnit">Unit</Label>
             <Input
               id="servingUnit"
               value={formData.servingUnit}
               onChange={(e) => handleInputChange("servingUnit", e.target.value)}
               placeholder="g, ml, cup, etc."
             />
           </div>
         </div>

         <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
           <div className="space-y-2">
             <Label htmlFor="calories">Calories</Label>
             <Input
               id="calories"
               type="number"
               value={formData.calories}
               onChange={(e) => handleInputChange("calories", Number(e.target.value))}
               min="0"
               step="0.1"
             />
           </div>
           
           <div className="space-y-2">
             <Label htmlFor="protein">Protein (g)</Label>
             <Input
               id="protein"
               type="number"
               value={formData.protein}
               onChange={(e) => handleInputChange("protein", Number(e.target.value))}
               min="0"
               step="0.1"
             />
           </div>
           
           <div className="space-y-2">
             <Label htmlFor="carbs">Carbs (g)</Label>
             <Input
               id="carbs"
               type="number"
               value={formData.carbs}
               onChange={(e) => handleInputChange("carbs", Number(e.target.value))}
               min="0"
               step="0.1"
             />
           </div>
           
           <div className="space-y-2">
             <Label htmlFor="fat">Fat (g)</Label>
             <Input
               id="fat"
               type="number"
               value={formData.fat}
               onChange={(e) => handleInputChange("fat", Number(e.target.value))}
               min="0"
               step="0.1"
             />
           </div>
         </div>

         <div className="grid grid-cols-2 gap-4">
           <div className="space-y-2">
             <Label htmlFor="fiber">Fiber (g)</Label>
             <Input
               id="fiber"
               type="number"
               value={formData.fiber}
               onChange={(e) => handleInputChange("fiber", Number(e.target.value))}
               min="0"
               step="0.1"
             />
           </div>
           
           <div className="space-y-2">
             <Label htmlFor="sugar">Sugar (g)</Label>
             <Input
               id="sugar"
               type="number"
               value={formData.sugar}
               onChange={(e) => handleInputChange("sugar", Number(e.target.value))}
               min="0"
               step="0.1"
             />
           </div>
         </div>

         <div className="flex justify-end space-x-2 pt-4">
           <Button type="button" variant="outline" onClick={() => debug(loggingLevel, "CustomFoodForm: Cancel button clicked.")}>
             Cancel
           </Button>
           <Button type="submit" className="bg-green-500 hover:bg-green-600">
             Save Food
           </Button>
         </div>
       </form>
     </CardContent>
   </Card>
 );
};

export default CustomFoodForm;
