import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

export const setupMiddlewares = (app: express.Application) => {
  app.use(express.json());
  app.use(
    cors({
      origin: ["http://localhost:5173", "https://prismaflow.vercel.app"],
      credentials: true,
    })
  );
  app.use(helmet());
  app.use(morgan("dev"));
};
