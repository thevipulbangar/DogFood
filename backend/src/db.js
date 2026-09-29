import pg from "pg";

// One shared connection pool for the whole app.
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});
