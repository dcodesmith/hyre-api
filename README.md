# Hyre API - Chauffeur-driven Car Rental Service Platform

A complete Domain-Driven Design (DDD), event-driven implementation of a chauffeur-driven car rental service marketplace using NestJS.

## Architecture Overview

This project follows Domain-Driven Design principles with clear bounded contexts and separation of concerns:

### Core Domains

1. **IAM Domain** - Identity & Access Management
   - User registration and email-based OTP authentication
   - Role-based authorization (admin, staff, fleetOwner, chauffeur, user)
   - User approval workflows and profile management
   - JWT token management with refresh capabilities

2. **Fleet Domain** - Vehicle Fleet Management
   - Fleet creation and car management (CRUD operations)
   - Car approval workflow (pending → approved/rejected)
   - Car status management (available, booked, hold, in_service)
   - Fleet owner to chauffeur assignments

3. **Booking Domain** (Core Domain)
   - Complete booking lifecycle (pending → confirmed → active → completed → cancelled)
   - Chauffeur assignment to bookings with cross-domain validation
   - Payment integration with Flutterwave for booking payments
   - Cost calculation and financial breakdowns
   - Booking cancellation with refund handling

4. **Payment Domain**
   - Payout processing to fleet owners via Flutterwave
   - Webhook handling for payment status updates
   - Payout status tracking and automated retries

5. **Communication Domain**
   - Multi-channel notifications (email via Resend, SMS via Twilio)
   - Event-driven notification system for booking updates
   - Template-based messaging with notification factories

6. **Scheduling Domain** (Infrastructure)
   - Bull queues for background job processing
   - Automated cron jobs for reminders and status updates
   - Manual job triggers for testing and monitoring

### Key DDD Concepts Implemented

- **Entities & Aggregates**: Rich domain models with encapsulated business logic
- **Value Objects**: Type-safe, immutable values (Money, PhoneNumber, BookingStatus, etc.)
- **Domain Services**: Complex business rules and cross-entity operations
- **Domain Events**: Event-driven communication between bounded contexts
- **Repository Pattern**: Clean separation of domain and infrastructure concerns
- **Application Services**: Orchestration layer without business logic
- **CQRS**: Command and Query Responsibility Segregation with event handlers

## Project Structure

Each domain follows the same DDD structure pattern:

