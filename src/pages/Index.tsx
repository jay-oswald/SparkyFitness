import SparkyChat from "@/components/SparkyChat";
import { usePreferences } from "@/contexts/PreferencesContext";
import { debug, info, warn, error } from '@/utils/logging';

import { useState, useEffect, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import Auth from "@/components/Auth";
import FoodDiary from "@/components/FoodDiary";
import FoodDatabaseManager from "@/components/FoodDatabaseManager";
import ExerciseDatabaseManager from "@/components/ExerciseDatabaseManager";
import Reports from "@/components/Reports";
import CheckIn from "@/components/CheckIn";
import Settings from "@/components/Settings";
import ThemeToggle from "@/components/ThemeToggle";
import ProfileSwitcher from "@/components/ProfileSwitcher";
import { useAuth } from "@/hooks/useAuth";
import { useActiveUser } from "@/contexts/ActiveUserContext";
import { Home, Activity, BarChart3, Utensils, Settings as SettingsIcon, LogOut, Dumbbell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
const Index = () => {
   const { user } = useAuth();
   const { isActingOnBehalf, hasPermission, hasWritePermission, activeUserName } = useActiveUser();
   const { loggingLevel } = usePreferences();
   debug(loggingLevel, "Index: Component rendered.");
 
   const { formatDateInUserTimezone } = usePreferences();
   const [selectedDate, setSelectedDate] = useState(formatDateInUserTimezone(new Date(), 'yyyy-MM-dd'));
   const [activeTab, setActiveTab] = useState<string>("");
 
   const handleSignOut = async () => {
     info(loggingLevel, "Index: Attempting to sign out.");
     try {
       const { error: supabaseError } = await supabase.auth.signOut();
       if (supabaseError) {
         error(loggingLevel, "Index: Failed to sign out:", supabaseError);
         toast({
           title: "Error",
           description: "Failed to sign out",
           variant: "destructive",
         });
       } else {
         info(loggingLevel, "Index: Signed out successfully.");
         toast({
           title: "Success",
           description: "Signed out successfully",
         });
       }
     } catch (error) {
       error(loggingLevel, 'Index: Sign out error:', error);
     }
   };
 
   // Get display name for welcome message
   const getDisplayName = () => {
     debug(loggingLevel, "Index: Getting display name.");
     if (!user) return '';
     
     // Check if we have a profile name from user metadata
     const firstName = user.user_metadata?.first_name;
     const lastName = user.user_metadata?.last_name;
     const fullName = user.user_metadata?.full_name;
     
     if (fullName && fullName.trim()) {
       debug(loggingLevel, "Index: Using full name for display.");
       return fullName.trim();
     }
     if (firstName && firstName.trim()) {
       debug(loggingLevel, "Index: Using first name (and last if available) for display.");
       return lastName && lastName.trim() ? `${firstName.trim()} ${lastName.trim()}` : firstName.trim();
     }
     
     // Fall back to email
     debug(loggingLevel, "Index: Using email for display.");
     return user.email || '';
   };
 
   // Memoize available tabs to prevent hook order violations
   const availableTabs = useMemo(() => {
     debug(loggingLevel, "Index: Calculating available tabs.", { isActingOnBehalf, hasPermission, hasWritePermission });
     if (!isActingOnBehalf) {
       // User viewing their own profile - show all tabs excluding measurements
       debug(loggingLevel, "Index: User viewing own profile, showing all tabs.");
       return [
         { value: "home", label: "Diary", icon: Home, component: FoodDiary },
         { value: "checkin", label: "Check-In", icon: Activity, component: CheckIn },
         { value: "reports", label: "Reports", icon: BarChart3, component: Reports },
         { value: "foods", label: "Foods", icon: Utensils, component: FoodDatabaseManager },
         { value: "exercises", label: "Exercises", icon: Dumbbell, component: ExerciseDatabaseManager },
         { value: "settings", label: "Settings", icon: SettingsIcon, component: Settings },
       ];
     }
 
     // User acting on behalf of someone else - filter by permissions
     debug(loggingLevel, "Index: User acting on behalf, filtering tabs by permissions.");
     const tabs = [];
     
     // Only show tabs if user has write permission (direct permission)
     if (hasWritePermission('calorie')) {
       debug(loggingLevel, "Index: User has calorie write permission, adding Diary tab.");
       tabs.push({ value: "home", label: "Diary", icon: Home, component: FoodDiary });
     }
     
     if (hasWritePermission('checkin')) {
       debug(loggingLevel, "Index: User has checkin write permission, adding Check-In tab.");
       tabs.push({ value: "checkin", label: "Check-In", icon: Activity, component: CheckIn });
     }
     
     // Reports tab shows if user has reports permission (read or write)
     if (hasPermission('reports')) {
       debug(loggingLevel, "Index: User has reports permission, adding Reports tab.");
       tabs.push({ value: "reports", label: "Reports", icon: BarChart3, component: Reports });
     }
 
     info(loggingLevel, "Index: Available tabs calculated:", tabs.map(tab => tab.value));
     return tabs;
   }, [isActingOnBehalf, hasPermission, hasWritePermission, loggingLevel]);
 
   // Set the active tab to the first available tab when tabs change
   useEffect(() => {
     debug(loggingLevel, "Index: availableTabs or activeTab useEffect triggered.", { availableTabs, activeTab });
     if (availableTabs.length > 0 && (!activeTab || !availableTabs.find(tab => tab.value === activeTab))) {
       info(loggingLevel, "Index: Setting active tab to first available tab:", availableTabs[0].value);
       setActiveTab(availableTabs[0].value);
     } else if (availableTabs.length === 0 && activeTab) {
       warn(loggingLevel, "Index: No available tabs, clearing active tab.");
       setActiveTab("");
     }
   }, [availableTabs, activeTab, loggingLevel]);
 
   // Get the appropriate grid class based on the number of tabs
   const getGridClass = (count: number) => {
     debug(loggingLevel, "Index: Getting grid class for tab count:", count);
     switch (count) {
       case 1: return "grid-cols-1";
       case 2: return "grid-cols-2";
       case 3: return "grid-cols-3";
       case 4: return "grid-cols-4";
       case 5: return "grid-cols-5";
       case 6: return "grid-cols-6";
       case 7: return "grid-cols-7";
       default: return "grid-cols-7";
     }
   };
 
   const gridClass = getGridClass(availableTabs.length);
   debug(loggingLevel, "Index: Calculated grid class:", gridClass);
 
   if (!user) {
     info(loggingLevel, "Index: User not logged in, rendering Auth component.");
     return (
       <div className="min-h-screen bg-background">
         <Auth />
       </div>
     );
   }
 
   info(loggingLevel, "Index: User logged in, rendering main application layout.");
   return (
     <div className="min-h-screen bg-background">
       <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
         {/* Header with logo, title, profile switcher, welcome message, theme toggle, and sign out button */}
         <div className="flex justify-between items-center mb-6">
           <div className="flex items-center gap-3">
             <img
               src="/images/SparkyFitness.png"
               alt="SparkyFitness Logo"
               className="h-12 w-auto"
             />
             <h1 className="text-xl sm:text-2xl font-bold text-foreground">SparkyFitness</h1>
           </div>
           <div className="flex items-center gap-2">
             {/* Compact Profile Switcher */}
             <ProfileSwitcher />
             
             {/* Welcome Message */}
             <span className="text-sm text-muted-foreground hidden sm:inline">
               Welcome {isActingOnBehalf ? activeUserName : getDisplayName()}
             </span>
             
             <ThemeToggle />
             <Button
               variant="outline"
               size="sm"
               onClick={handleSignOut}
               className="flex items-center gap-2"
             >
               <LogOut className="h-4 w-4" />
               <span className="hidden sm:inline">Sign Out</span>
             </Button>
           </div>
         </div>
         
         <Tabs value={activeTab} onValueChange={(value) => {
           debug(loggingLevel, "Index: Tab changed to:", value);
           setActiveTab(value);
         }} className="space-y-6">
           {/* Desktop/Tablet Navigation */}
           <TabsList className={`hidden sm:grid w-full gap-1 ${gridClass}`}>
             {availableTabs.map(({ value, label, icon: Icon }) => (
               <TabsTrigger key={value} value={value} className="flex items-center gap-2">
                 <Icon className="h-4 w-4" />
                 <span>{label}</span>
               </TabsTrigger>
             ))}
           </TabsList>
 
           {/* Mobile Navigation - Increased icon sizes */}
           <TabsList className={`grid w-full gap-1 fixed bottom-0 left-0 right-0 sm:hidden bg-background border-t p-2 z-50 ${gridClass}`}>
             {availableTabs.map(({ value, label, icon: Icon }) => (
               <TabsTrigger key={value} value={value} className="flex flex-col items-center gap-1 text-xs py-3">
                 <Icon className="h-6 w-6" />
                 <span className="text-xs">{label}</span>
               </TabsTrigger>
             ))}
           </TabsList>
 
           <div className="pb-20 sm:pb-0">
             {availableTabs.map(({ value, component: Component }) => (
               <TabsContent key={value} value={value} className="space-y-6">
                 {value === "home" ? (
                   <Component
                     selectedDate={selectedDate}
                     onDateChange={setSelectedDate}
                   />
                 ) : (
                   <Component />
                 )}
               </TabsContent>
             ))}
           </div>
         </Tabs>
         
         {/* Sparky AI Chat Popup */}
         <SparkyChat />
       </div>
     </div>
   );
 };
 
 export default Index;
