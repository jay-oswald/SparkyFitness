import React, { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Dumbbell, Edit, Trash2, Settings } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useActiveUser } from "@/contexts/ActiveUserContext";
import EditExerciseEntryDialog from "./EditExerciseEntryDialog";
import { usePreferences } from "@/contexts/PreferencesContext"; // Import usePreferences
import { debug, info, warn, error } from '@/utils/logging'; // Import logging utility
import { parseISO, addDays } from "date-fns"; // Import parseISO and addDays
import { toast } from "@/hooks/use-toast"; // Import toast
import {
  fetchExerciseEntries,
  addExerciseEntry,
  deleteExerciseEntry,
  searchExercises, // Keep searchExercises for internal search
  ExerciseEntry,
} from '@/services/exerciseEntryService';
import ExerciseSearch from "./ExerciseSearch"; // New import for ExerciseSearch
import { Exercise } from '@/services/exerciseSearchService'; // Import Exercise type from exerciseSearchService
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"; // New import for tabs

interface ExerciseCardProps {
  selectedDate: string;
  onExerciseChange: () => void;
}

const ExerciseCard = ({ selectedDate, onExerciseChange }: ExerciseCardProps) => {
  const { user } = useAuth();
  const { activeUserId } = useActiveUser();
  const { loggingLevel } = usePreferences(); // Get logging level
  debug(loggingLevel, "ExerciseCard component rendered for date:", selectedDate);
  const [exerciseEntries, setExerciseEntries] = useState<ExerciseEntry[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const addDialogRef = useRef<HTMLDivElement>(null); // Declare addDialogRef
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null); // New state for selected exercise object
  const [duration, setDuration] = useState<number>(30);
  const [notes, setNotes] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [editingEntry, setEditingEntry] = useState<ExerciseEntry | null>(null);
  const [searchTerm, setSearchTerm] = useState(""); // Keep for internal search
  const [exercises, setExercises] = useState<Exercise[]>([]); // Keep for internal search
  const [searchLoading, setSearchLoading] = useState(false); // Keep for internal search
  const [filterType, setFilterType] = useState<string>("all"); // Keep for internal search
  const [searchMode, setSearchMode] = useState<'internal' | 'external'>('internal'); // New state for search mode

  const currentUserId = activeUserId || user?.id;
  debug(loggingLevel, "Current user ID:", currentUserId);

  const _fetchExerciseEntries = useCallback(async () => {
    debug(loggingLevel, "Fetching exercise entries for date:", selectedDate);
    setLoading(true);
    try {
      const data = await fetchExerciseEntries(selectedDate); // Use imported fetchExerciseEntries
      info(loggingLevel, "Exercise entries fetched successfully:", data);
      setExerciseEntries(data || []);
    } catch (err) {
      error(loggingLevel, "Error fetching exercise entries:", err);
    } finally {
      setLoading(false);
    }
  }, [currentUserId, selectedDate, loggingLevel]);

  useEffect(() => {
    debug(loggingLevel, "currentUserId or selectedDate useEffect triggered.", { currentUserId, selectedDate });
    if (currentUserId) {
      _fetchExerciseEntries();
    }
  }, [currentUserId, selectedDate, _fetchExerciseEntries]);

  useEffect(() => {
    const performInternalSearch = async () => {
      if (!currentUserId) return;

      setSearchLoading(true);
      try {
        const results = await searchExercises(searchTerm, filterType);
        setExercises(results);
        info(loggingLevel, "Internal exercise search results:", results);
      } catch (err) {
        error(loggingLevel, "Error during internal exercise search:", err);
      } finally {
        setSearchLoading(false);
      }
    };

    // Only perform search if searchMode is 'internal'
    if (searchMode === 'internal') {
      const delayDebounceFn = setTimeout(() => {
        performInternalSearch();
      }, 300); // Debounce search to avoid excessive API calls

      return () => clearTimeout(delayDebounceFn);
    }
  }, [searchTerm, filterType, currentUserId, loggingLevel, searchMode]);

  const handleOpenAddDialog = () => {
    debug(loggingLevel, "Opening add exercise dialog.");
    setIsAddDialogOpen(true);
    setSelectedExerciseId(null); // Reset selected exercise
    setSelectedExercise(null); // Reset selected exercise object
    setDuration(30);
    setNotes("");
  };

  const handleCloseAddDialog = () => {
    debug(loggingLevel, "Closing add exercise dialog.");
    setIsAddDialogOpen(false);
    setSelectedExerciseId(null);
    setSelectedExercise(null);
    setDuration(30);
    setNotes("");
  };

  const handleExerciseSelect = (exercise: Exercise) => { // Modified to accept full Exercise object
    debug(loggingLevel, "Exercise selected in search:", exercise.id);
    setSelectedExerciseId(exercise.id);
    setSelectedExercise(exercise); // Store the full exercise object
    if (exercise.duration_min) {
      setDuration(exercise.duration_min); // Pre-fill duration if available from external provider
    } else {
      setDuration(30); // Default to 30 minutes if not provided
    }
  };

  const handleSubmit = async () => {
    debug(loggingLevel, "Handling submit add exercise.");
    if (!selectedExerciseId || !selectedExercise) { // Check for selectedExercise object
      warn(loggingLevel, "Submit called with no exercise selected.");
      toast({
        title: "Error",
        description: "Please select an exercise.",
        variant: "destructive",
      });
      return;
    }

    const caloriesPerHour = selectedExercise.calories_per_hour || 300;
    const caloriesBurned = Math.round((caloriesPerHour / 60) * duration);
    debug(loggingLevel, "Calculated calories burned:", caloriesBurned);

    try {
      await addExerciseEntry({
        exercise_id: selectedExerciseId,
        duration_minutes: duration,
        calories_burned: caloriesBurned,
        entry_date: selectedDate,
        notes: notes,
      });
      info(loggingLevel, "Exercise entry added successfully.");
      toast({
        title: "Success",
        description: "Exercise entry added successfully.",
      });
      _fetchExerciseEntries(); // Call the memoized local function
      onExerciseChange();
      handleCloseAddDialog();
    } catch (err) {
      error(loggingLevel, "Error adding exercise entry:", err);
      toast({
        title: "Error",
        description: "Failed to add exercise entry.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (entryId: string) => {
    debug(loggingLevel, "Handling delete exercise entry:", entryId);
    try {
      await deleteExerciseEntry(entryId);
      info(loggingLevel, "Exercise entry deleted successfully:", entryId);
      toast({
        title: "Success",
        description: "Exercise entry deleted successfully.",
      });
      _fetchExerciseEntries(); // Call the memoized local function
      onExerciseChange();
    } catch (err) {
      error(loggingLevel, "Error deleting exercise entry:", err);
      toast({
        title: "Error",
        description: "Failed to delete exercise entry.",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (entry: ExerciseEntry) => {
    debug(loggingLevel, "Handling edit exercise entry:", entry.id);
    setEditingEntry(entry);
  };

  const handleEditComplete = () => {
    debug(loggingLevel, "Handling edit exercise entry complete.");
    setEditingEntry(null);
    _fetchExerciseEntries(); // Call the memoized local function
    onExerciseChange();
    info(loggingLevel, "Exercise entry edit complete and refresh triggered.");
  };

  const handleEditExerciseDatabase = (exerciseId: string) => {
    debug(loggingLevel, "Handling edit exercise database for ID:", exerciseId);
    // TODO: Implement navigation or dialog for editing exercise database entry
  };

  const handleDataChange = () => {
    debug(loggingLevel, "Handling data change, fetching entries and triggering parent change.");
    _fetchExerciseEntries(); // Call the memoized local function
    onExerciseChange();
  };

  if (loading) {
    debug(loggingLevel, "ExerciseCard is loading.");
    return <div>Loading exercises...</div>;
  }
  debug(loggingLevel, "ExerciseCard finished loading.");

  const totalExerciseCaloriesBurned = exerciseEntries.reduce((sum, entry) => sum + Number(entry.calories_burned), 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Exercise</CardTitle>
          <Button size="sm" onClick={handleOpenAddDialog}>
            <Plus className="w-4 h-4 mr-1" />
            Add Exercise
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {exerciseEntries.length === 0 ? (
          <p>No exercise entries for this day.</p>
        ) : (
          <div className="space-y-4">
            {exerciseEntries.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between p-4 bg-gray-100 rounded-md">
                <div className="flex items-center">
                  <Dumbbell className="w-5 h-5 mr-2" />
                  <div>
                    <span className="font-medium">{entry.exercises?.name || 'Unknown Exercise'}</span>
                    <div className="text-sm text-gray-500">
                      {entry.exercises?.name === "Active Calories (Apple Health)"
                        ? `${Math.round(entry.calories_burned)} active calories`
                        : `${entry.duration_minutes} minutes • ${Math.round(entry.calories_burned)} calories`}
                    </div>
                    {entry.notes && (
                      <div className="text-xs text-gray-400">{entry.notes}</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(entry)}
                    className="h-8 w-8"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  {entry.exercises?.user_id === currentUserId && (
                    <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEditExerciseDatabase(entry.exercise_id)}
                    className="h-8 w-8"
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(entry.id)}
                    className="h-8 w-8 hover:bg-gray-200"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pt-2 gap-4">
              <span className="font-semibold">Exercise Total:</span>
              <div className="grid grid-cols-1 gap-2 sm:gap-4 text-xs sm:text-sm">
                <div className="text-center">
                  <div className="font-bold text-gray-900 dark:text-gray-100">{Math.round(totalExerciseCaloriesBurned)}</div>
                  <div className="text-xs text-gray-500">cal</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add Exercise Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent ref={addDialogRef}>
            <DialogHeader>
              <DialogTitle>Add Exercise</DialogTitle>
              <DialogDescription>
                Add a new exercise entry for the selected date.
              </DialogDescription>
            </DialogHeader>
            <Tabs value={searchMode} onValueChange={(value) => setSearchMode(value as 'internal' | 'external')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="internal">My Exercises</TabsTrigger>
                <TabsTrigger value="external">Online</TabsTrigger>
              </TabsList>
              <TabsContent value="internal" className="mt-4 space-y-4">
                <div className="mb-4">
                  <Input
                    type="text"
                    placeholder="Search your exercises..."
                    value={searchTerm}
                    onChange={(e) => {
                      debug(loggingLevel, "Exercise search term changed:", e.target.value);
                      setSearchTerm(e.target.value);
                    }}
                    className="mb-2"
                  />
                  <Select value={filterType} onValueChange={(value) => {
                    debug(loggingLevel, "Exercise filter type changed:", value);
                    setFilterType(value);
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filter exercises" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Exercises</SelectItem>
                      <SelectItem value="my_own">My Own</SelectItem>
                      <SelectItem value="family">Family</SelectItem>
                      <SelectItem value="public">Public</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {searchLoading && <div>Searching...</div>}

                <div className="max-h-60 overflow-y-auto space-y-2 mb-4">
                  {exercises.map((exercise) => (
                    <div
                      key={exercise.id}
                      className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer ${
                        selectedExerciseId === exercise.id ? 'bg-blue-100 border-blue-300' : 'hover:bg-gray-50'
                      }`}
                      onClick={() => handleExerciseSelect(exercise)}
                    >
                      <div>
                        <div className="font-medium">{exercise.name}</div>
                        <div className="text-sm text-gray-500">
                          {exercise.category} • {exercise.calories_per_hour} cal/hour
                        </div>
                        {exercise.description && (
                          <div className="text-xs text-gray-400">{exercise.description}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {searchTerm && !searchLoading && exercises.length === 0 && (
                  <div className="text-center text-gray-500 mb-4">No exercises found</div>
                )}
              </TabsContent>
              <TabsContent value="external" className="mt-4 space-y-4">
                <ExerciseSearch onExerciseSelect={handleExerciseSelect} showInternalTab={false} /> {/* Now expects Exercise object */}
              </TabsContent>
            </Tabs>
            {searchMode === 'internal' && (
              <>
                <div className="mt-4">
                  <label htmlFor="duration" className="block text-gray-700 text-sm font-bold mb-2">
                    Duration (minutes):
                  </label>
                  <Input
                    type="number"
                    id="duration"
                    value={duration}
                    onChange={(e) => {
                      debug(loggingLevel, "Exercise duration changed:", e.target.value);
                      setDuration(Number(e.target.value));
                    }}
                  />
                </div>
                <div className="mt-4">
                  <label htmlFor="notes" className="block text-gray-700 text-sm font-bold mb-2">
                    Notes:
                  </label>
                  <textarea
                    id="notes"
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    value={notes}
                    onChange={(e) => {
                      debug(loggingLevel, "Exercise notes changed:", e.target.value);
                      setNotes(e.target.value);
                    }}
                  />
                </div>
              </>
            )}
            <div className="items-center px-4 py-3">
              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={!selectedExerciseId}
              >
                Add
              </Button>
              <Button variant="ghost" className="mt-2 px-4 py-2 text-gray-500 text-base font-medium rounded-md w-full shadow-sm hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300" onClick={handleCloseAddDialog}>
                Cancel
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Exercise Entry Dialog */}
        {editingEntry && (
          <EditExerciseEntryDialog
            entry={editingEntry}
            open={!!editingEntry}
            onOpenChange={(open) => {
              debug(loggingLevel, "Edit exercise entry dialog open state changed:", open);
              if (!open) {
                setEditingEntry(null);
              }
            }}
            onSave={handleEditComplete}
          />
        )}
      </CardContent>
    </Card>
  );
};

export default ExerciseCard;