```
src/
├── main.ts                           # Application bootstrap
├── app.module.ts                     # Root module configuration
├── shared/                           # Shared infrastructure
│   ├── database/                     # Prisma database service
│   ├── events/                       # Domain event publisher
│   ├── domain/                       # Base domain classes (Entity, ValueObject, AggregateRoot)
│   ├── config/                       # Environment validation and typed config
│   ├── redis/                        # Redis cache service
│   └── infrastructure/external/      # AWS S3, Flutterwave clients
├── iam/                              # IAM Domain
│   ├── domain/
│   │   ├── entities/                 # User, BankDetails
│   │   ├── value-objects/            # UserRole, PhoneNumber, ApprovalStatus
│   │   ├── events/                   # UserRegistered, OtpVerified, UserAuthenticated, UserApproved, UserRoleAssigned, ChauffeurAdded, FleetOwnerApproved
│   │   ├── services/                 # JwtToken, OtpAuthentication, BankVerification
│   │   └── repositories/             # User, BankDetails repository interfaces
│   ├── application/
│   │   ├── services/                 # Authentication, Authorization, UserManagement
│   │   └── event-handlers/           # UserRegistered, ChauffeurAdded handlers
│   ├── infrastructure/
│   │   ├── guards/                   # JWT auth, roles-based authorization
│   │   ├── decorators/               # @Roles, @CurrentUser
│   │   └── repositories/             # Prisma implementations
│   └── presentation/
│       ├── iam.controller.ts         # Auth, user management endpoints
│       └── dto/                      # Request/response DTOs
├── fleet/                            # Fleet Domain
│   ├── domain/
│   │   ├── entities/                 # Fleet, Car
│   │   ├── value-objects/            # CarStatus, CarApprovalStatus
│   │   ├── events/                   # FleetCreated, CarApprovalStatusChanged
│   │   ├── services/                 # FleetManagement, CarApproval
│   │   └── repositories/             # Fleet, Car repository interfaces
│   ├── application/
│   │   └── services/                 # FleetApplication, CarUploadApplication
│   ├── infrastructure/
│   │   └── repositories/             # Prisma implementations with caching
│   └── presentation/
│       ├── fleet.controller.ts       # Fleet and car management endpoints
│       └── dto/                      # Car upload, fleet creation DTOs
├── booking/                          # Booking Domain (Core)
│   ├── domain/
│   │   ├── entities/                 # Booking, BookingLeg
│   │   ├── value-objects/            # BookingStatus, DateRange, BookingFinancials
│   │   ├── events/                   # BookingCreated, BookingConfirmed, BookingActivated, BookingCompleted, BookingCancelled, ChauffeurAssigned, ChauffeurUnassigned
│   │   ├── services/                 # BookingEligibility, CostCalculator, TimeProcessor
│   │   └── repositories/             # Booking, Car, PlatformFee repository interfaces
│   ├── application/
│   │   ├── services/                 # BookingApplication, ChauffeurAssignment, BookingPayment
│   │   └── event-handlers/           # BookingCreated, PaymentConfirmed handlers
│   ├── infrastructure/
│   │   ├── adapters/                 # Cross-domain validation adapters
│   │   └── repositories/             # Prisma implementations with caching
│   └── presentation/
│       ├── booking.controller.ts     # Booking lifecycle and chauffeur assignment
│       └── dto/                      # Booking creation, chauffeur assignment DTOs
├── payment/                          # Payment Domain
│   ├── domain/
│   │   ├── entities/                 # Payout
│   │   ├── value-objects/            # PayoutStatus, BankAccount
│   │   ├── events/                   # PaymentConfirmed, PaymentVerificationCompleted, PayoutInitiated, PayoutProcessing, PayoutCompleted, PayoutFailed
│   │   ├── services/                 # PayoutPolicy, PaymentGateway interface
│   │   └── repositories/             # Payout repository interface
│   ├── application/
│   │   ├── services/                 # PayoutService, WebhookService
│   │   └── event-handlers/           # PaymentVerificationRequested handler
│   ├── infrastructure/
│   │   ├── gateways/                 # FlutterwavePaymentGateway
│   │   └── repositories/             # Prisma implementation
│   └── presentation/
│       └── webhook.controller.ts     # Flutterwave webhook handling
├── communication/                    # Communication Domain
│   ├── domain/
│   │   ├── entities/                 # Notification
│   │   ├── value-objects/            # NotificationType, Recipient, NotificationContent
│   │   ├── services/                 # NotificationFactory, EmailService, SmsService
│   │   └── repositories/             # Notification repository interface
│   ├── application/
│   │   ├── services/                 # NotificationService
│   │   └── event-handlers/           # OtpGenerated handler
│   └── infrastructure/
│       ├── services/                 # ResendEmail, TwilioSms
│       └── repositories/             # Prisma implementation
├── scheduling/                       # Scheduling Domain
│   ├── application/
│   │   └── services/                 # SchedulerService (cron job management)
│   ├── infrastructure/
│   │   ├── processors/               # Bull queue processors (reminders, status updates)
│   │   └── services/                 # ReminderProcessing
│   └── domain/
│       └── value-objects/            # JobType
└── health/                           # Health Monitoring
    ├── health.controller.ts          # Health checks and manual job triggers
    └── indicators/                   # Prisma, Redis health indicators
```

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Redis server
- pnpm (package manager)

### Installation

1. Install dependencies:
```bash
pnpm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration (see Environment Variables section)
```

3. Set up the database:
```bash
# Generate Prisma client
pnpm db:generate

# Push schema to database (for development)
pnpm db:push

# Or create and run migrations (for production)
pnpm db:migrate
```

4. Start the application:
```bash
# Development with hot reload
pnpm start:dev

# Production build and start
pnpm build
pnpm start:prod

# For deployment
pnpm deploy
```

