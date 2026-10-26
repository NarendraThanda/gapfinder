const fs = require('fs')
const path = require('path')
const { Client } = require('pg')

async function runMigration() {
  const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL

  if (!connectionString) {
    console.log('\n❌ No DATABASE_URL found in environment variables.')
    console.log('To run migrations programmatically, provide your Supabase PostgreSQL connection string:')
    console.log('e.g. DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"\n')
    console.log('Alternatively, you can copy the contents of supabase-schema.sql and run it in the Supabase SQL Editor:')
    console.log('👉 https://supabase.com/dashboard/project/ypjbmvyvemelyxfunjij/sql/new\n')
    process.exit(1)
  }

  const sqlPath = path.join(__dirname, '..', 'supabase-schema.sql')
  const sql = fs.readFileSync(sqlPath, 'utf8')

  console.log('Connecting to Supabase PostgreSQL database...')
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  })

  try {
    await client.connect()
    console.log('Connected! Executing schema migrations...')
    await client.query(sql)
    console.log('✅ All tables, functions, RLS policies, and vector extensions created successfully!')
  } catch (err) {
    console.error('Migration error:', err)
  } finally {
    await client.end()
  }
}

runMigration()
