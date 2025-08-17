import { ValueObject } from "../../../shared/domain/value-object";

interface NotificationContentProps {
  subject: string;
  body: string;
  templateVariables: Record<string, string>;
}

export class NotificationContent extends ValueObject<NotificationContentProps> {
  get subject(): string {
    return this.props.subject;
  }

  get body(): string {
    return this.props.body;
  }

  get templateVariables(): Record<string, string> {
    return { ...this.props.templateVariables };
  }

  private constructor(props: NotificationContentProps) {
    super(props);
  }

  public static create(
    subject: string,
    body: string,
    templateVariables: Record<string, string> = {},
  ): NotificationContent {
    if (!subject || subject.trim().length === 0) {
      throw new Error("Notification subject cannot be empty");
    }

    if (!body || body.trim().length === 0) {
      throw new Error("Notification body cannot be empty");
    }

    return new NotificationContent({
      subject: subject.trim(),
      body: body.trim(),
      templateVariables: { ...templateVariables },
    });
  }

  public interpolate(): NotificationContent {
    let interpolatedSubject = this.props.subject;
    let interpolatedBody = this.props.body;

    // Replace template variables in subject and body
    for (const [key, value] of Object.entries(this.props.templateVariables)) {
      const placeholder = `{{${key}}}`;
      interpolatedSubject = interpolatedSubject.replace(new RegExp(placeholder, "g"), value);
      interpolatedBody = interpolatedBody.replace(new RegExp(placeholder, "g"), value);
    }

    return new NotificationContent({
      subject: interpolatedSubject,
      body: interpolatedBody,
      templateVariables: this.props.templateVariables,
    });
  }

  public hasVariable(variableName: string): boolean {
    return variableName in this.props.templateVariables;
  }

  public getVariable(variableName: string): string | undefined {
    return this.props.templateVariables[variableName];
  }

  public withVariable(name: string, value: string): NotificationContent {
    return new NotificationContent({
      subject: this.props.subject,
      body: this.props.body,
      templateVariables: {
        ...this.props.templateVariables,
        [name]: value,
      },
    });
  }
}