### Environment Variables

Create a `.env` file with the following variables (see `src/shared/config/env.validation.ts` for complete schema):

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/hyre_worker"

# Redis
REDIS_URL="redis://localhost:6379"
REDIS_HOST="localhost"
REDIS_PORT=6379
REDIS_PASSWORD=""

# Application
NODE_ENV="development"
PORT=3000
APP_NAME="Hyre Worker"

# JWT Authentication
JWT_SECRET="your-jwt-secret"
JWT_EXPIRATION="24h"
REFRESH_TOKEN_SECRET="your-refresh-token-secret" 
REFRESH_TOKEN_EXPIRATION="7d"

# Email Service (Resend)
RESEND_API_KEY="re_..."

# SMS Service (Twilio)
TWILIO_ACCOUNT_SID="AC..."
TWILIO_AUTH_TOKEN="..."
TWILIO_SECRET="..."

# Payment Gateway (Flutterwave)
FLUTTERWAVE_SECRET_KEY="FLWSECK_TEST-..."
FLUTTERWAVE_PUBLIC_KEY="FLWPUBK_TEST-..."
FLUTTERWAVE_BASE_URL="https://api.flutterwave.com"
FLUTTERWAVE_WEBHOOK_SECRET="..."

# File Storage (AWS S3)
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
AWS_REGION="us-east-1"
AWS_S3_BUCKET_NAME="your-bucket"
```

## API Endpoints

### Authentication & User Management
```http
# Authentication
POST   /auth/otp                            # Generate OTP for login
POST   /auth/verify                         # Verify OTP and get JWT tokens
POST   /auth/logout                         # Logout and blacklist token
POST   /auth/refresh-token                  # Refresh access token
POST   /auth/validate-token                 # Validate JWT token

# User Management
GET    /users/me                            # Get current user profile
GET    /users/:id                           # Get user by ID (admin/staff only)
PUT    /users/:userId/profile               # Update user profile
GET    /users/pending-approvals             # Get pending user approvals
PUT    /users/:userId/approve               # Approve user (admin/staff only)
PUT    /users/:userId/reject                # Reject user (admin/staff only)

# Staff & Chauffeur Management
POST   /users/admins/:adminId/staff         # Create staff (admin only)
POST   /users/fleet-owners/:id/chauffeurs   # Add chauffeur to fleet
GET    /users/fleet-owners/:id/chauffeurs   # Get fleet chauffeurs

# Onboarding
POST   /onboarding                          # Complete fleet owner onboarding
GET    /onboarding/banks                    # Get supported banks list
```

### Fleet Management
```http
# Fleet Operations
POST   /fleet                               # Create fleet (fleet owner)
GET    /fleet/my-fleet                      # Get my fleet details
POST   /fleet/cars                          # Add car to fleet (with file upload)
GET    /fleet/cars                          # Get my fleet cars
GET    /fleet/cars/:carId                   # Get car details
PUT    /fleet/cars/:carId                   # Update car (rates, status)
DELETE /fleet/cars/:carId                   # Remove car from fleet
POST   /fleet/chauffeurs                    # Assign chauffeur to fleet

# Car Approval (Admin/Staff only)
GET    /fleet/cars/pending-approval         # Get pending approval cars
PUT    /fleet/cars/:carId/approve           # Approve car
PUT    /fleet/cars/:carId/reject            # Reject car with reason
```

### Booking Management
```http
# Booking Operations
POST   /bookings                            # Create new booking
GET    /bookings                            # Get all bookings for current user
PUT    /bookings/:id/cancel                 # Cancel booking
GET    /bookings/:id/payment-status         # Check payment status

# Chauffeur Assignment
PUT    /bookings/:id/assign-chauffeur       # Assign chauffeur to booking
PUT    /bookings/:id/unassign-chauffeur     # Remove chauffeur from booking
GET    /bookings/available-chauffeurs       # Get available chauffeurs for date range
GET    /bookings/:id/chauffeur-availability/:chauffeurId  # Check specific availability
```

### Payment & Webhooks
```http
# Payment Processing
POST   /api/payments/webhook/flutterwave    # Flutterwave webhook handler
```

### Health & Monitoring
```http
# Health Checks
GET    /health                              # Application health status
GET    /health/queue-stats                  # Queue statistics and job counts

