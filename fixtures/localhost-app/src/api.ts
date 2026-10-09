export const BACKEND_URL = 'http://localhost:3000/api/v1';

export async function getStatus() {
  const response = await fetch(`${BACKEND_URL}/health`);
  return response.json();
}
