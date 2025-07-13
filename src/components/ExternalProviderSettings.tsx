import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, Edit, Save, X, Database } from "lucide-react"; // Changed icon
import { apiCall } from '@/services/api';
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { usePreferences } from "@/contexts/PreferencesContext";

interface ExternalDataProvider { // Renamed interface
  id: string;
  provider_name: string;
  provider_type: 'openfoodfacts' | 'nutritionix' | 'fatsecret' | 'wger'; // Added wger
  app_id: string | null;
  app_key: string | null;
  is_active: boolean;
}

const ExternalProviderSettings = () => { // Renamed component
  const { user } = useAuth();
  const { toast } = useToast();
  const { defaultFoodDataProviderId, setDefaultFoodDataProviderId } = usePreferences(); // Keep for now, will refactor later
  const [providers, setProviders] = useState<ExternalDataProvider[]>([]);
  const [newProvider, setNewProvider] = useState({
    provider_name: '',
    provider_type: 'openfoodfacts' as 'openfoodfacts' | 'nutritionix' | 'fatsecret' | 'wger', // Added wger
    app_id: '',
    app_key: '',
    is_active: false,
  });
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<ExternalDataProvider>>({});
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
    try {
      const data = await apiCall(`/external-providers/user/${user.id}`, { // Corrected API endpoint
        method: 'GET',
        suppress404Toast: true,
      });
      setProviders(data.map((provider: any) => ({
        ...provider,
        provider_type: provider.provider_type as 'openfoodfacts' | 'nutritionix' | 'fatsecret' | 'wger' // Added wger
      })) || []);
    } catch (error: any) {
      console.error('Error loading external data providers:', error);
      toast({
        title: "Error",
        description: `Failed to load external data providers: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
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

    // Wger might not need app_id/app_key, so adjust validation
    if ((newProvider.provider_type === 'nutritionix' || newProvider.provider_type === 'fatsecret') && (!newProvider.app_id || !newProvider.app_key)) {
      toast({
        title: "Error",
        description: `Please provide App ID and App Key for ${newProvider.provider_type}`,
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const data = await apiCall('/external-providers', { // Corrected API endpoint
        method: 'POST',
        body: JSON.stringify({
          user_id: user.id, // user_id will be handled by backend from JWT
          provider_name: newProvider.provider_name,
          provider_type: newProvider.provider_type,
          app_id: newProvider.app_id || null,
          app_key: newProvider.app_key || null,
          is_active: newProvider.is_active,
        }),
      });

      toast({
        title: "Success",
        description: "External data provider added successfully"
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
      if (data && data.is_active && (data.provider_type === 'openfoodfacts' || data.provider_type === 'nutritionix' || data.provider_type === 'fatsecret')) { // Only set default for food providers
        setDefaultFoodDataProviderId(data.id);
      }
    } catch (error: any) {
      console.error('Error adding external data provider:', error);
      toast({
        title: "Error",
        description: `Failed to add external data provider: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProvider = async (providerId: string) => {
    setLoading(true);
    const providerUpdateData: Partial<ExternalDataProvider> = { // Renamed interface
      provider_name: editData.provider_name,
      provider_type: editData.provider_type,
      app_id: editData.app_id || null,
      app_key: editData.app_key || null,
      is_active: editData.is_active,
    };

    try {
      const data = await apiCall(`/external-providers/${providerId}`, { // Corrected API endpoint
        method: 'PUT',
        body: JSON.stringify(providerUpdateData),
      });

      toast({
        title: "Success",
        description: "External data provider updated successfully"
      });
      setEditingProvider(null);
      setEditData({});
      loadProviders();
      if (data && data.is_active && (data.provider_type === 'openfoodfacts' || data.provider_type === 'nutritionix' || data.provider_type === 'fatsecret')) { // Only set default for food providers
        setDefaultFoodDataProviderId(data.id);
      } else if (data && defaultFoodDataProviderId === data.id) {
        setDefaultFoodDataProviderId(null);
      }
    } catch (error: any) {
      console.error('Error updating external data provider:', error);
      toast({
        title: "Error",
        description: `Failed to update external data provider: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProvider = async (providerId: string) => {
    if (!confirm('Are you sure you want to delete this external data provider?')) return; // Updated confirmation message

    setLoading(true);
    try {
      await apiCall(`/external-providers/${providerId}`, { // Corrected API endpoint
        method: 'DELETE',
      });

      toast({
        title: "Success",
        description: "External data provider deleted successfully"
      });
      loadProviders();
      if (defaultFoodDataProviderId === providerId) {
        setDefaultFoodDataProviderId(null);
      }
    } catch (error: any) {
      console.error('Error deleting external data provider:', error);
      toast({
        title: "Error",
        description: `Failed to delete external data provider: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (providerId: string, isActive: boolean) => {
    setLoading(true);
    try {
      const data = await apiCall(`/external-providers/${providerId}`, { // Corrected API endpoint
        method: 'PUT',
        body: JSON.stringify({ is_active: isActive }),
      });

      toast({
        title: "Success",
        description: `External data provider ${isActive ? 'activated' : 'deactivated'}` // Updated message
      });
      loadProviders();
      if (data && data.is_active && (data.provider_type === 'openfoodfacts' || data.provider_type === 'nutritionix' || data.provider_type === 'fatsecret')) { // Only set default for food providers
        setDefaultFoodDataProviderId(data.id);
      } else if (data && defaultFoodDataProviderId === data.id) {
        setDefaultFoodDataProviderId(null);
      }
    } catch (error: any) {
      console.error('Error updating external data provider status:', error);
      toast({
        title: "Error",
        description: `Failed to update external data provider status: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };


  const startEditing = (provider: ExternalDataProvider) => { // Renamed interface
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
    { value: "wger", label: "Wger (Exercise)" }, // Added wger
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" /> {/* Changed icon */}
            External Data Providers {/* Changed title */}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!showAddForm && (
            <Button onClick={() => setShowAddForm(true)} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Add New External Data Provider {/* Changed button text */}
            </Button>
          )}

          {showAddForm && (
            <form onSubmit={(e) => { e.preventDefault(); handleAddProvider(); }} className="border rounded-lg p-4 space-y-4">
              <h3 className="text-lg font-medium">Add New External Data Provider</h3> {/* Changed title */}
              
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
                    onValueChange={(value) => setNewProvider(prev => ({ ...prev, provider_type: value as 'openfoodfacts' | 'nutritionix' | 'fatsecret' | 'wger', app_id: '', app_key: '' }))} // Added wger
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

              {(newProvider.provider_type === 'nutritionix' || newProvider.provider_type === 'fatsecret') && ( // Only show for these types
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
                <Label htmlFor="new_is_active">Activate this provider</Label>
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
              <h3 className="text-lg font-medium">Configured External Data Providers</h3> {/* Changed title */}
              
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
                              onValueChange={(value) => setEditData(prev => ({ ...prev, provider_type: value as 'openfoodfacts' | 'nutritionix' | 'fatsecret' | 'wger', app_id: '', app_key: '' }))} // Added wger
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
                        {(editData.provider_type === 'nutritionix' || editData.provider_type === 'fatsecret') && ( // Only show for these types
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
                          <Label>Activate this provider</Label>
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
              <Database className="h-12 w-12 mx-auto mb-4 opacity-50" /> {/* Changed icon */}
              <p>No external data providers configured yet.</p> {/* Changed message */}
              <p className="text-sm">Add your first external data provider to enable search from external sources.</p> {/* Changed message */}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ExternalProviderSettings;