# Legal Rewrite Edge Function

Keeps the OpenAI API key off the GitHub Pages frontend.

Required Supabase secret: `OPENAI_API_KEY`
Optional: `LEGAL_AI_MODEL` (default `gpt-5.6-terra`)

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set OPENAI_API_KEY=YOUR_KEY
supabase functions deploy legal-rewrite
```

Never put `OPENAI_API_KEY` in the browser, localStorage, or GitHub.
