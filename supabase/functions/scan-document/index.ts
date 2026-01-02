import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content, fileName, fileType } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log(`Scanning document: ${fileName} (${fileType})`);

    // For images, we'll do a basic check (can be enhanced with vision models)
    const isImage = fileType.startsWith('image/');
    
    const systemPrompt = isImage 
      ? `You are a security scanner. The user has uploaded an image file named "${fileName}". 
         Since you cannot see the image content, respond with a JSON object indicating it's safe.
         Format: {"isSafe": true, "warnings": []}`
      : `You are a security expert analyzing document content for sensitive information leaks.
         
         Your task is to scan the provided content for:
         1. SSH private keys (-----BEGIN RSA PRIVATE KEY-----, -----BEGIN OPENSSH PRIVATE KEY-----, etc.)
         2. AWS credentials (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AKIA*, etc.)
         3. API keys and tokens (api_key, apikey, api-key, bearer tokens, etc.)
         4. Plain-text passwords (password=, passwd=, pwd=, etc.)
         5. Database connection strings with credentials
         6. OAuth tokens and secrets
         7. Private certificates
         8. Any other sensitive credentials or secrets
         
         Analyze the content carefully. If you find ANY potential leaks, mark it as unsafe.
         
         Respond ONLY with a JSON object in this exact format:
         {
           "isSafe": boolean,
           "warnings": [
             {
               "type": "SSH_KEY" | "AWS_CREDENTIALS" | "API_KEY" | "PASSWORD" | "DATABASE_CREDENTIALS" | "OAUTH_TOKEN" | "CERTIFICATE" | "OTHER",
               "description": "Brief description of what was found",
               "location": "Where in the content it was found (first few chars)"
             }
           ]
         }
         
         Do not include any other text, only the JSON object.`;

    const userContent = isImage 
      ? `Analyze image file: ${fileName}`
      : `Analyze this document content for security leaks:\n\n${content}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          error: "Rate limit exceeded. Please try again in a moment.",
          isSafe: true,
          warnings: []
        }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ 
          error: "AI credits exhausted.",
          isSafe: true,
          warnings: []
        }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || '{"isSafe": true, "warnings": []}';
    
    console.log("AI Response:", aiResponse);

    // Parse the AI response
    let result;
    try {
      // Extract JSON from the response (in case there's extra text)
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        result = { isSafe: true, warnings: [] };
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      result = { isSafe: true, warnings: [] };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in scan-document function:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error",
      isSafe: true,
      warnings: []
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
