export class PickupTime {
  constructor(private readonly value: string) {
    this.validate(value);
  }

  private validate(value: string): void {
    const timePattern = /^(1[0-2]|[1-9]):[0-5][0-9]\s(AM|PM)$/;
    if (!timePattern.test(value)) {
      throw new Error(
        `Invalid pickup time format: ${value}. Expected format: "8:00 AM" or "11:30 PM"`,
      );
    }
  }

  public static create(value: string): PickupTime {
    return new PickupTime(value);
  }

  public toString(): string {
    return this.value;
  }

  public to24Hour(): { hours: number; minutes: number } {
    const [time, period] = this.value.split(" ");
    const [hoursStr, minutesStr = "00"] = time.split(":");

    let hours = Number.parseInt(hoursStr);
    const minutes = Number.parseInt(minutesStr);

    if (period === "PM" && hours !== 12) {
      hours += 12;
    } else if (period === "AM" && hours === 12) {
      hours = 0;
    }

    return { hours, minutes };
  }
}
