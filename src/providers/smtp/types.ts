export interface SmtpAuthPlain {
  type: "plain";
  user: string;
  pass: string;
}

export interface SmtpAuthLogin {
  type: "login";
  user: string;
  pass: string;
}

export interface SmtpAuthOAuth2 {
  type: "oauth2";
  user: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  accessToken?: string;
}

export type SmtpAuth = SmtpAuthPlain | SmtpAuthLogin | SmtpAuthOAuth2;

export interface SmtpTransportOptions {
  host: string;
  port?: number;
  secure?: boolean;
  auth?: SmtpAuth;
  connectionTimeout?: number;
  socketTimeout?: number;
  greetingTimeout?: number;
  tls?: {
    rejectUnauthorized?: boolean;
    minVersion?: string;
  };
  pool?: {
    enabled: boolean;
    maxConnections?: number;
    idleTimeout?: number;
  };
  dkim?: {
    domain: string;
    selector: string;
    privateKey: string;
    headers?: string[];
  };
}

export interface SmtpCommand {
  command: string;
  expectedCode: number | number[];
}

export interface SmtpResponse {
  code: number;
  lines: string[];
}
