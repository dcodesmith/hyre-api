export enum UserTypeEnum {
  REGISTERED = "REGISTERED",
  GUEST = "GUEST",
}

export class UserType {
  private constructor(private readonly _value: UserTypeEnum) {}

  public static registered(): UserType {
    return new UserType(UserTypeEnum.REGISTERED);
  }

  public static guest(): UserType {
    return new UserType(UserTypeEnum.GUEST);
  }

  public static fromString(value: string): UserType {
    if (!Object.values(UserTypeEnum).includes(value as UserTypeEnum)) {
      throw new Error(`Invalid user type: ${value}`);
    }
    return new UserType(value as UserTypeEnum);
  }

  public get value(): UserTypeEnum {
    return this._value;
  }

  public isRegistered(): boolean {
    return this._value === UserTypeEnum.REGISTERED;
  }

  public isGuest(): boolean {
    return this._value === UserTypeEnum.GUEST;
  }

  public toString(): string {
    return this._value;
  }

  public equals(other: UserType): boolean {
    return this._value === other._value;
  }
}
