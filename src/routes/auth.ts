import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

const router = Router();

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (email !== 'admin@3facil.com' || password !== 'Abacaxi28#') {
    res.status(401).json({ error: 'Credenciais inválidas.' });
    return;
  }

  const secret = process.env.JWT_SECRET || 'chave_secreta_jwt_3facil_2026';

  const token = jwt.sign(
    { userId: 'admin-123', role: 'superadmin' },
    secret,
    { expiresIn: '8h' }
  );

  res.json({
    token,
    accessToken: token,
    success: true,
    user: {
      id: 'admin-123',
      email: 'admin@3facil.com',
      role: 'superadmin'
    }
  });
});

export default router;
