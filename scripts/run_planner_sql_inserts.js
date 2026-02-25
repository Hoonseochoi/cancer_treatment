/**
 * planner_codes_insert.sql INSERT parsing -> Supabase REST API batch
 */
const fs = require('fs');
const path = require('path');

const supabasePath = path.join(__dirname, '..', 'js', 'supabase.js');
const supabaseContent = fs.readFileSync(supabasePath, 'utf8');
const urlMatch = supabaseContent.match(/SUPABASE_URL\s*=\s*"([^"]+)"/);
const keyMatch = supabaseContent.match(/SUPABASE_KEY\s*=\s*"([^"]+)"/);
if (!urlMatch || !keyMatch) { console.error('Keys not found'); process.exit(1); }
const SUPABASE_URL = urlMatch[1];
const SUPABASE_KEY = keyMatch[2];

const sqlPath = path.join(__dirname, 'planner_codes_insert.sql');
const content = fs.readFileSync(sqlPath, 'utf8');
const lines = content.split('\n').filter(l => l.startsWith('INSERT'));

const valueRegex = /\('([^']*)','([^']*)'\)/g;
const rows = [];
for (const line of lines) {
    const valuesMatch = line.match(/VALUES\s+(.+)\s+ON CONFLICT/);
    if (!valuesMatch) continue;
    let m;
    while ((m = valueRegex.exec(valuesMatch[1])) !== null) {
        rows.push({ code: m[1], name: m[2] });
    }
}

const BATCH = 100;
let inserted = 0;

async function run() {
    console.log('Parsed', rows.length, 'rows from', lines.length, 'INSERTs');
    for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        const res = await fetch(SUPABASE_URL + '/rest/v1/planner_codes?on_conflict=code', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': 'Bearer ' + SUPABASE_KEY,
                'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify(batch)
        });
        if (!res.ok) {
            console.error('Error batch', Math.floor(i/BATCH)+1, res.status, await res.text());
            process.exit(1);
        }
        inserted += batch.length;
        process.stdout.write('\r' + inserted + '/' + rows.length);
    }
    console.log('\nDone. Inserted', inserted);
}
run().catch(console.error);

