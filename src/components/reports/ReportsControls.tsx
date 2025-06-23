
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronLeft, ChevronRight, CalendarIcon } from "lucide-react";
import { usePreferences } from "@/contexts/PreferencesContext";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { debug, info, warn, error } from "@/utils/logging";
import { format, parseISO } from 'date-fns'; // Import format and parseISO from date-fns



interface ReportsControlsProps {
  startDate: string;
  endDate: string;
  showWeightInKg: boolean;
  showMeasurementsInCm: boolean;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onWeightUnitToggle: (showInKg: boolean) => void;
  onMeasurementUnitToggle: (showInCm: boolean) => void;
}

const ReportsControls = ({
  startDate,
  endDate,
  showWeightInKg,
  showMeasurementsInCm,
  onStartDateChange,
  onEndDateChange,
  onWeightUnitToggle,
  onMeasurementUnitToggle,
}: ReportsControlsProps) => {
  const { formatDate, parseDateInUserTimezone, formatDateInUserTimezone, weightUnit, measurementUnit, loggingLevel } = usePreferences();
  info(loggingLevel, 'ReportsControls: Rendering component.');

  // Set default units based on user preferences when component mounts
  useEffect(() => {
    debug(loggingLevel, 'ReportsControls: Setting default units based on preferences', {
       weightUnit,
       measurementUnit,
       showWeightInKg,
       showMeasurementsInCm
     });
    onWeightUnitToggle(weightUnit === 'kg');
    onMeasurementUnitToggle(measurementUnit === 'cm');
  }, [weightUnit, measurementUnit, onWeightUnitToggle, onMeasurementUnitToggle, loggingLevel]);

  const handleStartDateSelect = (newDate: Date | undefined) => {
    if (newDate) {
      const dateString = formatDateInUserTimezone(newDate, 'yyyy-MM-dd'); // Format the date to YYYY-MM-DD using user's preferred timezone
      debug(loggingLevel, 'ReportsControls: Start date selected:', dateString);
      onStartDateChange(dateString);
    } else {
      debug(loggingLevel, 'ReportsControls: Start date selection cleared.');
    }
  };

  const handleEndDateSelect = (newDate: Date | undefined) => {
    if (newDate) {
      const dateString = format(newDate, 'yyyy-MM-dd'); // Format the date to YYYY-MM-DD using the local timezone
      debug(loggingLevel, 'ReportsControls: End date selected:', dateString);
      onEndDateChange(dateString);
    } else {
      debug(loggingLevel, 'ReportsControls: End date selection cleared.');
    }
  };

  const handlePreviousStartDate = () => {
    debug(loggingLevel, 'ReportsControls: Handling previous start date.');
    const previousDay = parseDateInUserTimezone(startDate);
    previousDay.setDate(previousDay.getDate() - 1);
    handleStartDateSelect(previousDay);
  };

  const handleNextStartDate = () => {
    debug(loggingLevel, 'ReportsControls: Handling next start date.');
    const nextDay = parseDateInUserTimezone(startDate);
    nextDay.setDate(nextDay.getDate() + 1);
    handleStartDateSelect(nextDay);
  };

  const handlePreviousEndDate = () => {
    debug(loggingLevel, 'ReportsControls: Handling previous end date.');
    const previousDay = parseDateInUserTimezone(endDate);
    previousDay.setDate(previousDay.getDate() - 1);
    handleEndDateSelect(previousDay);
  };

  const handleNextEndDate = () => {
    debug(loggingLevel, 'ReportsControls: Handling next end date.');
    const nextDay = parseDateInUserTimezone(endDate);
    nextDay.setDate(nextDay.getDate() + 1);
    handleEndDateSelect(nextDay);
  };

  const handleWeightUnitChange = (checked: boolean) => {
    const newValue = !checked; // checked is true for lbs, we want showWeightInKg
    debug(loggingLevel, 'ReportsControls: Weight unit toggle changed to:', newValue ? 'kg' : 'lbs');
    onWeightUnitToggle(newValue);
  };

  const handleMeasurementUnitChange = (checked: boolean) => {
    const newValue = !checked; // checked is true for inches, we want showMeasurementsInCm
    debug(loggingLevel, 'ReportsControls: Measurement unit toggle changed to:', newValue ? 'cm' : 'inches');
    onMeasurementUnitToggle(newValue);
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          {/* Unit Toggles on the left */}
          <div className="flex items-center gap-6">
            <div className="flex items-center space-x-2">
              <Label className="text-sm">Weight</Label>
              <span className={`text-xs ${showWeightInKg ? 'font-bold' : ''}`}>kg</span>
              <Switch
                checked={!showWeightInKg}
                onCheckedChange={handleWeightUnitChange}
              />
              <span className={`text-xs ${!showWeightInKg ? 'font-bold' : ''}`}>lbs</span>
            </div>
            <div className="flex items-center space-x-2">
              <Label className="text-sm">Measurements</Label>
              <span className={`text-xs ${showMeasurementsInCm ? 'font-bold' : ''}`}>cm</span>
              <Switch
                checked={!showMeasurementsInCm}
                onCheckedChange={handleMeasurementUnitChange}
              />
              <span className={`text-xs ${!showMeasurementsInCm ? 'font-bold' : ''}`}>inches</span>
            </div>
          </div>

          {/* Date Range Controls on the right */}
          <div className="flex items-center gap-4">
            {/* Start Date Navigation */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="default" // Changed from "icon" to "default"
                onClick={handlePreviousStartDate}
                className="h-8 w-auto px-2" // Adjusted width and padding
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal w-fit px-3" // Added w-fit and adjusted padding
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formatDate(startDate)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={parseDateInUserTimezone(startDate)}
                    onSelect={handleStartDateSelect}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                    // Ensure the calendar displays the date in the local timezone
                    // by setting the timezone to the user's local timezone
                    // This is important for react-day-picker to correctly highlight the selected day
                    // based on the local date, not UTC.
                    // This prop is not directly available in react-day-picker,
                    // but the Date object passed to 'selected' is interpreted based on its internal time.
                    // The key is to ensure the Date object passed to 'selected'
                    // accurately reflects the local date.
                    // Since startDate is already a 'yyyy-MM-dd' string, new Date(startDate)
                    // will create a Date object in the local timezone at midnight.
                  />
                </PopoverContent>
              </Popover>

              <Button
                variant="outline"
                size="default" // Changed from "icon" to "default"
                onClick={handleNextStartDate}
                className="h-8 w-auto px-2" // Adjusted width and padding
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* End Date Navigation */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="default" // Changed from "icon" to "default"
                onClick={handlePreviousEndDate}
                className="h-8 w-auto px-2" // Adjusted width and padding
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal w-fit px-3" // Added w-fit and adjusted padding
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formatDate(endDate)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={parseDateInUserTimezone(endDate)}
                    onSelect={handleEndDateSelect}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                    // Ensure the calendar displays the date in the local timezone
                    // by setting the timezone to the user's local timezone
                    // This is important for react-day-picker to correctly highlight the selected day
                    // based on the local date, not UTC.
                    // This prop is not directly available in react-day-picker,
                    // but the Date object passed to 'selected' is interpreted based on its internal time.
                    // The key is to ensure the Date object passed to 'selected'
                    // accurately reflects the local date.
                    // Since endDate is already a 'yyyy-MM-dd' string, new Date(endDate)
                    // will create a Date object in the local timezone at midnight.
                  />
                </PopoverContent>
              </Popover>

              <Button
                variant="outline"
                size="default" // Changed from "icon" to "default"
                onClick={handleNextEndDate}
                className="h-8 w-auto px-2" // Adjusted width and padding
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ReportsControls;
