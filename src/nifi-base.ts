import axios, { AxiosInstance, AxiosResponse } from 'axios';
import dayjs from 'dayjs';

interface NiFiAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface NiFiBaseConfig {
  baseUrl: string;
  username: string;
  password: string;
}

export class NiFiBaseClient {
  private axiosInstance: AxiosInstance;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(private config: NiFiBaseConfig) {
    this.axiosInstance = axios.create({
      baseURL: config.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor to handle authentication
    this.axiosInstance.interceptors.request.use(async (config) => {
      await this.ensureAuthenticated();
      if (this.accessToken) {
        config.headers.Authorization = `Bearer ${this.accessToken}`;
      }
      return config;
    });
  }

  private async ensureAuthenticated(): Promise<void> {
    const now = Date.now();
    
    // Check if token is still valid (with 5 minute buffer)
    if (this.accessToken && now < this.tokenExpiry - 300000) {
      return;
    }

    await this.authenticate();
  }

  private async authenticate(): Promise<boolean> {
    try {
      const response: AxiosResponse<string> = await axios.post(
        `${this.config.baseUrl}/nifi-api/access/token`,
        new URLSearchParams({
          username: this.config.username,
          password: this.config.password,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      this.accessToken = response.data;
      this.tokenExpiry = dayjs().add(1, 'hour').toDate().getTime(); // Assuming token valid for 1 hour
      
      console.log('✅ Successfully authenticated with NiFi');
      return true;
    } catch (error) {
      console.error('❌ Authentication failed:', error);
      throw new Error(`Failed to authenticate with NiFi: ${error}`);
    }
  }

  public async get<T>(url: string): Promise<T> {
    const response = await this.axiosInstance.get<T>(url);
    return response.data;
  }

  public async post<T>(url: string, data?: any): Promise<T> {
    const response = await this.axiosInstance.post<T>(url, data);
    return response.data;
  }

  public async put<T>(url: string, data?: any): Promise<T> {
    const response = await this.axiosInstance.put<T>(url, data);
    return response.data;
  }

  public async delete<T>(url: string): Promise<T> {
    const response = await this.axiosInstance.delete<T>(url);
    return response.data;
  }

  public getBaseUrl(): string {
    return this.config.baseUrl;
  }
}

export const createNiFiClient = (config: NiFiBaseConfig): NiFiBaseClient => {
  return new NiFiBaseClient(config);
};