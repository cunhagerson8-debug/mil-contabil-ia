const { Client } = require("pg");

const client = new Client({
  host: "127.0.0.1",
  port: 5434,
  database: "mil_contabil_teste",
  user: "mil_platform_login",
  password: process.env.PGPASSWORD
});

async function main() {
  try {
    await client.connect();
    const result = await client.query(
      "SELECT session_user, current_database()"
    );
    console.log(result.rows);
  } catch (error) {
    console.log("ERRO:", error.message);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

main();
