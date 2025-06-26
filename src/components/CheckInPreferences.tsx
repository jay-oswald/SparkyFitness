
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronLeft, ChevronRight, CalendarIcon } from "lucide-react";
import { usePreferences } from "@/contexts/PreferencesContext";
import { cn } from "@/lib/utils";
import { debug, info, warn, error } from '@/utils/logging'; // Import logging utility
import { format } from 'date-fns'; // Import format from date-fns


interface CheckInPreferencesProps {
  weightUnit: string;
  measurementUnit: string;
  selectedDate: string;
  onWeightUnitChange: (unit: string) => void;
  onMeasurementUnitChange: (unit: string) => void;
  onDateChange: (date: string) => void;
}

const CheckInPreferences = ({
  weightUnit,
  measurementUnit,
  selectedDate,
  onWeightUnitChange,
  onMeasurementUnitChange,
  onDateChange
}: CheckInPreferencesProps) => {
  const { formatDate, parseDateInUserTimezone, loggingLevel } = usePreferences(); // Get logging level and parseDateInUserTimezone
  debug(loggingLevel, "CheckInPreferences component rendered.", { selectedDate, weightUnit, measurementUnit });
  const date = parseDateInUserTimezone(selectedDate); // Use parseDateInUserTimezone

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    debug(loggingLevel, "Handling date change from input:", e.target.value);
    onDateChange(e.target.value);
  };

  const handleDateSelect = (newDate: Date | undefined) => {
    debug(loggingLevel, "Handling date select from calendar:", newDate);
    if (newDate) {
      // Format the date to YYYY-MM-DD using the local timezone
      const dateString = format(newDate, 'yyyy-MM-dd');
      info(loggingLevel, "Date selected:", dateString);
      onDateChange(dateString);
    } else {
      warn(loggingLevel, "Date select called with undefined date.");
    }
  };

  const handlePreviousDay = () => {
    debug(loggingLevel, "Handling previous day button click.");
    const previousDay = new Date(date);
    previousDay.setDate(previousDay.getDate() - 1);
    handleDateSelect(previousDay);
  };

  const handleNextDay = () => {
    debug(loggingLevel, "Handling next day button click.");
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    handleDateSelect(nextDay);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
            {/* Unit Toggles */}
            <div className="flex flex-row items-center gap-4 md:gap-6">
              <div className="flex items-center space-x-2">
                <Label className="text-sm hidden md:block">Weight</Label>
                <span className={`text-xs ${weightUnit === 'kg' ? 'font-bold' : ''}`}>kg</span>
                <Switch
                  checked={weightUnit === 'lbs'}
                  onCheckedChange={(checked) => {
                    const unit = checked ? 'lbs' : 'kg';
                    debug(loggingLevel, "Weight unit switch toggled:", unit);
                    onWeightUnitChange(unit);
                  }}
                />
                <span className={`text-xs ${weightUnit === 'lbs' ? 'font-bold' : ''}`}>lbs</span>
              </div>
              <div className="flex items-center space-x-2">
                <Label className="text-sm hidden md:block">Measurements</Label>
                <span className={`text-xs ${measurementUnit === 'cm' ? 'font-bold' : ''}`}>cm</span>
                <Switch
                  checked={measurementUnit === 'inches'}
                  onCheckedChange={(checked) => {
                    const unit = checked ? 'inches' : 'cm';
                    debug(loggingLevel, "Measurement unit switch toggled:", unit);
                    onMeasurementUnitChange(unit);
                  }}
                />
                <span className={`text-xs ${measurementUnit === 'inches' ? 'font-bold' : ''}`}>inches</span>
              </div>
            </div>

            {/* Date Navigation */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handlePreviousDay}
                className="h-8 w-8"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? formatDate(date) : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={date} // Use the date object parsed in user's timezone
                    onSelect={handleDateSelect}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <Button
                variant="outline"
                size="icon"
                onClick={handleNextDay}
                className="h-8 w-8"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CheckInPreferences;
