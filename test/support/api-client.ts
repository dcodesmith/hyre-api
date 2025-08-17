import axios, { AxiosError, AxiosInstance, AxiosResponse } from "axios";

export class ApiClient {
  private client: AxiosInstance;
  private baseUrl: string;
  private static instance: ApiClient | null = null;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.API_BASE_URL || "http://localhost:3001";
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
      },
      // Don't throw on HTTP error status codes
      // validateStatus: () => true,
    });
  }

  static getInstance(baseUrl?: string): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient(baseUrl);
    }

    return ApiClient.instance;
  }

  static clearInstance(): void {
    ApiClient.instance = null;
  }

  async post(
    endpoint: string,
    data?: any,
    headers: Record<string, string> = {},
  ): Promise<AxiosResponse> {
    try {
      return await this.client.post(endpoint, data, { headers });
    } catch (error) {
      if (error instanceof AxiosError && error.response) {
        return error.response;
      }
      throw error;
    }
  }

  async postMultipart(
    endpoint: string,
    formData: FormData,
    headers: Record<string, string> = {},
  ): Promise<AxiosResponse> {
    try {
      const multipartHeaders = {
        ...headers,
        "Content-Type": "multipart/form-data",
      };
      return await this.client.post(endpoint, formData, { headers: multipartHeaders });
    } catch (error) {
      if (error instanceof AxiosError && error.response) {
        return error.response;
      }
      throw error;
    }
  }

  async get(endpoint: string, headers: Record<string, string> = {}): Promise<AxiosResponse> {
    try {
      return await this.client.get(endpoint, { headers });
    } catch (error) {
      if (error instanceof AxiosError && error.response) {
        return error.response;
      }
      throw error;
    }
  }

  async put(
    endpoint: string,
    data?: any,
    headers: Record<string, string> = {},
  ): Promise<AxiosResponse> {
    try {
      return await this.client.put(endpoint, data, { headers });
    } catch (error) {
      if (error instanceof AxiosError && error.response) {
        return error.response;
      }
      throw error;
    }
  }

  async delete(endpoint: string, headers: Record<string, string> = {}): Promise<AxiosResponse> {
    try {
      return await this.client.delete(endpoint, { headers });
    } catch (error) {
      if (error instanceof AxiosError && error.response) {
        return error.response;
      }
      throw error;
    }
  }

  setAuthToken(token: string): void {
    const cleanToken = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
    this.client.defaults.headers.common.Authorization = cleanToken;
  }

  clearAuthToken(): void {
    delete this.client.defaults.headers.common.Authorization;
  }

  setHeader(key: string, value: string): void {
    this.client.defaults.headers.common[key] = value;
  }

  removeHeader(key: string): void {
    delete this.client.defaults.headers.common[key];
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }
}
