export class LoginDto {
  declare email: string;
  declare password: string;
  /** When true, issue a persistent cookie with role-specific expiry. Defaults to false. */
  declare rememberMe?: boolean;
}
