require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStorage() {
  console.log("Checking Supabase 'images' bucket...");
  const { data, error } = await supabase.storage.from('images').list('', {
    limit: 1000,
    offset: 0,
    sortBy: { column: 'created_at', order: 'desc' },
  });

  if (error) {
    console.error("Error fetching storage:", error);
    return;
  }

  const files = data.filter(file => file.name !== '.emptyFolderPlaceholder');
  console.log(`Total files found: ${files.length}`);
  
  let totalSize = 0;
  files.forEach(file => {
      totalSize += (file.metadata?.size || 0);
  });
  
  console.log(`Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
}

checkStorage();
