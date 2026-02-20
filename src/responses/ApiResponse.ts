import { Request } from "express";

export class ApiResponse<T> {
  status: number;
  message: string;
  data?: T;
  token?: string;
  timestamp: string;
  path: string;

  constructor(
    status: number,
    message: string,
    req: Request,
    data?: T,
    token?: string
  ) {
    this.status = status;
    this.message = message;
    this.data = data;
    this.token = token;
    this.timestamp = new Date().toISOString();
    this.path = req.originalUrl;
  }

  static success<T>(message: string, req: Request, data?: T, token?: string) {
    return new ApiResponse<T>(200, message, req, data, token);
  }

  static error<T>(message: string, status: number, req: Request, data?: T) {
    return new ApiResponse<T>(status, message, req, data);
  }
}