# Manual Job Triggers (for testing and debugging)
POST   /health/trigger/reminders/:type      # Trigger reminders (trip-start, trip-end, leg-start, leg-end)
POST   /health/trigger/status-updates/:type # Trigger status updates (confirmed-to-active, active-to-completed)
POST   /health/trigger/processing/:type     # Trigger processing jobs (pending-payouts, pending-notifications)
```

## Background Jobs & Scheduling

The application uses Bull queues with Redis for background job processing:

### Automated Cron Jobs
- **Booking Reminders**: Automated reminders for trip start/end and booking legs
- **Status Updates**: Automatic booking status transitions based on business rules
- **Payout Processing**: Automated payout initiation for completed bookings
- **Notification Processing**: Queue processing for email/SMS notifications

### Queue Processors
- **ReminderProcessor**: Handles booking and trip reminder notifications
- **StatusUpdateProcessor**: Manages booking lifecycle status transitions
- **ProcessingProcessor**: Processes pending payouts and notifications

### Manual Testing
Use the health endpoints to manually trigger jobs for testing:
- `/health/trigger/reminders/trip-start`
- `/health/trigger/status-updates/confirmed-to-active`
- `/health/trigger/processing/pending-payouts`

## Development Commands

### Build & Start
```bash
pnpm build                    # Build the application
pnpm start:dev               # Start in development mode with watch
pnpm start:prod              # Start in production mode
pnpm deploy                  # Build and generate Prisma client for deployment
```

### Code Quality
```bash
pnpm lint                    # Run Biome linter with auto-fix
pnpm lint:check              # Run Biome linter without auto-fix
pnpm format                  # Format code with Biome
pnpm check                   # Run both linting and formatting with auto-fix
pnpm check:ci                # Run all checks for CI (no auto-fix)
```

### Testing
```bash
pnpm test                    # Run all tests with Vitest
pnpm test:watch              # Run tests in watch mode
pnpm test:ui                 # Run tests with Vitest UI
pnpm test:coverage           # Run tests with coverage report
pnpm test:unit               # Run unit tests once
pnpm test:e2e                # Run E2E tests
pnpm test:e2e:watch          # Run E2E tests in watch mode
pnpm test:all                # Run all tests (unit + E2E)
```

### Database
```bash
pnpm db:generate             # Generate Prisma client
pnpm db:push                 # Push schema changes to database
pnpm db:migrate              # Create and apply migrations
```

## Key Features

### Domain-Driven Design
- **Clear Bounded Contexts**: IAM, Fleet, Booking, Payment, Communication domains
- **Rich Domain Models**: Entities with encapsulated business logic and invariants
- **Value Objects**: Type-safe immutable values (Money, PhoneNumber, BookingStatus)
- **Domain Events**: Event-driven communication between contexts
- **Repository Pattern**: Clean separation of domain and infrastructure

### Event-Driven Architecture
- **Domain Events**: Published when aggregate state changes occur
- **Event Handlers**: Coordinate cross-domain operations using CQRS pattern
- **Loose Coupling**: Domains communicate through events, not direct dependencies

### Authentication & Authorization
- **Email-based OTP**: Secure passwordless authentication system
- **JWT Tokens**: Access and refresh token management with blacklisting
- **Role-based Access**: Fine-grained permissions (admin, staff, fleetOwner, chauffeur, user)
- **User Approval Workflow**: Multi-step approval process for fleet owners

### Fleet Management
- **Complete Fleet Operations**: Fleet creation, car management, chauffeur assignments
- **Car Approval Workflow**: Admin/staff approval process for vehicle registration
- **File Upload**: S3 integration for car documents and images
- **Status Management**: Dynamic car availability and booking status tracking

### Booking System
- **End-to-End Booking**: From creation through payment to completion
- **Chauffeur Assignment**: Cross-domain validation and availability checking
- **Payment Integration**: Flutterwave payment processing with webhook handling
- **Cost Calculation**: Dynamic pricing with platform fees and breakdowns

### Payment Processing
- **Automated Payouts**: Fleet owner payouts on booking completion
- **Webhook Integration**: Real-time payment status updates from Flutterwave
- **Bank Verification**: Nigerian bank account validation
- **Retry Mechanisms**: Robust error handling and retry logic

### Communication System
- **Multi-channel Notifications**: Email (Resend) and SMS (Twilio) support
- **Event-driven Messaging**: Automatic notifications for booking lifecycle events
- **Template System**: React-based email templates with Tailwind CSS
- **Notification Factories**: Domain-specific message generation

### Background Processing
- **Bull Queues**: Redis-backed job processing with Bull queues
- **Scheduled Jobs**: Automated cron jobs for reminders and status updates
- **Manual Triggers**: Health endpoints for testing and debugging
- **Monitoring**: Queue statistics and health indicators

### Technology Stack
- **Framework**: NestJS with TypeScript and strict mode
- **Database**: PostgreSQL with Prisma ORM and migrations
- **Caching**: Redis for queues and caching layers
- **Validation**: Zod for environment config, class-validator for DTOs
- **Code Quality**: Biome for linting and formatting
- **Testing**: Vitest for unit tests, Supertest + fishery for E2E tests
- **File Storage**: AWS S3 for document and image storage
- **External Services**: Resend (email), Twilio (SMS), Flutterwave (payments)

## Domain Events Reference

The application uses domain events for loose coupling between bounded contexts. Key events include:

### IAM Domain Events
- `UserRegisteredEvent` - New user account created
- `OtpVerifiedEvent` - OTP successfully verified during authentication
- `UserAuthenticatedEvent` - User completed authentication
- `UserApprovedEvent` - User approved by admin/staff
- `UserRoleAssignedEvent` - Role assigned to user
- `ChauffeurAddedEvent` - Chauffeur added to fleet owner
- `FleetOwnerApprovedEvent` - Fleet owner account approved

### Fleet Domain Events
- `FleetCreatedEvent` - New fleet registered
- `FleetCarAddedEvent` - Car added to fleet
- `CarCreatedEvent` - New car registration
- `CarStatusChangedEvent` - Car availability updated
- `CarApprovalStatusChangedEvent` - Admin approval workflow

### Booking Domain Events
- `BookingCreatedEvent` - New booking initiated
- `BookingChauffeurAssignedEvent` - Chauffeur assigned to booking
- `BookingChauffeurUnassignedEvent` - Chauffeur removed from booking
- `BookingConfirmedEvent` - Booking confirmed and ready
- `BookingActivatedEvent` - Booking started (trip in progress)
- `BookingCompletedEvent` - Booking finished successfully
- `BookingCancelledEvent` - Booking cancelled by user

### Payment Domain Events
- `PaymentConfirmedEvent` - Booking payment confirmed
- `PaymentVerificationCompletedEvent` - Payment verification process completed
- `PayoutInitiatedEvent` - Payout initiated for fleet owner
- `PayoutProcessingEvent` - Payout moved to processing status
- `PayoutCompletedEvent` - Payout successfully completed
- `PayoutFailedEvent` - Payout failed with error details

## Benefits of This Architecture

1. **Maintainability**: Clear separation of concerns with explicit business rules
2. **Testability**: Domain logic isolated from infrastructure concerns
3. **Scalability**: Loosely coupled domains that evolve independently
4. **Reliability**: Comprehensive error handling, retries, and monitoring
5. **Type Safety**: End-to-end TypeScript with domain value objects
6. **Flexibility**: Easy to extend with new features or modify existing ones
7. **Security**: Role-based access control with JWT authentication
8. **Performance**: Caching layers and background job processing

This implementation demonstrates a production-ready, enterprise-grade chauffeur service marketplace built with Domain-Driven Design principles using NestJS.
