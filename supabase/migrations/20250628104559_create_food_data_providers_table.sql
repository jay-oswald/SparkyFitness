CREATE TABLE food_data_providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    provider_name TEXT NOT NULL,
    provider_type TEXT NOT NULL CHECK (provider_type IN ('openfoodfacts', 'nutritionix', 'fatsecret')),
    app_id TEXT,
    app_key TEXT,
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE user_preferences
ADD COLUMN default_food_data_provider_id UUID REFERENCES public.food_data_providers(id) ON DELETE SET NULL;

-- Enable Row Level Security
ALTER TABLE food_data_providers ENABLE ROW LEVEL SECURITY;

-- Policies for food_data_providers table
CREATE POLICY "Users can view their own food data providers." ON food_data_providers
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own food data providers." ON food_data_providers
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own food data providers." ON food_data_providers
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own food data providers." ON food_data_providers
FOR DELETE USING (auth.uid() = user_id);

-- Optional: Add a trigger to update updated_at on changes to food_data_providers
CREATE OR REPLACE FUNCTION update_food_data_providers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_food_data_providers_updated_at_trigger
BEFORE UPDATE ON food_data_providers
FOR EACH ROW
EXECUTE FUNCTION update_food_data_providers_updated_at();