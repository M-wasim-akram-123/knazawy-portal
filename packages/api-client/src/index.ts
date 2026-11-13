import type { TokenStore } from '@knazawy/auth-client';

export interface HealthResponse {
  status: 'ok';
  service: string;
}

export class ApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly tokens: TokenStore,
  ) {}

  async health(): Promise<HealthResponse> {
    return this.get<HealthResponse>('/v1/health');
  }

  private async get<T>(path: string): Promise<T> {
    const headers = new Headers({ Accept: 'application/json' });
    const token = this.tokens.getAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const response = await fetch(`${this.baseUrl}${path}`, { headers, credentials: 'include' });
    if (!response.ok) {
      throw new Error(`API ${response.status} for ${path}`);
    }
    return (await response.json()) as T;
  }
}
