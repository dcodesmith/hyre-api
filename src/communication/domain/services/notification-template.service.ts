import { Injectable } from "@nestjs/common";

@Injectable()
export class NotificationTemplateService {
  getBookingStartReminderTemplate(role: "customer" | "chauffeur"): string {
    if (role === "customer") {
      return `
        Dear {{customerName}},
        
        This is a reminder that your booking with {{carName}} is starting in approximately 1 hour.
        
        Pickup: {{pickupLocation}} at {{startTime}}
        Return: {{returnLocation}} at {{endTime}}
        Chauffeur: {{chauffeurName}}
        
        Please be ready for pickup.
        
        Best regards,
        The Team
      `;
    }

    return `
        Dear {{chauffeurName}},
        
        This is a reminder that you have a booking starting in approximately 1 hour.
        
        Customer: {{customerName}}
        Vehicle: {{carName}}
        Pickup: {{pickupLocation}} at {{startTime}}
        Return: {{returnLocation}} at {{endTime}}
        
        Please ensure you arrive on time.
        
        Best regards,
        The Team
      `;
  }

  getBookingEndReminderTemplate(role: "customer" | "chauffeur"): string {
    if (role === "customer") {
      return `
        Dear {{customerName}},
        
        This is a reminder that your booking with {{carName}} is ending in approximately 1 hour.
        
        Please ensure you return the vehicle to {{returnLocation}} by {{endTime}}.
        
        Best regards,
        The Team
      `;
    }
    return `
        Dear {{chauffeurName}},
        
        This is a reminder that your current booking is ending in approximately 1 hour.
        
        Please ensure the vehicle is returned to {{returnLocation}} by {{endTime}}.
        
        Best regards,
        The Team
      `;
  }

  getBookingLegStartReminderTemplate(role: "customer" | "chauffeur"): string {
    if (role === "customer") {
      return `
        Dear {{customerName}},
        
        This is a reminder that your next service leg is starting in approximately 1 hour.
        
        Pickup: {{pickupLocation}} at {{legStartTime}}
        Duration: Until {{legEndTime}}
        Vehicle: {{carName}}
        Chauffeur: {{chauffeurName}}
        
        Please be ready.
        
        Best regards,
        The Team
      `;
    }

    return `
        Dear {{chauffeurName}},
        
        This is a reminder that you have a service leg starting in approximately 1 hour.
        
        Customer: {{customerName}}
        Vehicle: {{carName}}
        Pickup: {{pickupLocation}} at {{legStartTime}}
        Duration: Until {{legEndTime}}
        
        Best regards,
        The Team
      `;
  }

  getBookingStatusUpdateTemplate(): string {
    return `
      Dear {{customerName}},

      Your booking status has been updated to: {{status}}

      Booking Details:
      - Vehicle: {{carName}}
      - Start: {{startDate}}
      - End: {{endDate}}
      - Pickup: {{pickupLocation}}
      - Return: {{returnLocation}}

      Thank you for choosing our service.

      Best regards,
      The Team
    `;
  }

  getFleetOwnerBookingAlertTemplate(): string {
    return `
      Dear {{fleetOwnerName}},

      You have a new booking for your vehicle!

      Booking Details:
      - Reference: {{bookingReference}}
      - Vehicle: {{carName}}
      - Customer: {{customerName}}
      - Start: {{startDate}}
      - End: {{endDate}}
      - Pickup: {{pickupLocation}}
      - Return: {{returnLocation}}

      Please ensure your vehicle is ready for the booking period.

      Best regards,
      The Hyre Team
    `;
  }

  getOtpEmailTemplate(otpType: "registration" | "login"): string {
    if (otpType === "registration") {
      return `
        Welcome to Hyre!
        
        Thank you for joining our premium car rental service. To complete your registration, please use the verification code below:
        
        Verification Code: {{otpCode}}
        
        This code expires at {{expiresAt}}
        
        What's next?
        1. Return to the Hyre app or website
        2. Enter this verification code when prompted
        3. Complete your profile setup
        4. Start booking premium vehicles!
        
        Security Notice:
        Never share this code with anyone. If you didn't request this code, please ignore this email.
        
        Welcome aboard!
        The Hyre Team
      `;
    }

    return `
      Welcome back to Hyre!
      
      Here's your verification code to log in to your account:
      
      Verification Code: {{otpCode}}
      
      This code expires at {{expiresAt}}
      
      Simply enter this code in the app or website to continue.
      
      Security Notice:
      Never share this code with anyone. If you didn't request this code, please secure your account immediately.
      
      Best regards,
      The Hyre Team
    `;
  }

  getWelcomeTemplate(role: string): string {
    const roleSpecificContent = this.getRoleSpecificWelcomeContent(role);

    return `
      Welcome to Hyre, {{name}}!
      
      Your account has been successfully created and is ready to use.
      
      ${roleSpecificContent}
      
      Getting Started:
      1. Complete your profile setup
      2. ${this.getNextStepsForRole(role)}
      3. Explore our premium services
      
      Need help? Our support team is here to assist you.
      
      Welcome to the Hyre family!
      The Hyre Team
    `;
  }

  getLoginConfirmationTemplate(): string {
    return `
      Login Confirmation - Hyre
      
      Hello {{name}},
      
      This is to confirm that you successfully logged into your Hyre account.
      
      Login Details:
      - Time: {{loginTime}}
      - IP Address: {{ipAddress}}
      - Device: {{userAgent}}
      
      If this wasn't you, please secure your account immediately and contact our support team.
      
      Best regards,
      The Hyre Team
    `;
  }

  private getRoleSpecificWelcomeContent(role: string): string {
    switch (role.toLowerCase()) {
      case "fleetowner":
      case "fleet_owner":
        return "As a Fleet Owner, you can now list your premium vehicles and start earning with Hyre.";
      case "chauffeur":
        return "As a Chauffeur, you're ready to provide exceptional service to our premium customers.";
      case "admin":
      case "staff":
        return "As an Admin, you have access to manage the Hyre platform and support our community.";
      default:
        return "As a Customer, you can now book premium vehicles and chauffeur services.";
    }
  }

  private getNextStepsForRole(role: string): string {
    switch (role.toLowerCase()) {
      case "fleetowner":
      case "fleet_owner":
        return "Add your vehicles to start earning";
      case "chauffeur":
        return "Complete your driver verification";
      case "admin":
      case "staff":
        return "Access the admin dashboard";
      default:
        return "Browse and book your first vehicle";
    }
  }
}
