import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import ConfirmationDialog from "@/components/ui/ConfirmationDialog";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Plus, Edit, Trash2, Share2, Lock, Settings } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { usePreferences } from "@/contexts/PreferencesContext";
import { useAuth } from "@/hooks/useAuth";
import { debug, info, warn, error } from '@/utils/logging';
import {
  loadExercises,
  createExercise,
  updateExercise,
  deleteExercise,
  updateExerciseShareStatus,
  getExerciseDeletionImpact,
  Exercise,
  ExerciseDeletionImpact,
} from '@/services/exerciseService';


const ExerciseDatabaseManager = () => {
  const { user } = useAuth();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [totalExercisesCount, setTotalExercisesCount] = useState(0); // New state for total count
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [ownershipFilter, setOwnershipFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState("");
  const [newExerciseCategory, setNewExerciseCategory] = useState("general");
  const [newExerciseCalories, setNewExerciseCalories] = useState(300);
  const [newExerciseDescription, setNewExerciseDescription] = useState("");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [editExerciseName, setEditExerciseName] = useState("");
  const [editExerciseCategory, setEditExerciseCategory] = useState("general");
  const [editExerciseCalories, setEditExerciseCalories] = useState(300);
  const [editExerciseDescription, setEditExerciseDescription] = useState("");
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [deletionImpact, setDeletionImpact] = useState<ExerciseDeletionImpact | null>(null);
  const [exerciseToDelete, setExerciseToDelete] = useState<Exercise | null>(null);

  useEffect(() => {
    if (user?.id) {
      loadExercisesData();
    }
  }, [user?.id]);

  const loadExercisesData = async () => {
    if (!user?.id) return;
    try {
      const response = await loadExercises(
        user.id,
        searchTerm,
        categoryFilter,
        ownershipFilter,
        currentPage,
        itemsPerPage
      );
      setExercises(response.exercises);
      setTotalExercisesCount(response.totalCount); // Set total count for pagination
    } catch (error) {
      console.error("Error loading exercises:", error);
      toast({
        title: "Error",
        description: "Failed to load exercises",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    loadExercisesData();
  }, [user?.id, searchTerm, categoryFilter, ownershipFilter, currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter, ownershipFilter, itemsPerPage]);


  // Remove applyFilters as filtering is now handled by the backend
  // const applyFilters = () => { ... };

  const totalPages = Math.ceil(totalExercisesCount / itemsPerPage); // Use totalExercisesCount
  const currentExercises = exercises; // exercises state now holds the already filtered and paginated data

  const handleAddExercise = async () => {
    try {
      const newExercise = {
        name: newExerciseName,
        category: newExerciseCategory,
        calories_per_hour: newExerciseCalories,
        description: newExerciseDescription,
        user_id: user?.id,
        is_custom: true,
      };
      await createExercise(newExercise);
      toast({
        title: "Success",
        description: "Exercise added successfully",
      });
      loadExercisesData(); // Changed to loadExercisesData
      setIsAddDialogOpen(false);
      setNewExerciseName("");
      setNewExerciseCategory("general");
      setNewExerciseCalories(300);
      setNewExerciseDescription("");
    } catch (error) {
      console.error("Error adding exercise:", error);
      toast({
        title: "Error",
        description: "Failed to add exercise",
        variant: "destructive",
      });
    }
  };

  const handleEditExercise = async () => {
    if (!selectedExercise) return;

    try {
      const updatedExercise = {
        name: editExerciseName,
        category: editExerciseCategory,
        calories_per_hour: editExerciseCalories,
        description: editExerciseDescription,
      };
      await updateExercise(selectedExercise.id, updatedExercise);
      toast({
        title: "Success",
        description: "Exercise edited successfully",
      });
      loadExercisesData();
      setIsEditDialogOpen(false);
      setSelectedExercise(null);
    } catch (error) {
      console.error("Error editing exercise:", error);
      toast({
        title: "Error",
        description: "Failed to edit exercise",
        variant: "destructive",
      });
    }
  };

  const handleDeleteRequest = async (exercise: Exercise) => {
    if (!user) return;
    try {
      const impact = await getExerciseDeletionImpact(exercise.id);
      setDeletionImpact(impact);
      setExerciseToDelete(exercise);
      setShowDeleteConfirmation(true);
    } catch (error) {
      console.error("Error fetching deletion impact:", error);
      toast({
        title: "Error",
        description: "Could not fetch deletion impact. Please try again.",
        variant: "destructive",
      });
    }
  };

  const confirmDelete = async () => {
    if (!exerciseToDelete || !user) return;
    try {
      await deleteExercise(exerciseToDelete.id, user.id);
      toast({
        title: "Success",
        description: "Exercise deleted successfully.",
      });
      loadExercisesData();
    } catch (error) {
      console.error("Error deleting exercise:", error);
      toast({
        title: "Error",
        description: "Failed to delete exercise.",
        variant: "destructive",
      });
    } finally {
      setShowDeleteConfirmation(false);
      setExerciseToDelete(null);
      setDeletionImpact(null);
    }
  };

  const handleShareExercise = async (exerciseId: string, share: boolean) => {
    try {
      await updateExerciseShareStatus(exerciseId, share);
      toast({
        title: "Success",
        description: `Exercise ${share ? 'shared' : 'unshared'} successfully`,
      });
      loadExercisesData();
    } catch (error) {
      console.error("Error sharing exercise:", error);
      toast({
        title: "Error",
        description: "Failed to share exercise",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
            {/* This div will contain the search and category filter. On mobile, it will be the first "row". On desktop, it will be part of the single row. */}
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <Input
                type="text"
                placeholder="Search exercises..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 min-w-[150px]"
              />
              <Select onValueChange={setCategoryFilter} defaultValue={categoryFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="strength">Strength</SelectItem>
                  <SelectItem value="cardio">Cardio</SelectItem>
                  <SelectItem value="yoga">Yoga</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* This div will contain the ownership filter and add button. On mobile, it will be the second "row". On desktop, it will be part of the single row. */}
            <div className="flex flex-wrap items-center gap-2">
              <Select onValueChange={setOwnershipFilter} defaultValue={ownershipFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="own">My Own</SelectItem>
                  <SelectItem value="family">Family</SelectItem>
                  <SelectItem value="public">Public</SelectItem>
                </SelectContent>
              </Select>
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-slate-900 hover:bg-slate-800 text-white">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Exercise
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Exercise</DialogTitle>
                    <DialogDescription>
                      Enter the details for a new exercise to add to your database.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="name" className="text-right">
                        Name
                      </Label>
                      <Input
                        id="name"
                        value={newExerciseName}
                        onChange={(e) => setNewExerciseName(e.target.value)}
                        className="col-span-3"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="category" className="text-right">
                        Category
                      </Label>
                      <Select onValueChange={setNewExerciseCategory} defaultValue={newExerciseCategory}>
                        <SelectTrigger className="col-span-3">
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="general">General</SelectItem>
                          <SelectItem value="strength">Strength</SelectItem>
                          <SelectItem value="cardio">Cardio</SelectItem>
                          <SelectItem value="yoga">Yoga</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="calories" className="text-right">
                        Calories/Hour
                      </Label>
                      <Input
                        id="calories"
                        type="number"
                        value={newExerciseCalories.toString()}
                        onChange={(e) => setNewExerciseCalories(Number(e.target.value))}
                        className="col-span-3"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-start gap-4">
                      <Label htmlFor="description" className="text-right mt-1">
                        Description
                      </Label>
                      <Textarea
                        id="description"
                        value={newExerciseDescription}
                        onChange={(e) => setNewExerciseDescription(e.target.value)}
                        className="col-span-3"
                      />
                    </div>
                  </div>
                  <Button onClick={handleAddExercise}>Add Exercise</Button>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">All Exercises ({totalExercisesCount})</h3>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground">Items per page:</span>
              <Select value={itemsPerPage.toString()} onValueChange={(value) => setItemsPerPage(Number(value))}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            {currentExercises.map((exercise) => (
              <div key={exercise.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium">{exercise.name}</h4>
                    {exercise.user_id && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        Your Exercise
                      </span>
                    )}
                    {exercise.user_id && (
                      <div className="flex items-center gap-1">
                        {exercise.shared_with_public ? (
                          <Share2 className="w-4 h-4 text-blue-500" />
                        ) : (
                          <Lock className="w-4 h-4 text-gray-500" />
                        )}
                      </div>
                    )}
                  </div>
                  <div className="text-sm text-gray-600 mb-1">{exercise.category}</div>
                  <div className="text-sm text-gray-500">
                    Calories/Hour: {exercise.calories_per_hour}
                  </div>
                  {exercise.description && (
                    <div className="text-sm text-gray-400 mt-1">{exercise.description}</div>
                  )}
                </div>
                <div className="flex items-center space-x-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setSelectedExercise(exercise);
                      setEditExerciseName(exercise.name);
                      setEditExerciseCategory(exercise.category);
                      setEditExerciseCalories(exercise.calories_per_hour);
                      setEditExerciseDescription(exercise.description || "");
                      setIsEditDialogOpen(true);
                    }}
                    className="h-8 w-8"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteRequest(exercise)}
                    className="h-8 w-8 hover:bg-gray-200"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  {exercise.user_id === user?.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleShareExercise(exercise.id, !exercise.shared_with_public)}
                      className="h-8 w-8"
                    >
                      {exercise.shared_with_public ? (
                        <Lock className="w-4 h-4" />
                      ) : (
                        <Share2 className="w-4 h-4" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-6">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                  
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNumber;
                    if (totalPages <= 5) {
                      pageNumber = i + 1;
                    } else if (currentPage <= 3) {
                      pageNumber = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNumber = totalPages - 4 + i;
                    } else {
                      pageNumber = currentPage - 2 + i;
                    }
                    
                    return (
                      <PaginationItem key={pageNumber}>
                        <PaginationLink
                          onClick={() => setCurrentPage(pageNumber)}
                          isActive={pageNumber === currentPage}
                          className="cursor-pointer"
                        >
                          {pageNumber}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}
                  
                  <PaginationItem>
                    <PaginationNext 
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Exercise Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Exercise</DialogTitle>
            <DialogDescription>
              Edit the details of the selected exercise.
            </DialogDescription>
          </DialogHeader>
          {selectedExercise && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-name" className="text-right">
                  Name
                </Label>
                <Input
                  id="edit-name"
                  value={editExerciseName}
                  onChange={(e) => setEditExerciseName(e.target.value)}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-category" className="text-right">
                  Category
                </Label>
                <Select onValueChange={setEditExerciseCategory} defaultValue={editExerciseCategory}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="strength">Strength</SelectItem>
                    <SelectItem value="cardio">Cardio</SelectItem>
                    <SelectItem value="yoga">Yoga</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-calories" className="text-right">
                  Calories/Hour
                </Label>
                <Input
                  id="edit-calories"
                  type="number"
                  value={editExerciseCalories.toString()}
                  onChange={(e) => setEditExerciseCalories(Number(e.target.value))}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="edit-description" className="text-right mt-1">
                  Description
                </Label>
                <Textarea
                  id="edit-description"
                  value={editExerciseDescription}
                  onChange={(e) => setEditExerciseDescription(e.target.value)}
                  className="col-span-3"
                />
              </div>
            </div>
          )}
          <Button onClick={handleEditExercise}>Save Changes</Button>
        </DialogContent>
      </Dialog>

      {deletionImpact && exerciseToDelete && (
        <ConfirmationDialog
          open={showDeleteConfirmation}
          onOpenChange={setShowDeleteConfirmation}
          onConfirm={confirmDelete}
          title={`Delete ${exerciseToDelete.name}?`}
          description={
            <div>
              <p>This will permanently delete the exercise and all associated data:</p>
              <ul className="list-disc pl-5 mt-2">
                <li>{deletionImpact.exerciseEntriesCount} diary entries</li>
              </ul>
            </div>
          }
        />
      )}
    </div>
  );
};

export default ExerciseDatabaseManager;
