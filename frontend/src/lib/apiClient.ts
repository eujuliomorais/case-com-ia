interface ApiErrorResponse {
  error?: string;
}

export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? (payload as ApiErrorResponse).error
        : undefined;
    throw new Error(message || "Não foi possível concluir a solicitação.");
  }

  if (payload === null) {
    throw new Error("O servidor retornou uma resposta inválida.");
  }

  return payload as T;
}