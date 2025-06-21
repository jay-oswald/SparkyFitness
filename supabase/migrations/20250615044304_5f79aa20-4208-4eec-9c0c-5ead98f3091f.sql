
-- Create table for storing AI service settings
CREATE TABLE public.ai_service_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL, -- 'openai', 'anthropic', 'gemini', 'custom'
  service_name TEXT NOT NULL,
  api_key TEXT NOT NULL,
  custom_url TEXT, -- For custom OpenAI-compatible services
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for storing chat history
CREATE TABLE public.sparky_chat_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL DEFAULT gen_random_uuid(),
  message_type TEXT NOT NULL CHECK (message_type IN ('user', 'assistant')),
  content TEXT NOT NULL,
  image_url TEXT, -- For uploaded images
  metadata JSONB, -- For storing additional data like food suggestions
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_service_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sparky_chat_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for ai_service_settings
CREATE POLICY "Users can view their own AI settings" 
  ON public.ai_service_settings 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own AI settings" 
  ON public.ai_service_settings 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own AI settings" 
  ON public.ai_service_settings 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own AI settings" 
  ON public.ai_service_settings 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- RLS policies for sparky_chat_history
CREATE POLICY "Users can view their own chat history" 
  ON public.sparky_chat_history 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own chat history" 
  ON public.sparky_chat_history 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own chat history" 
  ON public.sparky_chat_history 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_ai_service_settings_user_id ON public.ai_service_settings(user_id);
CREATE INDEX idx_ai_service_settings_active ON public.ai_service_settings(user_id, is_active);
CREATE INDEX idx_sparky_chat_history_user_id ON public.sparky_chat_history(user_id);
CREATE INDEX idx_sparky_chat_history_session ON public.sparky_chat_history(user_id, session_id);
CREATE INDEX idx_sparky_chat_history_created_at ON public.sparky_chat_history(user_id, created_at);
