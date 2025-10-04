import { Request, Response } from 'express';

export const getUsers = (req: Request, res: Response) => {
  const users = [
    { id: 1, name: 'Maria' },
    { id: 2, name: 'João' },
  ];

  res.json(users);
};
