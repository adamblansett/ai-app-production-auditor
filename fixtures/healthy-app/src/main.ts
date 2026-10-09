const apiUrl = import.meta.env.VITE_API_URL;

export function fetchUsers() {
  return fetch(`${apiUrl}/users`);
}
