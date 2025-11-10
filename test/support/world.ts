import { IWorldOptions, setWorldConstructor, World } from "@cucumber/cucumber";
import { ApiClient } from "./api-client";
import { TestApp } from "./app";
import { Builder } from "./builder";
import { Cache } from "./cache";
import { DatabaseHelper } from "./database-helper";
import { AuthenticationService } from "./services/authentication.service";

export interface ICustomWorld extends World {
  apiClient: ApiClient;
  builder: Builder;
  authenticationService: AuthenticationService;
  databaseHelper: DatabaseHelper;
  testApp: TestApp;
  cache: Cache;
  lastResponse: any;
  lastError: any;
}

export class CustomWorld extends World implements ICustomWorld {
  public apiClient: ApiClient;
  public builder: Builder;
  public authenticationService: AuthenticationService;
  public databaseHelper: DatabaseHelper;
  public testApp: TestApp;
  public cache: Cache;
  public lastResponse: any;
  public lastError: any;

  constructor(options?: IWorldOptions) {
    // If no options, create minimal options for cucumber-tsflow
    super(options || { parameters: {}, log: console.log, attach: () => Promise.resolve() });

    this.testApp = TestApp.getInstance();
    this.cache = new Cache();
    this.apiClient = ApiClient.getInstance(this.testApp.baseUrl); // Uses singleton
    this.builder = new Builder();
    this.authenticationService = new AuthenticationService(this.apiClient);
    this.databaseHelper = new DatabaseHelper(this.builder, this.cache);
  }
}

// Standard Cucumber world constructor
setWorldConstructor(CustomWorld);
