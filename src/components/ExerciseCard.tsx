import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Dumbbell, Edit, Trash2, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveUser } from "@/contexts/ActiveUserContext";
import EditExerciseEntryDialog from "./EditExerciseEntryDialog";
import { usePreferences } from "@/contexts/PreferencesContext"; // Import usePreferences
import { debug, info, warn, error } from '@/utils/logging'; // Import logging utility


interface ExerciseEntry {
  id: string;
  exercise_id: string;
  duration_minutes: number;
  calories_burned: number;
  entry_date: string;
  notes?: string;
  exercises: {
    id: string;
    name: string;
    user_id?: string;
    category: string;
    calories_per_hour: number;
  } | null;
}

interface Exercise {
  id: string;
  name: string;
  category: string;
  calories_per_hour: number;
  description?: string;
  user_id?: string;
}

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
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(30);
  const [notes, setNotes] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [editingEntry, setEditingEntry] = useState<ExerciseEntry | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");

  const currentUserId = activeUserId || user?.id;
  debug(loggingLevel, "Current user ID:", currentUserId);

  useEffect(() => {
    debug(loggingLevel, "currentUserId or selectedDate useEffect triggered.", { currentUserId, selectedDate });
    if (currentUserId) {
      fetchExerciseEntries();
    }
  }, [currentUserId, selectedDate]);

  useEffect(() => {
    debug(loggingLevel, "searchTerm, filterType, or isAddDialogOpen useEffect triggered.", { searchTerm, filterType, isAddDialogOpen });
    const timeoutId = setTimeout(() => {
      if (searchTerm.trim() || isAddDialogOpen) {
        searchExercises(searchTerm);
      } else {
        setExercises([]);
      }
    }, 300);

    return () => {
      debug(loggingLevel, "Cleaning up search timeout.");
      clearTimeout(timeoutId);
    };
  }, [searchTerm, filterType, isAddDialogOpen]);

  const fetchExerciseEntries = async () => {
    debug(loggingLevel, "Fetching exercise entries for date:", selectedDate);
    setLoading(true);
    try {
      const { data, error: supabaseError } = await supabase
        .from('exercise_entries')
        .select(`
          id,
          exercise_id,
          duration_minutes,
          calories_burned,
          entry_date,
          notes,
          exercises (
            id,
            name,
            user_id,
            category,
            calories_per_hour
          )
        `)
        .eq('user_id', currentUserId)
        .eq('entry_date', selectedDate);

      if (supabaseError) {
        error(loggingLevel, "Error fetching exercise entries:", supabaseError);
      } else {
        info(loggingLevel, "Exercise entries fetched successfully:", data);
        setExerciseEntries(data || []);
      }
    } catch (err) {
      error(loggingLevel, "Error fetching exercise entries:", err);
    } finally {
      setLoading(false);
    }
  };

  const searchExercises = async (query: string) => {
    debug(loggingLevel, "Searching exercises with query:", query);
    setSearchLoading(true);
    try {
      let queryBuilder = supabase
        .from('exercises')
        .select('*');

      if (query.trim()) {
        queryBuilder = queryBuilder.ilike('name', `%${query}%`);
      }

      // Apply filter
      if (filterType === "my_own") {
        debug(loggingLevel, "Filtering exercises by my own.");
        queryBuilder = queryBuilder.eq('user_id', currentUserId);
      } else if (filterType === "public") {
        debug(loggingLevel, "Filtering exercises by public.");
        queryBuilder = queryBuilder.is('user_id', null);
      } else if (filterType === "family") {
        debug(loggingLevel, "Filtering exercises by family (currently showing my own).");
        // For family, we'd need to implement family sharing logic
        // For now, just show user's own exercises
        queryBuilder = queryBuilder.eq('user_id', currentUserId);
      }
      debug(loggingLevel, "Applying limit 20 to exercise search.");
      queryBuilder = queryBuilder.limit(20);

      const { data, error: supabaseError } = await queryBuilder;

      if (supabaseError) {
        error(loggingLevel, "Error searching exercises:", supabaseError);
      } else {
        info(loggingLevel, "Exercises search results:", data);
        setExercises(data || []);
      }
    } catch (err) {
      error(loggingLevel, "Error searching exercises:", err);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleOpenAddDialog = () => {
    debug(loggingLevel, "Opening add exercise dialog.");
    setIsAddDialogOpen(true);
    setSearchTerm("");
    setExercises([]);
  };

  const handleCloseAddDialog = () => {
    debug(loggingLevel, "Closing add exercise dialog.");
    setIsAddDialogOpen(false);
    setSelectedExerciseId(null);
    setDuration(30);
    setNotes("");
    setSearchTerm("");
    setExercises([]);
    info(loggingLevel, "Add exercise dialog closed and state reset.");
  };

  const handleExerciseSelect = (exerciseId: string) => {
    debug(loggingLevel, "Exercise selected in search:", exerciseId);
    setSelectedExerciseId(exerciseId);
  };

  const handleSubmit = async () => {
    debug(loggingLevel, "Handling submit add exercise.");
    if (!selectedExerciseId) {
      warn(loggingLevel, "Submit called with no exercise selected.");
      alert("Please select an exercise.");
      return;
    }

    const selectedExercise = exercises.find(ex => ex.id === selectedExerciseId);
    if (!selectedExercise) {
      error(loggingLevel, "Selected exercise not found in state:", selectedExerciseId);
      alert("Exercise not found.");
      return;
    }

    const caloriesPerHour = selectedExercise.calories_per_hour || 300;
    const caloriesBurned = (caloriesPerHour / 60) * duration;
    debug(loggingLevel, "Calculated calories burned:", caloriesBurned);

    try {
      const { error: supabaseError } = await supabase
        .from('exercise_entries')
        .insert([
          {
            user_id: currentUserId,
            exercise_id: selectedExerciseId,
            duration_minutes: duration,
            calories_burned: caloriesBurned,
            entry_date: selectedDate,
            notes: notes,
          },
        ]);

      if (supabaseError) {
        error(loggingLevel, "Error adding exercise entry:", supabaseError);
        alert("Failed to add exercise entry.");
      } else {
        info(loggingLevel, "Exercise entry added successfully.");
        fetchExerciseEntries();
        onExerciseChange();
        handleCloseAddDialog();
      }
    } catch (err) {
      error(loggingLevel, "Error adding exercise entry:", err);
      alert("Failed to add exercise entry.");
    }
  };

  const handleDelete = async (entryId: string) => {
    debug(loggingLevel, "Handling delete exercise entry:", entryId);
    try {
      const { error: supabaseError } = await supabase
        .from('exercise_entries')
        .delete()
        .eq('id', entryId);

      if (supabaseError) {
        error(loggingLevel, "Error deleting exercise entry:", supabaseError);
        alert("Failed to delete exercise entry.");
      } else {
        info(loggingLevel, "Exercise entry deleted successfully:", entryId);
        fetchExerciseEntries();
        onExerciseChange();
      }
    } catch (err) {
      error(loggingLevel, "Error deleting exercise entry:", err);
      alert("Failed to delete exercise entry.");
    }
  };

  const handleEdit = (entry: ExerciseEntry) => {
    debug(loggingLevel, "Handling edit exercise entry:", entry.id);
    setEditingEntry(entry);
  };

  const handleEditComplete = () => {
    debug(loggingLevel, "Handling edit exercise entry complete.");
    setEditingEntry(null);
    fetchExerciseEntries();
    onExerciseChange();
    info(loggingLevel, "Exercise entry edit complete and refresh triggered.");
  };

  const handleEditExerciseDatabase = (exerciseId: string) => {
    debug(loggingLevel, "Handling edit exercise database for ID:", exerciseId);
    // TODO: Implement navigation or dialog for editing exercise database entry
  };

  const handleDataChange = () => {
    debug(loggingLevel, "Handling data change, fetching entries and triggering parent change.");
    fetchExerciseEntries();
    onExerciseChange();
  };

  if (loading) {
    debug(loggingLevel, "ExerciseCard is loading.");
    return <div>Loading exercises...</div>;
  }
  debug(loggingLevel, "ExerciseCard finished loading.");

  const totalExerciseCaloriesBurned = exerciseEntries.reduce((sum, entry) => sum + entry.calories_burned, 0);

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
                      {entry.duration_minutes} minutes • {Math.round(entry.calories_burned)} calories
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
        {isAddDialogOpen && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3 text-center">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Add Exercise</h3>
                <div className="mt-2">
                  <div className="mb-4">
                    <Input
                      type="text"
                      placeholder="Search for exercises..."
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
                        onClick={() => handleExerciseSelect(exercise.id)}
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
                </div>
                <div className="items-center px-4 py-3">
                  <Button
                    className="px-4 py-2 bg-green-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-300"
                    onClick={handleSubmit}
                    disabled={!selectedExerciseId}
                  >
                    Add
                  </Button>
                  <Button variant="ghost" className="mt-2 px-4 py-2 text-gray-500 text-base font-medium rounded-md w-full shadow-sm hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300" onClick={handleCloseAddDialog}>
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

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
