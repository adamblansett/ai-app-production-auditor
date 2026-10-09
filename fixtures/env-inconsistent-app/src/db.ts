export function getDbConfig() {
  const dbUrl = process.env.DATABASE_URL;
  const secretKey = process.env.AUTH_SECRET;
  return { dbUrl, secretKey };
}
