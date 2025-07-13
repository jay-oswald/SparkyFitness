import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // New import
import { usePreferences } from "@/contexts/PreferencesContext";
import { debug, info, warn, error } from '@/utils/logging';
import { searchExercises as searchExercisesService, searchExternalExercises, addExternalExerciseToUserExercises, Exercise } from '@/services/exerciseSearchService';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Loader2, Search } from "lucide-react"; // Added Loader2 and Search
import { useToast } from "@/hooks/use-toast";
import { getExternalDataProviders, DataProvider, getProviderCategory } from '@/services/externalProviderService'; // New import


interface ExerciseSearchProps {
  onExerciseSelect: (exercise: Exercise) => void;
  showInternalTab?: boolean; // New prop
}

const ExerciseSearch = ({ onExerciseSelect, showInternalTab = true }: ExerciseSearchProps) => {
  const { loggingLevel } = usePreferences();
  const { toast } = useToast();
  debug(loggingLevel, "ExerciseSearch: Component rendered.");
  const [searchTerm, setSearchTerm] = useState("");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchSource, setSearchSource] = useState<'internal' | 'external'>(showInternalTab ? 'internal' : 'external');
  const [providers, setProviders] = useState<DataProvider[]>([]); // New state for providers
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null); // New state for selected provider

  const handleSearch = async (query: string) => {
    debug(loggingLevel, `ExerciseSearch: Searching exercises with query: "${query}" from source: "${searchSource}" and provider: "${selectedProvider}"`);
    if (!query.trim()) {
      debug(loggingLevel, "ExerciseSearch: Search query is empty, clearing exercises.");
      setExercises([]);
      return;
    }

    setLoading(true);
    try {
      let data: Exercise[] = [];
      if (searchSource === 'internal') {
        data = await searchExercisesService(query);
      } else {
        if (!selectedProvider) {
          warn(loggingLevel, "ExerciseSearch: No external provider selected.");
          setLoading(false);
          return;
        }
        data = await searchExternalExercises(query, selectedProvider); // Pass selectedProvider
      }
      info(loggingLevel, "ExerciseSearch: Exercises search results:", data);
      setExercises(data || []);
    } catch (err) {
      error(loggingLevel, "ExerciseSearch: Error searching exercises:", err);
      toast({
        title: "Error",
        description: `Failed to search exercises: ${err instanceof Error ? err.message : String(err)}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      debug(loggingLevel, "ExerciseSearch: Loading state set to false.");
    }
  };

  const handleAddExternalExercise = async (wgerExerciseId: string): Promise<Exercise | undefined> => {
    setLoading(true);
    try {
      const newExercise = await addExternalExerciseToUserExercises(wgerExerciseId);
      toast({
        title: "Success",
        description: `${newExercise.name} added to your exercises.`,
      });
      // Do NOT call onExerciseSelect here, it's handled by the caller
      return newExercise; // Return the newly added exercise
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to add exercise: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive"
      });
      return undefined; // Return undefined on error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    debug(loggingLevel, "ExerciseSearch: searchTerm or searchSource useEffect triggered.");
    if (searchSource === 'internal') { // Only debounce for internal search
      const timeoutId = setTimeout(() => {
        handleSearch(searchTerm);
      }, 300);

      return () => {
        debug(loggingLevel, "ExerciseSearch: Cleaning up search timeout.");
        clearTimeout(timeoutId);
      };
    }
  }, [searchTerm, searchSource, selectedProvider, loggingLevel]); // Added selectedProvider to dependencies

  useEffect(() => {
    debug(loggingLevel, "ExerciseSearch: fetchProviders useEffect triggered. Current searchSource:", searchSource);
    const fetchProviders = async () => {
      try {
        const fetchedProviders = await getExternalDataProviders();
        debug(loggingLevel, "ExerciseSearch: Fetched providers:", fetchedProviders);
        const exerciseProviders = fetchedProviders.filter(p => {
          const category = getProviderCategory(p);
          debug(loggingLevel, `ExerciseSearch: Filtering provider: ${p.provider_name}, category: ${category}, is_active: ${p.is_active}`);
          return category === 'exercise' && p.is_active;
        });
        debug(loggingLevel, "ExerciseSearch: Filtered exercise providers:", exerciseProviders);
        setProviders(exerciseProviders);
        if (exerciseProviders.length > 0) {
          setSelectedProvider(exerciseProviders[0].provider_type); // Auto-select first enabled exercise provider
        } else {
          warn(loggingLevel, "ExerciseSearch: No enabled exercise providers found.");
        }
      } catch (err) {
        error(loggingLevel, "ExerciseSearch: Error fetching external data providers:", err);
        toast({
          title: "Error",
          description: `Failed to load external providers: ${err instanceof Error ? err.message : String(err)}`,
          variant: "destructive"
        });
      }
    };

    if (searchSource === 'external') {
      fetchProviders();
    }
  }, [searchSource, loggingLevel, toast]);

  return (
    <div className="space-y-4">
      {showInternalTab ? (
        <Tabs value={searchSource} onValueChange={(value) => setSearchSource(value as 'internal' | 'external')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="internal">My Exercises</TabsTrigger>
            <TabsTrigger value="external">External Database</TabsTrigger>
          </TabsList>
          <TabsContent value="internal" className="mt-4 space-y-4">
            <Input
              type="text"
              placeholder="Search your exercises..."
              value={searchTerm}
              onChange={(e) => {
                debug(loggingLevel, "ExerciseSearch: Internal search term input changed:", e.target.value);
                setSearchTerm(e.target.value);
              }}
            />
            {loading && <div>Searching...</div>}
            <div className="max-h-60 overflow-y-auto space-y-2">
              {exercises.map((exercise) => (
                <div key={exercise.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">{exercise.name}</div>
                    <div className="text-sm text-gray-500">
                      {exercise.category} • {exercise.calories_per_hour} cal/hour
                    </div>
                    {exercise.description && (
                      <div className="text-xs text-gray-400">{exercise.description}</div>
                    )}
                  </div>
                  <Button onClick={() => {
                    debug(loggingLevel, "ExerciseSearch: Select button clicked for internal exercise:", exercise.name);
                    onExerciseSelect(exercise);
                  }}>
                    Select
                  </Button>
                </div>
              ))}
            </div>
            {searchTerm && !loading && exercises.length === 0 && (
              <div className="text-center text-gray-500">No exercises found in your database.</div>
            )}
          </TabsContent>
          <TabsContent value="external" className="mt-4 space-y-4">
            <Select value={selectedProvider || ''} onValueChange={setSelectedProvider}>
              <SelectTrigger className="w-full mb-2">
                <SelectValue placeholder="Select a provider" />
              </SelectTrigger>
              <SelectContent>
                {providers.map(provider => (
                  <SelectItem key={provider.id} value={provider.provider_type}> {/* Use provider_type for value */}
                    {provider.provider_name} {/* Display provider_name */}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex space-x-2 items-center">
              <Input
                type="text"
                placeholder={`Search ${selectedProvider || 'external'} database...`}
                value={searchTerm}
                onChange={(e) => {
                  debug(loggingLevel, "ExerciseSearch: External search term input changed:", e.target.value);
                  setSearchTerm(e.target.value);
                }}
                className="flex-1"
              />
              <Button onClick={() => handleSearch(searchTerm)} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>
            {loading && <div>Searching...</div>}
            <div className="max-h-60 overflow-y-auto space-y-2">
              {exercises.map((exercise) => (
                <div key={exercise.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">{exercise.name}</div>
                    <div className="text-sm text-gray-500">
                      {exercise.category}
                      {exercise.calories_per_hour && ` • ${exercise.calories_per_hour} cal/hour`}
                    </div>
                    {exercise.description && (
                      <div className="text-xs text-gray-400">{exercise.description}</div>
                    )}
                  </div>
                  <Button onClick={() => {
                    debug(loggingLevel, "ExerciseSearch: Add button clicked for external exercise:", exercise.name);
                    handleAddExternalExercise(exercise.id).then(newExercise => {
                      if (newExercise) {
                        onExerciseSelect(newExercise);
                      }
                    }).catch(err => {
                      error(loggingLevel, "ExerciseSearch: Error adding external exercise:", err);
                    });
                  }}>
                    <Plus className="h-4 w-4 mr-2" /> Add
                  </Button>
                </div>
              ))}
            </div>
            {searchTerm && !loading && exercises.length === 0 && (
              <div className="text-center text-gray-500">No exercises found in {selectedProvider || 'external'} database.</div>
            )}
          </TabsContent>
        </Tabs>
      ) : (
        // Render only the external search if showInternalTab is false
        <div className="mt-4 space-y-4">
          <Select value={selectedProvider || ''} onValueChange={setSelectedProvider}>
            <SelectTrigger className="w-full mb-2">
              <SelectValue placeholder="Select a provider" />
            </SelectTrigger>
            <SelectContent>
              {providers.map(provider => (
                <SelectItem key={provider.id} value={provider.provider_type}> {/* Use provider_type for value */}
                  {provider.provider_name} {/* Display provider_name */}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex space-x-2 items-center">
            <Input
              type="text"
              placeholder={`Search ${selectedProvider || 'external'} database...`}
              value={searchTerm}
              onChange={(e) => {
                debug(loggingLevel, "ExerciseSearch: External search term input changed:", e.target.value);
                setSearchTerm(e.target.value);
              }}
              className="flex-1"
            />
            <Button onClick={() => handleSearch(searchTerm)} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>
          {loading && <div>Searching...</div>}
          <div className="max-h-60 overflow-y-auto space-y-2">
            {exercises.map((exercise) => (
              <div key={exercise.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="font-medium">{exercise.name}</div>
                  <div className="text-sm text-gray-500">
                    {exercise.category}
                    {exercise.calories_per_hour && ` • ${exercise.calories_per_hour} cal/hour`}
                  </div>
                  {exercise.description && (
                    <div className="text-xs text-gray-400">{exercise.description}</div>
                  )}
                </div>
                <Button onClick={() => {
                  debug(loggingLevel, "ExerciseSearch: Add button clicked for external exercise:", exercise.name);
                  handleAddExternalExercise(exercise.id).then(newExercise => {
                    if (newExercise) {
                      onExerciseSelect(newExercise);
                    }
                  }).catch(err => {
                    error(loggingLevel, "ExerciseSearch: Error adding external exercise:", err);
                  });
                }}>
                  <Plus className="h-4 w-4 mr-2" /> Add
                </Button>
              </div>
            ))}
          </div>
          {searchTerm && !loading && exercises.length === 0 && (
            <div className="text-center text-gray-500">No exercises found in {selectedProvider || 'external'} database.</div>
          )}
        </div>
      )}
    </div>
  );
};

export default ExerciseSearch;
