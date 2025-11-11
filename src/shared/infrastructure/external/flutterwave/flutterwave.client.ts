import { Injectable } from "@nestjs/common";
import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from "axios";
import { TypedConfigService } from "../../../config/typed-config.service";
import { type Logger, LoggerService } from "../../../logging/logger.service";
import { FlutterwaveConfig, FlutterwaveError, FlutterwaveResponse } from "./flutterwave.types";

@Injectable()
export class FlutterwaveClient {
  private readonly config: FlutterwaveConfig;
  private readonly httpClient: AxiosInstance;
  private readonly logger: Logger;

  constructor(
    private readonly configService: TypedConfigService,
    private readonly loggerService: LoggerService,
  ) {
    this.logger = this.loggerService.createLogger(FlutterwaveClient.name);
    this.config = this.configService.flutterwave;

    this.httpClient = axios.create({
      baseURL: this.config.baseUrl,
      timeout: 30000, // 30 seconds
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.secretKey}`,
      },
    });

    this.setupInterceptors();
  }

  /**
   * Make a POST request to Flutterwave API
   */
  async post<T>(
    endpoint: string,
    data: unknown,
    config?: AxiosRequestConfig,
  ): Promise<FlutterwaveResponse<T>> {
    try {
      this.logger.info(`Making POST request to Flutterwave: ${endpoint}`);

      const response = await this.httpClient.post<FlutterwaveResponse<T>>(endpoint, data, config);

      this.logger.info(`Flutterwave POST response: ${endpoint} - Status: ${response.data.status}`);

      return response.data;
    } catch (error) {
      throw this.handleError(error, `POST ${endpoint}`);
    }
  }

  /**
   * Make a GET request to Flutterwave API
   */
  async get<T>(endpoint: string, config?: AxiosRequestConfig): Promise<FlutterwaveResponse<T>> {
    try {
      this.logger.info(`Making GET request to Flutterwave: ${endpoint}`);

      const response = await this.httpClient.get<FlutterwaveResponse<T>>(endpoint, config);

      this.logger.info(`Flutterwave GET response: ${endpoint} - Status: ${response.data.status}`);

      return response.data;
    } catch (error) {
      throw this.handleError(error, `GET ${endpoint}`);
    }
  }

  /**
   * Get the webhook URL for callbacks
   */
  getWebhookUrl(path: string = ""): string {
    return `${this.config.webhookUrl}${path}`;
  }

  /**
   * Get the public key for frontend integrations
   */
  getPublicKey(): string {
    return this.config.publicKey;
  }

  private setupInterceptors(): void {
    // Request interceptor to log requests (with sensitive data masked)
    this.httpClient.interceptors.request.use(
      (config) => {
        this.logger.info(`Flutterwave request: ${config.method?.toUpperCase()} ${config.url}`);

        return config;
      },
      (error) => {
        this.logger.error(`Flutterwave request error: ${error.message}`);
        return Promise.reject(error);
      },
    );

    // Response interceptor to log responses
    this.httpClient.interceptors.response.use(
      (response) => {
        return response;
      },
      (error) => {
        this.logger.error(`Flutterwave response error: ${error.message}`);
        return Promise.reject(error);
      },
    );
  }

  private handleError(error: unknown, operation: string): FlutterwaveError {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    this.logger.error(`Flutterwave ${operation} failed: ${errorMessage}`);

    if (error instanceof AxiosError && error.response) {
      const { status, data } = error.response;

      return new FlutterwaveError(
        data?.message || `HTTP ${status}: ${error.response.statusText}`,
        data?.data?.code,
        status,
        data,
      );
    }

    if (error instanceof AxiosError && error.request) {
      return new FlutterwaveError(
        "Network error: Unable to reach Flutterwave servers",
        "NETWORK_ERROR",
        undefined,
        error.request,
      );
    }

    return new FlutterwaveError(
      `Unexpected error: ${errorMessage}`,
      "UNEXPECTED_ERROR",
      undefined,
      error,
    );
  }
}
