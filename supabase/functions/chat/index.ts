import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Encryption key from Supabase secrets
// Utility functions for encryption and decryption
async function encrypt(text: string, key: string): Promise<{ encryptedText: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // GCM recommended IV size is 12 bytes
  const alg = { name: 'AES-GCM', iv: iv };
  const encodedText = new TextEncoder().encode(text);
  let cryptoKey;
  try {
    cryptoKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(key),
      alg,
      false,
      ['encrypt']
    );
  } catch (e: any) {
    console.error('Error importing encryption key:', e);
    throw new Error(`Failed to import encryption key.`);
  }

  let encryptedBuffer;
  try {
    encryptedBuffer = await crypto.subtle.encrypt(alg, cryptoKey, encodedText);
  } catch (e: any) {
    console.error('Error encrypting data:', e);
    throw new Error(`Failed to encrypt data.`);
  }
  
  const encryptedText = btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer)));
  const ivString = btoa(String.fromCharCode(...iv));

  return { encryptedText, iv: ivString };
}

async function decrypt(encryptedText: string, ivString: string, key: string): Promise<string> {
  const iv = Uint8Array.from(atob(ivString), c => c.charCodeAt(0));
  const alg = { name: 'AES-GCM', iv: iv };
  const decodedEncryptedText = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));
  let cryptoKey;
  try {
    cryptoKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(key),
      alg,
      false,
      ['decrypt']
    );
  } catch (e: any) {
    console.error('Error importing decryption key:', e);
    throw new Error(`Failed to import decryption key.`);
  }

  let decryptedBuffer;
  try {
    decryptedBuffer = await crypto.subtle.decrypt(alg, cryptoKey, decodedEncryptedText);
  } catch (e: any) {
    console.error('Error decrypting data:', e);
    throw new Error(`Failed to decrypt data.`);
  }
  
  return new TextDecoder().decode(decryptedBuffer);
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    });
  }

  try {

    const ENCRYPTION_KEY_RAW = Deno.env.get('AI_API_ENCRYPTION_KEY');
    if (!ENCRYPTION_KEY_RAW) {
      console.error('ERROR: AI_API_ENCRYPTION_KEY is not set in Supabase secrets.');
      throw new Error('AI_API_ENCRYPTION_KEY is not set in Supabase secrets.');
    }
    const ENCRYPTION_KEY = ENCRYPTION_KEY_RAW;
    const encryptionKeyByteLength = new TextEncoder().encode(ENCRYPTION_KEY).length;
    if (encryptionKeyByteLength !== 32) {
      console.error('ERROR: AI_API_ENCRYPTION_KEY must be 32 bytes long for AES-256.');
      throw new Error('AI_API_ENCRYPTION_KEY must be 32 bytes long for AES-256.');
    }

    const { messages, service_config, action, service_data } = await req.json();

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated.');
    }

    // Handle saving/updating AI service settings
    if (action === 'save_ai_service_settings' && service_data) {
      const { id, service_name, service_type, api_key, custom_url, system_prompt, is_active, model_name } = service_data;


      const upsertData: any = {
        user_id: user.id,
        service_name,
        service_type,
        custom_url: custom_url || null,
        system_prompt: system_prompt || '',
        is_active,
        model_name: model_name || null,
      };

      if (api_key) { // Only encrypt and update if API key is provided
        try {
          const { encryptedText, iv } = await encrypt(api_key, ENCRYPTION_KEY);
          upsertData.encrypted_api_key = encryptedText;
          upsertData.api_key_iv = iv;
        } catch (e: any) {
          console.error('Error during encryption:', e);
          throw new Error(`Encryption failed.`);
        }
      } else if (!id) { // If it's a new service (no ID) and no API key, throw error
        console.error('New service creation attempted without API key.');
        throw new Error('API key is required for adding a new AI service.');
      } else {
      }

      let error;
      if (id) {
        // Update existing service
        ({ error } = await supabaseClient
          .from('ai_service_settings')
          .update(upsertData)
          .eq('id', id)
          .eq('user_id', user.id));
      } else {
        // Insert new service
        ({ error } = await supabaseClient
          .from('ai_service_settings')
          .insert(upsertData));
      }

      if (error) {
        console.error('Error saving AI service settings:', error);
        throw new Error(`Failed to save AI service settings.`);
      }

      return new Response(JSON.stringify({ message: 'AI service settings saved successfully.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate messages structure for multimodal input for chat requests
    if (!Array.isArray(messages) || messages.length === 0) {
       console.error('Invalid messages format received');
       throw new Error('Invalid messages format.');
    }

    if (!service_config || !service_config.id) {
      throw new Error('AI service configuration ID is missing.');
    }

    // Fetch AI service settings from the database
    const { data: aiService, error: fetchError } = await supabaseClient
      .from('ai_service_settings')
      .select('encrypted_api_key, api_key_iv, service_type, custom_url, model_name')
      .eq('id', service_config.id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !aiService) {
      console.error('Error fetching AI service settings:', fetchError);
      throw new Error(`Failed to retrieve AI service configuration.`);
    }

    if (!aiService.encrypted_api_key || !aiService.api_key_iv) {
      console.error('Encrypted API key or IV missing for fetched service.');
      throw new Error('Encrypted API key or IV missing for selected AI service.');
    }

    let decryptedApiKey: string;
    try {
      decryptedApiKey = await decrypt(aiService.encrypted_api_key, aiService.api_key_iv, ENCRYPTION_KEY);
    } catch (e: any) {
      console.error('Error during decryption:', e);
      throw new Error(`Decryption failed.`);
    }

    let response;
    const model = aiService.model_name || getDefaultModel(aiService.service_type);
    
    // Extract system prompt and clean it for Google AI
    const systemMessage = messages.find((msg: any) => msg.role === 'system');
    const systemPrompt = systemMessage?.content || '';
    const userMessages = messages.filter((msg: any) => msg.role !== 'system');
    
    // Clean system prompt for Google AI (remove special characters and trim length)
    const cleanSystemPrompt = systemPrompt
      .replace(/[^\w\s\-.,!?:;()\[\]{}'"]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 1000); // Limit length for Google AI
    
    switch (aiService.service_type) {
      case 'openai':
        response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${decryptedApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model,
            messages: messages,
            temperature: 0.7,
          }),
        });
        break;

      case 'openai_compatible':
        response = await fetch(`${aiService.custom_url}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${decryptedApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model,
            messages: messages,
            temperature: 0.7,
          }),
        });
        break;

      case 'anthropic':
        response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': decryptedApiKey,
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: model,
            max_tokens: 1000,
            messages: userMessages,
            system: systemPrompt,
          }),
        });
        break;

      case 'google':
        // Google AI (Gemini) supports multimodal input using the 'parts' structure
        const googleBody: any = {
          contents: messages.map((msg: any) => {
            // Map roles: 'user' to 'user', 'assistant' to 'model', 'system' is handled separately
            const role = msg.role === 'assistant' ? 'model' : 'user';
            
            // Handle content which can be a string (text) or an array of parts (text + image)
            let parts: any[] = [];
            if (typeof msg.content === 'string') {
              parts.push({ text: msg.content });
            } else if (Array.isArray(msg.content)) {
              // Assuming content is an array of parts like [{type: 'text', text: '...'}, {type: 'image_url', image_url: {url: '...'}}]
              parts = msg.content.map((part: { type: string; text?: string; image_url?: { url: string } }) => {
                 if (part.type === 'text') {
                   return { text: part.text };
                 } else if (part.type === 'image_url' && part.image_url?.url) {
                   // Google AI expects image data in a specific format
                   // The URL should be a data URL (Base64)
                   try {
                     const urlParts = part.image_url.url.split(';base64,');
                     if (urlParts.length !== 2) {
                       console.error('Edge Function: Invalid data URL format for image part. Expected "data:[mimeType];base64,[data]".');
                       return null; // Skip invalid image part
                     }
                     const mimeTypeMatch = urlParts[0].match(/^data:(.*?)(;|$)/);
                     let mimeType = '';
                     if (mimeTypeMatch && mimeTypeMatch[1]) {
                       mimeType = mimeTypeMatch[1];
                     } else {
                       console.error('Edge Function: Could not extract mime type from data URL prefix:', urlParts[0]);
                       return null; // Skip if mime type cannot be extracted
                     }
                     const base64Data = urlParts[1];
                     return {
                       inline_data: {
                         mime_type: mimeType,
                         data: base64Data
                       }
                     };
                   } catch (e: any) {
                     console.error('Edge Function: Error processing image data URL:', e);
                     return null; // Skip if error occurs
                   }
                 }
                 return null; // Ignore unsupported part types
              }).filter((part: any) => part !== null); // Filter out any null parts
            }

            // If no valid parts were generated (e.g., due to malformed image data),
            // but the original message content was an array and contained an image,
            // add an empty text part to ensure the message is not filtered out.
            if (parts.length === 0 && Array.isArray(msg.content) && msg.content.some((part: any) => part.type === 'image_url')) {
              parts.push({ text: '' });
            }

            return {
              parts: parts,
              role: role,
            };
          }).filter((content: { parts: Array<any | null> }) => content.parts.length > 0), // Filter out messages with no valid parts
        };
        
        // Add check for empty contents
        if (googleBody.contents.length === 0) {
          console.error('ERROR: Google API request body has empty contents. No valid text or image parts found.');
          return new Response(JSON.stringify({ error: 'No valid content (text or image) found to send to Google AI.' }), {
            status: 400, // Bad Request
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Only add system instruction if it's not empty and clean
        if (cleanSystemPrompt && cleanSystemPrompt.length > 0) {
          googleBody.systemInstruction = {
            parts: [{ text: cleanSystemPrompt }]
          };
        }
        
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${decryptedApiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(googleBody),
        });
        break;

      case 'mistral':
        response = await fetch('https://api.mistral.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${decryptedApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model,
            messages: messages,
            temperature: 0.7,
          }),
        });
        break;

      case 'groq':
        response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${decryptedApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model,
            messages: messages,
            temperature: 0.7,
          }),
        });
        break;

      case 'ollama':
        response = await fetch(`${aiService.custom_url}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model,
            messages: messages,
            stream: false,
          }),
        });
        break;

      case 'custom':
        if (!aiService.custom_url) {
          throw new Error('Custom URL is required for custom service');
        }
        response = await fetch(aiService.custom_url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${decryptedApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: messages,
            model: model,
            temperature: 0.7,
          }),
        });
        break;

      default:
        // For other service types, check if image data is present and inform the user if not supported
        const hasImage = messages.some((msg: any) => Array.isArray(msg.content) && msg.content.some((part: any) => part.type === 'image_url'));
        if (hasImage) {
           return new Response(JSON.stringify({ error: `Image analysis is not supported for the selected AI service type: ${aiService.service_type}. Please select a multimodal model like Google Gemini in settings.` }), {
             status: 400,
             headers: { ...corsHeaders, 'Content-Type': 'application/json' },
           });
        }
        // If no image, proceed with text-only for other services (assuming they support text)
        throw new Error(`Unsupported service type for image analysis: ${aiService.service_type}`);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`AI service API call error for ${aiService.service_type}:`, errorText);
      throw new Error(`AI service API call error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    let content = '';

    switch (aiService.service_type) {
      case 'openai':
      case 'openai_compatible':
      case 'mistral':
      case 'groq':
      case 'custom':
        content = data.choices?.[0]?.message?.content || 'No response from AI service';
        break;
      case 'anthropic':
        content = data.content?.[0]?.text || 'No response from AI service';
        break;
      case 'google':
        content = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from AI service';
        break;
      case 'ollama':
        content = data.message?.content || 'No response from AI service';
        break;
    }

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) { // Explicitly type error as any
    console.error('Caught error in chat function:', error);
    return new Response(JSON.stringify({ error: 'An unexpected error occurred in the Edge Function.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function getDefaultModel(serviceType: string): string {
  switch (serviceType) {
    case 'openai':
    case 'openai_compatible':
      return 'gpt-4o-mini';
    case 'anthropic':
      return 'claude-3-5-sonnet-20241022';
    case 'google':
      return 'gemini-pro';
    case 'mistral':
      return 'mistral-large-latest';
    case 'groq':
      return 'llama3-8b-8192';
    default:
      return 'gpt-3.5-turbo';
  }
}
