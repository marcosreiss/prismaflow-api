import { Request, Response, NextFunction } from "express";
import { prisma } from "../../config/prisma";
import { ApiResponse } from "../../responses/ApiResponse";

export const getUserById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      const notFound = ApiResponse.error("User not found", 404, req);
      return res.status(404).json(notFound);
    }

    const response = ApiResponse.success("Record found", req, user);
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
};
