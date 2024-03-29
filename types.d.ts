import { IncomingMessage } from "http";

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      CLIENT_ID: string;
      CLIENT_SECRET: string;
      JWT_SECRET: string;
    }
  }
}

export interface UserIncomingMessage extends IncomingMessage {
  user: any
}

export {};
