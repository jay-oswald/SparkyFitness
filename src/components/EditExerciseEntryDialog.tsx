
import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast"; // Import toast
import { usePreferences } from "@/contexts/PreferencesContext";
import { debug, info, warn, error } from '@/utils/logging';
import {
  fetchExerciseDetails,
  updateExerciseEntry,
  ExerciseEntry,
} from '@/services/editExerciseEntryService';


interface EditExerciseEntryDialogProps {
  entry: ExerciseEntry;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}

const EditExerciseEntryDialog = ({ entry, open, onOpenChange, onSave }: EditExerciseEntryDialogProps) => {
 const { loggingLevel } = usePreferences();
 debug(loggingLevel, "EditExerciseEntryDialog: Component rendered for entry:", entry.id);

 const [duration, setDuration] = useState(entry.duration_minutes);
 const [notes, setNotes] = useState(entry.notes || "");
 const [loading, setLoading] = useState(false);

 useEffect(() => {
   debug(loggingLevel, "EditExerciseEntryDialog: entry useEffect triggered.", entry);
   setDuration(entry.duration_minutes);
   setNotes(entry.notes || "");
 }, [entry, loggingLevel]);

 const handleSave = async () => {
   info(loggingLevel, "EditExerciseEntryDialog: Attempting to save changes for entry:", entry.id);
   setLoading(true);
   
   try {
     // Fetch the exercise to get calories_per_hour for recalculation
     debug(loggingLevel, "EditExerciseEntryDialog: Fetching exercise details for recalculation:", entry.exercise_id);
     const exerciseData = await fetchExerciseDetails(entry.exercise_id);

     const caloriesPerHour = exerciseData?.calories_per_hour || 300;
     const caloriesBurned = (caloriesPerHour / 60) * duration;
     debug(loggingLevel, "EditExerciseEntryDialog: Recalculated calories burned:", caloriesBurned);

     await updateExerciseEntry(entry.id, {
       duration_minutes: duration,
       calories_burned: caloriesBurned,
       notes: notes,
     });

     info(loggingLevel, "EditExerciseEntryDialog: Exercise entry updated successfully:", entry.id);
     toast({
       title: "Success",
       description: "Exercise entry updated successfully.",
     });
     onSave();
     onOpenChange(false);
   } catch (err) {
     error(loggingLevel, "EditExerciseEntryDialog: Error updating exercise entry:", err);
     toast({
       title: "Error",
       description: "Failed to update exercise entry.",
       variant: "destructive",
     });
   } finally {
     setLoading(false);
     debug(loggingLevel, "EditExerciseEntryDialog: Loading state set to false.");
   }
 };

 return (
   <Dialog open={open} onOpenChange={(open) => {
     debug(loggingLevel, "EditExerciseEntryDialog: Dialog open state changed:", open);
     onOpenChange(open);
   }}>
     <DialogContent>
       <DialogHeader>
         <DialogTitle>Edit Exercise Entry</DialogTitle>
         <DialogDescription>
           Make changes to your exercise entry here. Click save when you're done.
         </DialogDescription>
       </DialogHeader>
       
       <div className="space-y-4">
         <div>
           <Label htmlFor="exercise-name">Exercise</Label>
           <Input
             id="exercise-name"
             value={entry.exercises?.name || "Unknown Exercise"}
             disabled
             className="bg-gray-100"
           />
         </div>
         
         <div>
           <Label htmlFor="duration">Duration (minutes)</Label>
           <Input
             id="duration"
             type="number"
             value={duration}
             onChange={(e) => {
               debug(loggingLevel, "EditExerciseEntryDialog: Duration input changed:", e.target.value);
               setDuration(Number(e.target.value));
             }}
             min="1"
           />
         </div>
         
         <div>
           <Label htmlFor="notes">Notes</Label>
           <Textarea
             id="notes"
             value={notes}
             onChange={(e) => {
               debug(loggingLevel, "EditExerciseEntryDialog: Notes input changed:", e.target.value);
               setNotes(e.target.value);
             }}
             placeholder="Add any notes about this exercise..."
           />
         </div>
       </div>
       
       <div className="flex justify-end space-x-2 mt-6">
         <Button variant="outline" onClick={() => {
           debug(loggingLevel, "EditExerciseEntryDialog: Cancel button clicked.");
           onOpenChange(false);
         }}>
           Cancel
         </Button>
         <Button onClick={handleSave} disabled={loading}>
           {loading ? "Saving..." : "Save Changes"}
         </Button>
       </div>
     </DialogContent>
   </Dialog>
 );
};

export default EditExerciseEntryDialog;
