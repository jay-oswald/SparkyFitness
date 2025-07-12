import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useActiveUser } from '@/contexts/ActiveUserContext';
import { toast } from '@/hooks/use-toast';
import { MealPlanTemplate, Meal } from '@/types/meal';
import { getMeals } from '@/services/mealService';
import MealSelection from './MealSelection';

interface MealPlanTemplateFormProps {
    template?: MealPlanTemplate;
    onSave: (template: Partial<MealPlanTemplate>) => void;
    onClose: () => void;
}

const MealPlanTemplateForm: React.FC<MealPlanTemplateFormProps> = ({ template, onSave, onClose }) => {
    const { activeUserId } = useActiveUser();
    const [planName, setPlanName] = useState(template?.plan_name || '');
    const [description, setDescription] = useState(template?.description || '');
    const [startDate, setStartDate] = useState(template?.start_date ? new Date(template.start_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(template?.end_date ? new Date(template.end_date).toISOString().split('T')[0] : new Date(new Date().setDate(new Date().getDate() + 7)).toISOString().split('T')[0]);
    const [isActive, setIsActive] = useState(template?.is_active || false);
    const [assignments, setAssignments] = useState(template?.assignments || []);
    const [isMealSelectionOpen, setIsMealSelectionOpen] = useState(false);
    const [currentDay, setCurrentDay] = useState<number | null>(null);
    const [currentMealType, setCurrentMealType] = useState<string | null>(null);

    const handleAddMeal = (day: number, mealType: string) => {
        setCurrentDay(day);
        setCurrentMealType(mealType);
        setIsMealSelectionOpen(true);
    };

    const handleMealSelected = (meal: Meal) => {
        if (currentDay === null || currentMealType === null) return;
        setAssignments([...assignments, { day_of_week: currentDay, meal_type: currentMealType, meal_id: meal.id, meal_name: meal.name }]);
        setIsMealSelectionOpen(false);
    };

    const handleRemoveMeal = (index: number) => {
        setAssignments(assignments.filter((_, i) => i !== index));
    };

    const handleSave = () => {
        if (!planName.trim()) {
            toast({ title: 'Error', description: 'Plan Name cannot be empty.', variant: 'destructive' });
            return;
        }
        if (endDate && startDate > endDate) {
            toast({ title: 'Error', description: 'End Date cannot be before Start Date.', variant: 'destructive' });
            return;
        }
        const dataToSave = {
            ...template,
            plan_name: planName,
            description,
            start_date: startDate,
            end_date: endDate,
            is_active: isActive,
            assignments,
        };
        console.log('Saving template data:', dataToSave); // Add this line for debugging
        onSave(dataToSave);
    };

    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const mealTypes = ['breakfast', 'lunch', 'dinner', 'snacks'];

    return (
        <>
            <Dialog open={true} onOpenChange={onClose}>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{template ? 'Edit' : 'Create'} Meal Plan Template</DialogTitle>
                        <DialogDescription>
                            Fill in the details below to {template ? 'update the' : 'create a new'} meal plan template.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="planName">Plan Name</Label>
                            <Input id="planName" value={planName} onChange={e => setPlanName(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea id="description" value={description} onChange={e => setDescription(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="startDate">Start Date</Label>
                                <Input id="startDate" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="endDate">End Date</Label>
                                <Input id="endDate" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                            </div>
                        </div>
                        <div className="flex items-center space-x-2">
                            <input type="checkbox" id="isActive" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
                            <Label htmlFor="isActive">Set as active plan</Label>
                        </div>
                        <div className="space-y-4">
                            {daysOfWeek.map((day, dayIndex) => (
                                <div key={dayIndex}>
                                    <h3 className="text-lg font-semibold">{day}</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        {mealTypes.map(mealType => (
                                            <div key={mealType} className="p-4 border rounded-lg">
                                                <h4 className="font-semibold capitalize">{mealType}</h4>
                                                <div className="space-y-2 mt-2">
                                                    {assignments.filter(a => a.day_of_week === dayIndex && a.meal_type === mealType).map((assignment, index) => (
                                                        <div key={index} className="flex items-center justify-between bg-gray-100 p-2 rounded">
                                                            <span>{assignment.meal_name}</span>
                                                            <Button variant="ghost" size="icon" onClick={() => handleRemoveMeal(assignments.indexOf(assignment))}>X</Button>
                                                        </div>
                                                    ))}
                                                </div>
                                                <Button variant="outline" size="sm" className="mt-2" onClick={() => handleAddMeal(dayIndex, mealType)}>Add Meal</Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={onClose}>Cancel</Button>
                        <Button onClick={handleSave}>Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {isMealSelectionOpen && (
                <Dialog open={isMealSelectionOpen} onOpenChange={setIsMealSelectionOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Select a Meal</DialogTitle>
                            <DialogDescription>
                                Choose a meal from the list below to add to your template.
                            </DialogDescription>
                        </DialogHeader>
                        <MealSelection onMealSelect={handleMealSelected} />
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
};

export default MealPlanTemplateForm;