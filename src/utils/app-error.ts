// src/utils/app-error.ts
export class AppError extends Error {
  constructor(
    public message: string,
    public status: number = 400,
  ) {
    super(message);
  }
}
