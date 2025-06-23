import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { debug, info, warn, error } from '@/utils/logging';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz'; // Import formatInTimeZone and toZonedTime
import { format, parseISO, startOfDay } from 'date-fns'; // Import format, parseISO and startOfDay

interface PreferencesContextType {
  weightUnit: 'kg' | 'lbs';
  measurementUnit: 'cm' | 'inches';
  dateFormat: string;
  autoClearHistory: string; // Add auto_clear_history
  loggingLevel: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'SILENT'; // Add logging level
  timezone: string; // Add timezone
  setWeightUnit: (unit: 'kg' | 'lbs') => void;
  setMeasurementUnit: (unit: 'cm' | 'inches') => void;
  setDateFormat: (format: string) => void;
  setAutoClearHistory: (value: string) => void; // Add setter for auto_clear_history
  setLoggingLevel: (level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'SILENT') => void; // Add setter for logging level
  setTimezone: (timezone: string) => void; // Add setter for timezone
  convertWeight: (value: number, from: 'kg' | 'lbs', to: 'kg' | 'lbs') => number;
  convertMeasurement: (value: number, from: 'cm' | 'inches', to: 'cm' | 'inches') => number;
  formatDate: (date: string | Date) => string;
  formatDateInUserTimezone: (date: string | Date, formatStr?: string) => string; // New function for timezone-aware formatting
  parseDateInUserTimezone: (dateString: string) => Date; // New function to parse date string in user's timezone
  loadPreferences: () => Promise<void>;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

export const usePreferences = () => {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used within a PreferencesProvider');
  }
  return context;
};

