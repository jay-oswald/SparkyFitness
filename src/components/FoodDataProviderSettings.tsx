import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, Edit, Save, X, UtensilsCrossed } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { usePreferences } from "@/contexts/PreferencesContext";

interface FoodDataProvider {
  id: string;
  provider_name: string;
  provider_type: 'openfoodfacts' | 'nutritionix' | 'fatsecret';
  app_id: string | null;
  app_key: string | null;
  is_active: boolean;
}

const FoodDataProviderSettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { defaultFoodDataProviderId, setDefaultFoodDataProviderId } = usePreferences();
  const [providers, setProviders] = useState<FoodDataProvider[]>([]);
  const [newProvider, setNewProvider] = useState({
    provider_name: '',
    provider_type: 'openfoodfacts' as 'openfoodfacts' | 'nutritionix' | 'fatsecret',
    app_id: '',
    app_key: '',
    is_active: false,
  });
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<FoodDataProvider>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadProviders();
    }
  }, [user]);

  const loadProviders = async () => {
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('food_data_providers')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading food data providers:', error);
      toast({
        title: "Error",
        description: "Failed to load food data providers",
        variant: "destructive"
      });
    } else {
      setProviders(data.map(provider => ({
        ...provider,
        provider_type: provider.provider_type as 'openfoodfacts' | 'nutritionix' | 'fatsecret'
      })) || []);
    }
    setLoading(false);
  };

  const handleAddProvider = async () => {
    if (!user || !newProvider.provider_name) {
      toast({
        title: "Error",
        description: "Please fill in the provider name",
        variant: "destructive"
      });
      return;
    }

    if ((newProvider.provider_type === 'nutritionix' || newProvider.provider_type === 'fatsecret') && (!newProvider.app_id || !newProvider.app_key)) {
      toast({
        title: "Error",
        description: `Please provide App ID and App Key for ${newProvider.provider_type}`,
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('food_data_providers')
      .insert({
        user_id: user.id,
        provider_name: newProvider.provider_name,
        provider_type: newProvider.provider_type,
        app_id: newProvider.app_id || null,
        app_key: newProvider.app_key || null,
        is_active: newProvider.is_active,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding food data provider:', error);
      toast({
        title: "Error",
        description: "Failed to add food data provider",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Food data provider added successfully"
      });
      setNewProvider({
        provider_name: '',
        provider_type: 'openfoodfacts',
        app_id: '',
        app_key: '',
        is_active: false,
      });
      setShowAddForm(false);
      loadProviders();
      if (data && data.is_active) { // Ensure data is not null
        setDefaultFoodDataProviderId(data.id);
      }
    }
    setLoading(false);
  };

  const handleUpdateProvider = async (providerId: string) => {
    setLoading(true);
    const providerUpdateData: Partial<FoodDataProvider> = {
      provider_name: editData.provider_name,
      provider_type: editData.provider_type,
      app_id: editData.app_id || null,
      app_key: editData.app_key || null,
      is_active: editData.is_active,
    };

    const { data, error } = await supabase
      .from('food_data_providers')
      .update(providerUpdateData)
      .eq('id', providerId)
      .eq('user_id', user?.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating food data provider:', error);
      toast({
        title: "Error",
        description: "Failed to update food data provider",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Food data provider updated successfully"
      });
      setEditingProvider(null);
      setEditData({});
      loadProviders();
      if (data && data.is_active) { // Ensure data is not null
        setDefaultFoodDataProviderId(data.id);
      } else if (data && defaultFoodDataProviderId === data.id) { // Ensure data is not null
        setDefaultFoodDataProviderId(null); // If deactivated, remove as default
      }
    }
    setLoading(false);
  };

  const handleDeleteProvider = async (providerId: string) => {
    if (!confirm('Are you sure you want to delete this food data provider?')) return;

    setLoading(true);
    const { error } = await supabase
      .from('food_data_providers')
      .delete()
      .eq('id', providerId)
      .eq('user_id', user?.id);

    if (error) {
      console.error('Error deleting food data provider:', error);
      toast({
        title: "Error",
        description: "Failed to delete food data provider",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Food data provider deleted successfully"
      });
      loadProviders();
      if (defaultFoodDataProviderId === providerId) {
        setDefaultFoodDataProviderId(null); // If deleted, remove as default
      }
    }
    setLoading(false);
  };

  const handleToggleActive = async (providerId: string, isActive: boolean) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('food_data_providers')
      .update({ is_active: isActive })
      .eq('id', providerId)
      .eq('user_id', user?.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating food data provider status:', error);
      toast({
        title: "Error",
        description: "Failed to update food data provider status",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: `Food data provider ${isActive ? 'activated' : 'deactivated'}`
      });
      loadProviders();
      if (data && data.is_active) { // Ensure data is not null
        setDefaultFoodDataProviderId(data.id);
      } else if (data && defaultFoodDataProviderId === data.id) { // Ensure data is not null
        setDefaultFoodDataProviderId(null); // If deactivated, remove as default
      }
    }
    setLoading(false);
  };

  const startEditing = (provider: FoodDataProvider) => {
    setEditingProvider(provider.id);
    setEditData({
      provider_name: provider.provider_name,
      provider_type: provider.provider_type,
      app_id: provider.app_id || '',
      app_key: provider.app_key || '',
      is_active: provider.is_active,
    });
  };

  const cancelEditing = () => {
    setEditingProvider(null);
    setEditData({});
  };

  const getProviderTypes = () => [
    { value: "openfoodfacts", label: "OpenFoodFacts" },
    { value: "nutritionix", label: "Nutritionix" },
    { value: "fatsecret", label: "FatSecret" },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UtensilsCrossed className="h-5 w-5" />
            Food Data Providers
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!showAddForm && (
            <Button onClick={() => setShowAddForm(true)} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Add New Food Data Provider
            </Button>
          )}

          {showAddForm && (
            <form onSubmit={(e) => { e.preventDefault(); handleAddProvider(); }} className="border rounded-lg p-4 space-y-4">
              <h3 className="text-lg font-medium">Add New Food Data Provider</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="new_provider_name">Provider Name</Label>
                  <Input
                    id="new_provider_name"
                    value={newProvider.provider_name}
                    onChange={(e) => setNewProvider(prev => ({ ...prev, provider_name: e.target.value }))}
                    placeholder="My Nutritionix Account"
                  />
                </div>
                <div>
                  <Label htmlFor="new_provider_type">Provider Type</Label>
                  <Select
                    value={newProvider.provider_type}
                    onValueChange={(value) => setNewProvider(prev => ({ ...prev, provider_type: value as 'openfoodfacts' | 'nutritionix' | 'fatsecret', app_id: '', app_key: '' }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getProviderTypes().map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {(newProvider.provider_type === 'nutritionix' || newProvider.provider_type === 'fatsecret') && (
                <>
                  <div>
                    <Label htmlFor="new_app_id">App ID / Consumer Key</Label>
                    <Input
                      id="new_app_id"
                      type="password"
                      value={newProvider.app_id}
                      onChange={(e) => setNewProvider(prev => ({ ...prev, app_id: e.target.value }))}
                      placeholder="Enter App ID or Consumer Key"
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <Label htmlFor="new_app_key">App Key / Consumer Secret</Label>
                    <Input
                      id="new_app_key"
                      type="password"
                      value={newProvider.app_key}
                      onChange={(e) => setNewProvider(prev => ({ ...prev, app_key: e.target.value }))}
                      placeholder="Enter App Key or Consumer Secret"
                      autoComplete="off"
                    />
                  </div>
                </>
              )}

              <div className="flex items-center space-x-2">
                <Switch
                  id="new_is_active"
                  checked={newProvider.is_active}
                  onCheckedChange={(checked) => setNewProvider(prev => ({ ...prev, is_active: checked }))}
                />
                <Label htmlFor="new_is_active">Set as default provider</Label>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={loading}>
                  <Save className="h-4 w-4 mr-2" />
                  Add Provider
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </form>
          )}

          {providers.length > 0 && (
            <>
              <Separator />
              <h3 className="text-lg font-medium">Configured Food Data Providers</h3>
              
              <div className="space-y-4">
                {providers.map((provider) => (
                  <div key={provider.id} className="border rounded-lg p-4">
                    {editingProvider === provider.id ? (
                      // Edit Mode
                      <form onSubmit={(e) => { e.preventDefault(); handleUpdateProvider(provider.id); }} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label>Provider Name</Label>
                            <Input
                              value={editData.provider_name || ''}
                              onChange={(e) => setEditData(prev => ({ ...prev, provider_name: e.target.value }))}
                            />
                          </div>
                          <div>
                            <Label>Provider Type</Label>
                            <Select
                              value={editData.provider_type || ''}
                              onValueChange={(value) => setEditData(prev => ({ ...prev, provider_type: value as 'openfoodfacts' | 'nutritionix' | 'fatsecret', app_id: '', app_key: '' }))}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {getProviderTypes().map(type => (
                                  <SelectItem key={type.value} value={type.value}>
                                    {type.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {(editData.provider_type === 'nutritionix' || editData.provider_type === 'fatsecret') && (
                          <>
                            <div>
                              <Label>App ID / Consumer Key</Label>
                              <Input
                                type="password"
                                value={editData.app_id || ''}
                                onChange={(e) => setEditData(prev => ({ ...prev, app_id: e.target.value }))}
                                placeholder="Enter App ID or Consumer Key"
                                autoComplete="off"
                              />
                            </div>
                            <div>
                              <Label>App Key / Consumer Secret</Label>
                              <Input
                                type="password"
                                value={editData.app_key || ''}
                                onChange={(e) => setEditData(prev => ({ ...prev, app_key: e.target.value }))}
                                placeholder="Enter App Key or Consumer Secret"
                                autoComplete="off"
                              />
                            </div>
                          </>
                        )}

                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={editData.is_active || false}
                            onCheckedChange={(checked) => setEditData(prev => ({ ...prev, is_active: checked }))}
                          />
                          <Label>Set as default provider</Label>
                        </div>

                        <div className="flex gap-2">
                          <Button type="submit" disabled={loading}>
                            <Save className="h-4 w-4 mr-2" />
                            Save Changes
                          </Button>
                          <Button type="button" variant="outline" onClick={cancelEditing}>
                            <X className="h-4 w-4 mr-2" />
                            Cancel
                          </Button>
                        </div>
                      </form>
                    ) : (
                      // View Mode
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">{provider.provider_name}</h4>
                            <p className="text-sm text-muted-foreground">
                              {getProviderTypes().find(t => t.value === provider.provider_type)?.label || provider.provider_type}
                              {provider.app_id && ` - App ID: ${provider.app_id.substring(0, 4)}...`}
                              {provider.app_key && ` - App Key: ${provider.app_key.substring(0, 4)}...`}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={provider.is_active}
                              onCheckedChange={(checked) => handleToggleActive(provider.id, checked)}
                              disabled={loading}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => startEditing(provider)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteProvider(provider.id)}
                              disabled={loading}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {providers.length === 0 && !showAddForm && (
            <div className="text-center py-8 text-muted-foreground">
              <UtensilsCrossed className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No food data providers configured yet.</p>
              <p className="text-sm">Add your first food data provider to enable food search from external sources.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FoodDataProviderSettings;