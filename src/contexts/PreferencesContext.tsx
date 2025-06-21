import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { debug, info, warn, error } from '@/utils/logging';

interface PreferencesContextType {
  weightUnit: 'kg' | 'lbs';
  measurementUnit: 'cm' | 'inches';
  dateFormat: string;
  autoClearHistory: string; // Add auto_clear_history
  loggingLevel: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'SILENT'; // Add logging level
  setWeightUnit: (unit: 'kg' | 'lbs') => void;
  setMeasurementUnit: (unit: 'cm' | 'inches') => void;
  setDateFormat: (format: string) => void;
  setAutoClearHistory: (value: string) => void; // Add setter for auto_clear_history
  setLoggingLevel: (level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'SILENT') => void; // Add setter for logging level
  convertWeight: (value: number, from: 'kg' | 'lbs', to: 'kg' | 'lbs') => number;
  convertMeasurement: (value: number, from: 'cm' | 'inches', to: 'cm' | 'inches') => number;
  formatDate: (date: string | Date) => string;
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
  const [dateFormat, setDateFormatState] = useState<string>('MM/DD/YYYY');
  const [autoClearHistory, setAutoClearHistoryState] = useState<string>('never'); // Add state for auto_clear_history
  const [loggingLevel, setLoggingLevelState] = useState<'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'SILENT'>('SILENT'); // Add state for logging level

  // Log initial state
  useEffect(() => {
    info(loggingLevel, "PreferencesProvider: Initializing PreferencesProvider.");
    debug(loggingLevel, "PreferencesProvider: Initial state - weightUnit:", weightUnit, "measurementUnit:", measurementUnit, "dateFormat:", dateFormat, "autoClearHistory:", autoClearHistory, "loggingLevel:", loggingLevel);
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

      if (supabaseError) {
        error(loggingLevel, 'PreferencesContext: Error loading preferences from Supabase:', supabaseError);
        // Create default preferences if they don't exist
        info(loggingLevel, 'PreferencesContext: Attempting to create default preferences.');
        await createDefaultPreferences();
      } else if (data) {
        debug(loggingLevel, 'PreferencesContext: Preferences data loaded:', data);
        setWeightUnitState(data.default_weight_unit as 'kg' | 'lbs');
        setMeasurementUnitState(data.default_measurement_unit as 'cm' | 'inches');
        setDateFormatState(data.date_format);
        setAutoClearHistoryState(data.auto_clear_history || 'never'); // Set auto_clear_history state
        setLoggingLevelState(data.logging_level || 'INFO'); // Set logging level state
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
        date_format: 'MM/DD/YYYY',
        default_weight_unit: 'kg',
        default_measurement_unit: 'cm',
        system_prompt: 'You are Sparky, a helpful AI assistant for health and fitness tracking. Be friendly, encouraging, and provide accurate information about nutrition, exercise, and wellness.',
        auto_clear_history: 'never',
        logging_level: 'ERROR' as 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'SILENT' // Add default logging level with type assertion
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
      setDateFormatState(format);
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

  const formatDate = (date: string | Date) => {
    debug(loggingLevel, "PreferencesProvider: Formatting date:", date);
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    const day = dateObj.getDate();
    const month = dateObj.getMonth() + 1;
    const year = dateObj.getFullYear();

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthNamesLong = ['January', 'February', 'March', 'April', 'May', 'June',
                           'July', 'August', 'September', 'October', 'November', 'December'];

    switch (dateFormat) {
      case 'DD/MM/YYYY':
        return `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;
      case 'DD-MMM-YYYY':
        return `${day.toString().padStart(2, '0')}-${monthNames[month - 1]}-${year}`;
      case 'YYYY-MM-DD':
        return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      case 'MMM DD, YYYY':
        return `${monthNames[month - 1]} ${day}, ${year}`;
      case 'MM/DD/YYYY':
      default:
        return `${month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}/${year}`;
    }
  };

  return (
    <PreferencesContext.Provider value={{
      weightUnit,
      measurementUnit,
      dateFormat,
      autoClearHistory, // Expose autoClearHistory
      loggingLevel, // Expose loggingLevel
      setWeightUnit,
      setMeasurementUnit,
      setDateFormat,
      setAutoClearHistory, // Expose setAutoClearHistory
      setLoggingLevel, // Expose setLoggingLevel
      convertWeight,
      convertMeasurement,
      formatDate,
      loadPreferences
    }}>
      {children}
    </PreferencesContext.Provider>
  );
};