export const PreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [weightUnit, setWeightUnitState] = useState<'kg' | 'lbs'>('kg');
  const [measurementUnit, setMeasurementUnitState] = useState<'cm' | 'inches'>('cm');
  const [dateFormat, setDateFormatState] = useState<string>('MM/dd/yyyy');
  const [autoClearHistory, setAutoClearHistoryState] = useState<string>('never'); // Add state for auto_clear_history
  const [loggingLevel, setLoggingLevelState] = useState<'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'SILENT'>('SILENT'); // Add state for logging level
  const [timezone, setTimezoneState] = useState<string>(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'); // Add state for timezone, default to browser's timezone

  // Log initial state
  useEffect(() => {
    info(loggingLevel, "PreferencesProvider: Initializing PreferencesProvider.");
    debug(loggingLevel, "PreferencesProvider: Initial state - weightUnit:", weightUnit, "measurementUnit:", measurementUnit, "dateFormat:", dateFormat, "autoClearHistory:", autoClearHistory, "loggingLevel:", loggingLevel, "timezone:", timezone);
  }, []);

  useEffect(() => {
    if (user) {
      info(loggingLevel, "PreferencesProvider: User logged in, loading preferences from database.");
      loadPreferences();
    } else {
      info(loggingLevel, "PreferencesProvider: User not logged in, loading preferences from localStorage.");
      // Load from localStorage when not logged in
      const savedWeightUnit = localStorage.getItem('weightUnit') as 'kg' | 'lbs';
      const savedMeasurementUnit = localStorage.getItem('measurementUnit') as 'cm' | 'inches';
      const savedDateFormat = localStorage.getItem('dateFormat');
      const savedTimezone = localStorage.getItem('timezone');
      // auto_clear_history and loggingLevel are not stored in localStorage, defaults to 'never' and 'INFO' respectively

      if (savedWeightUnit) {
        setWeightUnitState(savedWeightUnit);
        debug(loggingLevel, "PreferencesProvider: Loaded weightUnit from localStorage:", savedWeightUnit);
      }
      if (savedMeasurementUnit) {
        setMeasurementUnitState(savedMeasurementUnit);
        debug(loggingLevel, "PreferencesProvider: Loaded measurementUnit from localStorage:", savedMeasurementUnit);
      }
      if (savedDateFormat) {
        setDateFormatState(savedDateFormat);
        debug(loggingLevel, "PreferencesProvider: Loaded dateFormat from localStorage:", savedDateFormat);
      }
      if (savedTimezone) {
        setTimezoneState(savedTimezone);
        debug(loggingLevel, "PreferencesProvider: Loaded timezone from localStorage:", savedTimezone);
      }
    }
  }, [user, loggingLevel]); // Add loggingLevel to dependency array

  const loadPreferences = async () => {
    if (!user) {
      warn(loggingLevel, "PreferencesProvider: Attempted to load preferences without a user.");
      return;
    }
    info(loggingLevel, "PreferencesProvider: Loading preferences for user:", user.id);

    try {
      const { data, error: supabaseError } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (supabaseError && supabaseError.code !== 'PGRST116') { // PGRST116 means no rows found
        error(loggingLevel, 'PreferencesContext: Error loading preferences from Supabase:', supabaseError);
        throw supabaseError; // Re-throw other errors
      } else if (data) {
        debug(loggingLevel, 'PreferencesContext: Preferences data loaded:', data);
        setWeightUnitState(data.default_weight_unit as 'kg' | 'lbs');
        setMeasurementUnitState(data.default_measurement_unit as 'cm' | 'inches');
        setDateFormatState(data.date_format.replace(/DD/g, 'dd').replace(/YYYY/g, 'yyyy'));
        setAutoClearHistoryState(data.auto_clear_history || 'never'); // Set auto_clear_history state
        setLoggingLevelState((data.logging_level || 'INFO') as 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'SILENT'); // Set logging level state
        setTimezoneState(data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'); // Set timezone state
        info(loggingLevel, 'PreferencesContext: Preferences states updated from database.');
      } else {
        info(loggingLevel, 'PreferencesContext: No preferences found, creating default preferences.');
        await createDefaultPreferences();
      }
    } catch (err) {
      error(loggingLevel, 'PreferencesContext: Unexpected error in loadPreferences:', err);
    }
  };

  const createDefaultPreferences = async () => {
    if (!user) {
      warn(loggingLevel, "PreferencesProvider: Attempted to create default preferences without a user.");
      return;
    }
    info(loggingLevel, "PreferencesProvider: Creating default preferences for user:", user.id);

    try {

      const defaultPrefs = {
        user_id: user.id,
        date_format: 'MM/dd/yyyy',
        default_weight_unit: 'kg',
        default_measurement_unit: 'cm',
        system_prompt: 'You are Sparky, a helpful AI assistant for health and fitness tracking. Be friendly, encouraging, and provide accurate information about nutrition, exercise, and wellness.',
        auto_clear_history: 'never',
        logging_level: 'ERROR' as 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'SILENT', // Add default logging level with type assertion
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' // Add default timezone
      };


      const { data, error: supabaseError } = await supabase
        .from('user_preferences')
        .upsert(defaultPrefs, {
          onConflict: 'user_id'
        })
        .select()
        .single();

      if (supabaseError) {
        error(loggingLevel, 'PreferencesContext: Error creating default preferences in Supabase:', supabaseError);
        throw supabaseError;
      } else {
        info(loggingLevel, 'PreferencesContext: Default preferences created successfully.');
      }
    } catch (err) {
      error(loggingLevel, 'PreferencesContext: Unexpected error creating default preferences:', err);
      throw err;
    }
  };

  const updatePreferences = async (updates: Partial<{
    default_weight_unit: string;
    default_measurement_unit: string;
    date_format: string;
    system_prompt: string;
    auto_clear_history: string;
    logging_level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'SILENT'; // Add logging level to updates type
    timezone: string; // Add timezone to updates type
  }>) => {
    debug(loggingLevel, "PreferencesProvider: Attempting to update preferences with:", updates);
    if (!user) {
      warn(loggingLevel, "PreferencesProvider: User not logged in, saving preferences to localStorage (if applicable).");
      // Save to localStorage when not logged in
      if (updates.default_weight_unit) {
        localStorage.setItem('weightUnit', updates.default_weight_unit);
        debug(loggingLevel, "PreferencesProvider: Saved weightUnit to localStorage:", updates.default_weight_unit);
      }
      if (updates.default_measurement_unit) {
        localStorage.setItem('measurementUnit', updates.default_measurement_unit);
        debug(loggingLevel, "PreferencesProvider: Saved measurementUnit to localStorage:", updates.default_measurement_unit);
      }
      if (updates.date_format) {
        localStorage.setItem('dateFormat', updates.date_format);
        debug(loggingLevel, "PreferencesProvider: Saved dateFormat to localStorage:", updates.date_format);
      }
      if (updates.timezone) {
        localStorage.setItem('timezone', updates.timezone);
        debug(loggingLevel, "PreferencesProvider: Saved timezone to localStorage:", updates.timezone);
      }
      // logging_level is not stored in localStorage
      return;
    }
    info(loggingLevel, "PreferencesProvider: Updating preferences for user:", user.id);

    try {

      const updateData = {
        user_id: user.id,
        ...updates,
        updated_at: new Date().toISOString()
      };


      const { data, error: supabaseError } = await supabase
        .from('user_preferences')
        .upsert(updateData, {
          onConflict: 'user_id'
        })
        .select()
        .single();

      if (supabaseError) {
        error(loggingLevel, 'PreferencesContext: Error updating preferences in Supabase:', supabaseError);
        error(loggingLevel, 'PreferencesContext: Error details:', {
          code: supabaseError.code,
          message: supabaseError.message,
          details: supabaseError.details,
          hint: supabaseError.hint
        });
        throw supabaseError;
      } else {
        info(loggingLevel, 'PreferencesContext: Preferences updated successfully.');
      }
    } catch (err) {
      error(loggingLevel, 'PreferencesContext: Unexpected error updating preferences:', err);
      throw err;
    }
  };

  const setWeightUnit = async (unit: 'kg' | 'lbs') => {
    info(loggingLevel, "PreferencesProvider: Setting weight unit to:", unit);
    try {
      setWeightUnitState(unit);
      await updatePreferences({ default_weight_unit: unit });
      info(loggingLevel, "PreferencesProvider: Weight unit updated successfully.");
    } catch (err) {
      error(loggingLevel, 'PreferencesContext: Error setting weight unit:', err);
      // Revert state on error
      setWeightUnitState(weightUnit);
      throw err;
    }
  };

  const setMeasurementUnit = async (unit: 'cm' | 'inches') => {
    info(loggingLevel, "PreferencesProvider: Setting measurement unit to:", unit);
    try {
      setMeasurementUnitState(unit);
      await updatePreferences({ default_measurement_unit: unit });
      info(loggingLevel, "PreferencesProvider: Measurement unit updated successfully.");
    } catch (err) {
      error(loggingLevel, 'PreferencesContext: Error setting measurement unit:', err);
      // Revert state on error
      setMeasurementUnitState(measurementUnit);
      throw err;
    }
  };

  const setDateFormat = async (format: string) => {
    info(loggingLevel, "PreferencesProvider: Setting date format to:", format);
    try {
      setDateFormatState(format.replace(/DD/g, 'dd').replace(/YYYY/g, 'yyyy'));
      await updatePreferences({ date_format: format });
      info(loggingLevel, "PreferencesProvider: Date format updated successfully.");
    } catch (err) {
      error(loggingLevel, 'PreferencesContext: Error setting date format:', err);
      // Revert state on error
      setDateFormatState(dateFormat);
      throw err;
    }
  };

  const setAutoClearHistory = async (value: string) => {
    info(loggingLevel, "PreferencesProvider: Setting auto clear history to:", value);
    try {
      setAutoClearHistoryState(value);
      await updatePreferences({ auto_clear_history: value });
      info(loggingLevel, "PreferencesProvider: Auto clear history updated successfully.");
    } catch (err) {
      error(loggingLevel, 'PreferencesContext: Error setting auto clear history:', err);
      // Revert state on error
      setAutoClearHistoryState(autoClearHistory);
      throw err;
    }
  };

  const setLoggingLevel = async (level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'SILENT') => {
    info(loggingLevel, "PreferencesProvider: Setting logging level to:", level);
    try {
      setLoggingLevelState(level);
      await updatePreferences({ logging_level: level });
      info(loggingLevel, "PreferencesProvider: Logging level updated successfully.");
    } catch (err) {
      error(loggingLevel, 'PreferencesContext: Error setting logging level:', err);
      // Revert state on error
      setLoggingLevelState(loggingLevel);
      throw err;
    }
  };

  const convertWeight = (value: number, from: 'kg' | 'lbs', to: 'kg' | 'lbs') => {
    if (from === to) return value;
    if (from === 'kg' && to === 'lbs') return value * 2.20462;
    if (from === 'lbs' && to === 'kg') return value / 2.20462;
    return value;
  };

  const convertMeasurement = (value: number, from: 'cm' | 'inches', to: 'cm' | 'inches') => {
    if (from === to) return value;
    if (from === 'cm' && to === 'inches') return value / 2.54;
    if (from === 'inches' && to === 'cm') return value * 2.54;
    return value;
  };

  const setTimezone = async (newTimezone: string) => {
    info(loggingLevel, "PreferencesProvider: Setting timezone to:", newTimezone);
    try {
      setTimezoneState(newTimezone);
      await updatePreferences({ timezone: newTimezone });
      info(loggingLevel, "PreferencesProvider: Timezone updated successfully.");
    } catch (err) {
      error(loggingLevel, 'PreferencesContext: Error setting timezone:', err);
      // Revert state on error
      setTimezoneState(timezone);
      throw err;
    }
  };

  const formatDate = (date: string | Date) => {
    debug(loggingLevel, "PreferencesProvider: Formatting date using user's timezone preference:", date);
    // Use formatDateInUserTimezone for all formatting to ensure consistency with user's preference
    // Pass the dateFormat from state as the formatStr
    return formatDateInUserTimezone(date, dateFormat);
  };

  const formatDateInUserTimezone = (date: string | Date, formatStr?: string) => {
    debug(loggingLevel, `PreferencesProvider: Formatting date in user timezone (${timezone}):`, date);
    let dateToFormat: Date;

    if (typeof date === 'string') {
      dateToFormat = parseISO(date); // Use parseISO for string dates
    } else {
      dateToFormat = date;
    }

    if (isNaN(dateToFormat.getTime())) {
      error(loggingLevel, `PreferencesProvider: Invalid date value provided for formatting:`, date);
      return ''; // Return empty string or a default value for invalid dates
    }

    const formatString = formatStr || 'yyyy-MM-dd'; // Default to yyyy-MM-dd for consistency with DB date type

    let effectiveTimezone = timezone;
    try {
      // Validate timezone string
      new Intl.DateTimeFormat(undefined, { timeZone: effectiveTimezone });
    } catch (e) {
      warn(loggingLevel, `PreferencesProvider: Invalid timezone string "${effectiveTimezone}" detected. Falling back to UTC.`, e);
      effectiveTimezone = 'UTC';
    }

    try {
      return formatInTimeZone(dateToFormat, effectiveTimezone, formatString);
    } catch (e) {
      error(loggingLevel, `PreferencesProvider: Error formatting date in timezone ${effectiveTimezone}:`, e);
      // Fallback to a standard format using date-fns's format, ignoring timezone issues for display
      warn(loggingLevel, `PreferencesProvider: Falling back to local date format for display due to timezone error.`);
      return format(dateToFormat, formatString); // Use format from date-fns
    }
  };

  const parseDateInUserTimezone = (dateString: string): Date => {
    debug(loggingLevel, `PreferencesProvider: Parsing date string "${dateString}" in user timezone (${timezone}).`);
    // Parse the date string as an ISO date (which is treated as UTC by default by parseISO for YYYY-MM-DD)
    const utcDate = parseISO(dateString);

    // Convert this UTC date to the user's timezone
    const zonedDate = toZonedTime(utcDate, timezone);

    // Get the start of the day in the user's timezone
    return startOfDay(zonedDate);
  };

  return (
    <PreferencesContext.Provider value={{
      weightUnit,
      measurementUnit,
      dateFormat,
      autoClearHistory, // Expose autoClearHistory
      loggingLevel, // Expose loggingLevel
      timezone, // Expose timezone
      setWeightUnit,
      setMeasurementUnit,
      setDateFormat,
      setAutoClearHistory, // Expose setAutoClearHistory
      setLoggingLevel, // Expose setLoggingLevel
      setTimezone, // Expose setTimezone
      convertWeight,
      convertMeasurement,
      formatDate,
      formatDateInUserTimezone, // Expose new function
      parseDateInUserTimezone, // Expose new function
      loadPreferences
    }}>
      {children}
    </PreferencesContext.Provider>
  );
};
