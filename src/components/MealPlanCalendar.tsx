import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useActiveUser } from '@/contexts/ActiveUserContext';
import { usePreferences } from '@/contexts/PreferencesContext'; // Import usePreferences
import { debug, info } from '@/utils/logging'; // Import logging functions
import { toast } from '@/hooks/use-toast';
import { MealPlanTemplate } from '@/types/meal';
import { getMealPlanTemplates, createMealPlanTemplate, updateMealPlanTemplate, deleteMealPlanTemplate } from '@/services/mealPlanTemplateService';
import MealPlanTemplateForm from './MealPlanTemplateForm';

const MealPlanCalendar: React.FC = () => {
    const { activeUserId } = useActiveUser();
    const { loggingLevel } = usePreferences(); // Get loggingLevel from preferences
    const [templates, setTemplates] = useState<MealPlanTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<MealPlanTemplate | undefined>(undefined);

    const fetchTemplates = async () => {
        if (!activeUserId) return;
        setIsLoading(true);
        try {
            const fetchedTemplates = await getMealPlanTemplates(activeUserId);
            debug(loggingLevel, 'MealPlanCalendar: Fetched Templates:', fetchedTemplates); // Use debug
            setTemplates(fetchedTemplates);
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to fetch meal plan templates.', variant: 'destructive' });
            setTemplates([]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        info(loggingLevel, 'MealPlanCalendar: Fetching templates for user:', activeUserId); // Use info
        fetchTemplates();
    }, [activeUserId, loggingLevel]); // Add loggingLevel to dependency array

    const handleCreate = () => {
        setSelectedTemplate(undefined);
        setIsFormOpen(true);
    };

    const handleEdit = (template: MealPlanTemplate) => {
        setSelectedTemplate(template);
        setIsFormOpen(true);
    };

    const handleSave = async (templateData: Partial<MealPlanTemplate>) => {
        if (!activeUserId) return;
        try {
            const currentClientDate = new Date().toISOString().split('T')[0]; // Get today's date in YYYY-MM-DD format

            if (templateData.id) {
                const updatedTemplate = await updateMealPlanTemplate(activeUserId, templateData.id, templateData, currentClientDate);
                debug(loggingLevel, 'MealPlanCalendar: Updating template in state:', updatedTemplate); // Use debug
                setTemplates(prev => prev.map(t => t.id === updatedTemplate.id ? updatedTemplate : t));
                toast({ title: 'Success', description: 'Meal plan updated successfully.' });
            } else {
                const newTemplate = await createMealPlanTemplate(activeUserId, templateData, currentClientDate);
                debug(loggingLevel, 'MealPlanCalendar: Adding new template to state:', newTemplate); // Use debug
                setTemplates(prev => [...prev, newTemplate]);
                toast({ title: 'Success', description: 'Meal plan created successfully.' });
            }
            setIsFormOpen(false);
            window.dispatchEvent(new CustomEvent('foodDiaryRefresh'));
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to save template.', variant: 'destructive' });
        }
    };

    const handleDelete = async (templateId: string) => {
        if (!activeUserId || !window.confirm('Are you sure you want to delete this template?')) return;
        try {
            await deleteMealPlanTemplate(activeUserId, templateId);
            toast({ title: 'Success', description: 'Template deleted successfully.' });
            fetchTemplates();
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to delete template.', variant: 'destructive' });
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Meal Plans</h1>
                <Button onClick={handleCreate}>Create New Plan</Button>
            </div>
            {isLoading ? (
                <p>Loading templates...</p>
            ) : (
                <Card>
                    <CardContent className="p-0">
                        <div className="space-y-2">
                            {templates && templates.length > 0 ? (
                                templates.map(template => (
                                    <div key={template.id} className="flex items-center justify-between p-4 border-b last:border-b-0">
                                        <div>
                                            <p className="font-semibold">{template.plan_name}</p>
                                            <p className="text-sm text-muted-foreground">{template.description}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {new Date(template.start_date).toLocaleDateString()} - {template.end_date ? new Date(template.end_date).toLocaleDateString() : 'Indefinite'}
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                Weekly Meals: {template.assignments.length}
                                            </p>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            {template.is_active && <span className="text-xs font-semibold text-green-600 bg-green-100 px-2 py-1 rounded-full">Active</span>}
                                            <Button variant="ghost" size="icon" onClick={() => handleEdit(template)}>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path></svg>
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleDelete(template.id!)} className="text-red-500 hover:text-red-600">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                                            </Button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="p-4 text-center text-muted-foreground">No meal plans found. Create one to get started!</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {isFormOpen && (
                <MealPlanTemplateForm
                    template={selectedTemplate}
                    onSave={handleSave}
                    onClose={() => setIsFormOpen(false)}
                />
            )}
        </div>
    );
};

export default MealPlanCalendar;