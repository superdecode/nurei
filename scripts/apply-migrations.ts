console.error([
  'Do not apply Supabase schema migrations through this script.',
  '',
  'Use the Supabase CLI-managed flow instead:',
  '  npx supabase migration new descriptive_name',
  '  npx supabase db push --linked',
  '  npx supabase migration list --linked',
  '  npx supabase inspect db index-stats --linked',
].join('\n'))

process.exit(1)
