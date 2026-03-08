export const storageKeys = { TOKEN_KEY: "accessToken", REFRESH_KEY: "refreshToken" };

export async function getItem(key: string): Promise<string | null> {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
}

export async function removeItem(key: string): Promise<void> {
  if (typeof localStorage !== "undefined") localStorage.removeItem(key);
}
