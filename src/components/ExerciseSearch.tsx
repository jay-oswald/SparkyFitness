
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { usePreferences } from "@/contexts/PreferencesContext";
import { debug, info, warn, error } from '@/utils/logging';

interface Exercise {
  id: string;
  name: string;
  category: string;
  calories_per_hour: number;
  description?: string;
}

interface ExerciseSearchProps {
  onExerciseSelect: (exerciseId: string) => void;
}

const ExerciseSearch = ({ onExerciseSelect }: ExerciseSearchProps) => {
 const { loggingLevel } = usePreferences();
 debug(loggingLevel, "ExerciseSearch: Component rendered.");
 const [searchTerm, setSearchTerm] = useState("");
 const [exercises, setExercises] = useState<Exercise[]>([]);
 const [loading, setLoading] = useState(false);

 const searchExercises = async (query: string) => {
   debug(loggingLevel, "ExerciseSearch: Searching exercises with query:", query);
   if (!query.trim()) {
     debug(loggingLevel, "ExerciseSearch: Search query is empty, clearing exercises.");
     setExercises([]);
     return;
   }

   setLoading(true);
   try {
     const { data, error: supabaseError } = await supabase
       .from('exercises')
       .select('*')
       .ilike('name', `%${query}%`)
       .limit(10);

     if (supabaseError) {
       error(loggingLevel, "ExerciseSearch: Error searching exercises:", supabaseError);
     } else {
       info(loggingLevel, "ExerciseSearch: Exercises search results:", data);
       setExercises(data || []);
     }
   } catch (err) {
     error(loggingLevel, "ExerciseSearch: Error searching exercises:", err);
   } finally {
     setLoading(false);
     debug(loggingLevel, "ExerciseSearch: Loading state set to false.");
   }
 };

 useEffect(() => {
   debug(loggingLevel, "ExerciseSearch: searchTerm useEffect triggered.");
   const timeoutId = setTimeout(() => {
     searchExercises(searchTerm);
   }, 300);

   return () => {
     debug(loggingLevel, "ExerciseSearch: Cleaning up search timeout.");
     clearTimeout(timeoutId);
   };
 }, [searchTerm, loggingLevel]);

 return (
   <div className="space-y-4">
     <Input
       type="text"
       placeholder="Search for exercises..."
       value={searchTerm}
       onChange={(e) => {
         debug(loggingLevel, "ExerciseSearch: Search term input changed:", e.target.value);
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
             debug(loggingLevel, "ExerciseSearch: Select button clicked for exercise:", exercise.name);
             onExerciseSelect(exercise.id);
           }}>
             Select
           </Button>
         </div>
       ))}
     </div>
     
     {searchTerm && !loading && exercises.length === 0 && (
       <div className="text-center text-gray-500">No exercises found</div>
     )}
   </div>
 );
};

export default ExerciseSearch;
