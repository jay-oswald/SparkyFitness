
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Search, Plus, Loader2, Edit, Camera } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import EnhancedCustomFoodForm from './EnhancedCustomFoodForm';
import BarcodeScanner from './BarcodeScanner';

interface Food {
  id: string;
  name: string;
  brand?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  saturated_fat?: number;
  sodium?: number;
  serving_size: number;
  serving_unit: string;
  is_custom: boolean;
}

interface OpenFoodFactsProduct {
  product_name: string;
  brands?: string;
  nutriments: {
    'energy-kcal_100g'?: number;
    'proteins_100g'?: number;
    'carbohydrates_100g'?: number;
    'fat_100g'?: number;
    'saturated-fat_100g'?: number;
    'sodium_100g'?: number;
    'fiber_100g'?: number;
    'sugars_100g'?: number;
  };
  code: string;
}

interface EnhancedFoodSearchProps {
  onFoodSelect: (food: Food) => void;
}

const EnhancedFoodSearch = ({ onFoodSelect }: EnhancedFoodSearchProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [foods, setFoods] = useState<Food[]>([]);
  const [openFoodFactsResults, setOpenFoodFactsResults] = useState<OpenFoodFactsProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'database' | 'openfoodfacts' | 'barcode'>('database');
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<OpenFoodFactsProduct | null>(null);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);

  const searchDatabase = async () => {
    if (!searchTerm.trim()) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('foods')
      .select('*')
      .ilike('name', `%${searchTerm}%`)
      .limit(20);

    if (error) {
      toast({
        title: 'Search failed',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setFoods(data || []);
    }
    setLoading(false);
  };

  const searchOpenFoodFacts = async () => {
    if (!searchTerm.trim()) return;
    
    setLoading(true);
    try {
      const response = await fetch(
        `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(searchTerm)}&search_simple=1&action=process&json=1&page_size=20`
      );
      const data = await response.json();
      
      if (data.products) {
        setOpenFoodFactsResults(data.products.filter((p: any) =>
          p.product_name && p.nutriments && p.nutriments['energy-kcal_100g']
        ));
      }
    } catch (error) {
      toast({
        title: 'OpenFoodFacts search failed',
        description: 'Unable to search OpenFoodFacts database',
        variant: 'destructive',
      });
    }
    setLoading(false);
  };

  const searchOpenFoodFactsByBarcode = async (barcode: string) => {
   setLoading(true);
   try {
     const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
     const data = await response.json();

     if (data.status === 1 && data.product) {
       setOpenFoodFactsResults([data.product]);
       setActiveTab('openfoodfacts'); // Switch to OpenFoodFacts tab to display result
       toast({
         title: 'Barcode scanned successfully',
         description: `Found product: ${data.product.product_name}`,
       });
     } else {
       setOpenFoodFactsResults([]);
       toast({
         title: 'Product not found',
         description: 'No product found for this barcode on OpenFoodFacts.',
         variant: 'destructive',
       });
     }
   } catch (error) {
     toast({
       title: 'Barcode search failed',
       description: 'Unable to search OpenFoodFacts database with barcode.',
       variant: 'destructive',
     });
   }
   setLoading(false);
 };

  const handleOpenFoodFactsEdit = (product: OpenFoodFactsProduct) => {
    setEditingProduct(product);
    setShowEditDialog(true);
  };

  const convertOpenFoodFactsToFood = (product: OpenFoodFactsProduct): any => {
    const convertedFood = {
      name: product.product_name,
      brand: product.brands?.split(',')[0]?.trim() || '',
      calories: Math.round(product.nutriments['energy-kcal_100g'] || 0),
      protein: Math.round((product.nutriments['proteins_100g'] || 0) * 10) / 10,
      carbs: Math.round((product.nutriments['carbohydrates_100g'] || 0) * 10) / 10,
      fat: Math.round((product.nutriments['fat_100g'] || 0) * 10) / 10,
      saturated_fat: Math.round((product.nutriments['saturated-fat_100g'] || 0) * 10) / 10,
      sodium: product.nutriments['sodium_100g'] ? Math.round(product.nutriments['sodium_100g'] * 1000) : 0,
      serving_size: 100,
      serving_unit: 'g',
      is_custom: false,
      // Additional nutrients for comprehensive data
      polyunsaturated_fat: 0,
      monounsaturated_fat: 0,
      trans_fat: 0,
      cholesterol: 0,
      potassium: 0,
      dietary_fiber: Math.round((product.nutriments['fiber_100g'] || 0) * 10) / 10,
      sugars: Math.round((product.nutriments['sugars_100g'] || 0) * 10) / 10,
      vitamin_a: 0,
      vitamin_c: 0,
      calcium: 0,
      iron: 0,
    };
    return convertedFood;
  };

  const handleSaveEditedFood = async (foodData: any) => {
    try {
      
      // Food is already saved by the EnhancedCustomFoodForm
      // Now we need to pass it to the meal selection
      onFoodSelect(foodData);
      
      // Close dialog and clear state
      setShowEditDialog(false);
      setEditingProduct(null);
      
      toast({
        title: 'Food added',
        description: `${foodData.name} has been added and is ready to be added to your meal`,
      });
    } catch (error) {
      console.error('Error handling edited food:', error);
      toast({
        title: 'Error',
        description: 'Failed to process the edited food',
        variant: 'destructive',
      });
    }
  };

  const handleSearch = () => {
    if (activeTab === 'database') {
      searchDatabase();
    } else if (activeTab === 'openfoodfacts') {
      searchOpenFoodFacts();
    } else if (activeTab === 'barcode') {
      // Barcode scanning is handled by the BarcodeScanner component directly
      // No action needed here for handleSearch
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex space-x-2">
        <Button
          variant={activeTab === 'database' ? 'default' : 'outline'}
          onClick={() => setActiveTab('database')}
        >
          Database
        </Button>
        <Button
          variant={activeTab === 'openfoodfacts' ? 'default' : 'outline'}
          onClick={() => setActiveTab('openfoodfacts')}
        >
          OpenFoodFacts
         </Button>
         <Button
           variant={activeTab === 'barcode' ? 'default' : 'outline'}
           onClick={() => {
             setActiveTab('barcode');
             setShowBarcodeScanner(true);
           }}
         >
           <Camera className="w-4 h-4 mr-2" /> Scan Barcode
         </Button>
       </div>

      <div className="flex space-x-2">
        <Input
          placeholder="Search for foods..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          className="flex-1"
        />
        <Button onClick={handleSearch} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </Button>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {activeTab === 'database' && foods.map((food) => (
          <Card key={food.id} className="cursor-pointer hover:bg-gray-50" onClick={() => onFoodSelect(food)}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h3 className="font-medium">{food.name}</h3>
                    {food.brand && <Badge variant="secondary" className="text-xs">{food.brand}</Badge>}
                    {food.is_custom && <Badge variant="outline" className="text-xs">Custom</Badge>}
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-sm text-gray-600">
                    <span><strong>{food.calories}</strong> cal</span>
                    <span><strong>{food.protein}g</strong> protein</span>
                    <span><strong>{food.carbs}g</strong> carbs</span>
                    <span><strong>{food.fat}g</strong> fat</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Per {food.serving_size}{food.serving_unit}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {activeTab === 'openfoodfacts' && openFoodFactsResults.map((product) => (
          <Card key={product.code} className="hover:bg-gray-50">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h3 className="font-medium">{product.product_name}</h3>
                    {product.brands && <Badge variant="secondary" className="text-xs">{product.brands.split(',')[0]}</Badge>}
                    <Badge variant="outline" className="text-xs">OpenFoodFacts</Badge>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-sm text-gray-600">
                    <span><strong>{Math.round(product.nutriments['energy-kcal_100g'] || 0)}</strong> cal</span>
                    <span><strong>{Math.round(product.nutriments['proteins_100g'] || 0)}g</strong> protein</span>
                    <span><strong>{Math.round(product.nutriments['carbohydrates_100g'] || 0)}g</strong> carbs</span>
                    <span><strong>{Math.round(product.nutriments['fat_100g'] || 0)}g</strong> fat</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Per 100g</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleOpenFoodFactsEdit(product)}
                  className="ml-2"
                >
                  <Edit className="w-4 h-4 mr-1" />
                  Edit & Add
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Dialog for OpenFoodFacts products */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Food Details</DialogTitle>
          </DialogHeader>
          {editingProduct && (
            <EnhancedCustomFoodForm
              food={convertOpenFoodFactsToFood(editingProduct)}
              onSave={handleSaveEditedFood}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Barcode Scanner Dialog */}
      <Dialog open={showBarcodeScanner} onOpenChange={setShowBarcodeScanner}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Scan Barcode</DialogTitle>
            <DialogDescription>
              Position the product barcode in front of your camera.
            </DialogDescription>
          </DialogHeader>
          <BarcodeScanner
            onBarcodeDetected={(barcode) => {
              searchOpenFoodFactsByBarcode(barcode);
              setShowBarcodeScanner(false);
            }}
            onClose={() => setShowBarcodeScanner(false)}
            isActive={showBarcodeScanner}
            cameraFacing="back"
            continuousMode={false}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EnhancedFoodSearch;
