import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db.ts';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-in-prod';

router.post('/login', (req, res) => {
  const { usuario, password } = req.body;

  try {
    const stmt = db.prepare('SELECT * FROM users WHERE usuario = ?');
    const user = stmt.get(usuario) as any;

    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      { id: user.id, usuario: user.usuario, rol: user.rol },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    const { password: _, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword, token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: true,
    sameSite: 'none'
  });
  res.json({ message: 'Sesión cerrada' });
});

router.get('/me', (req, res) => {
  let token = req.cookies.token;

  if (!token && req.headers.authorization) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const stmt = db.prepare('SELECT id, nombre, usuario, email, rol FROM users WHERE id = ?');
    const user = stmt.get(decoded.id);

    if (!user) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    res.json({ user });
  } catch (error) {
    res.status(401).json({ error: 'Token inválido' });
  }
});

export const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  let token = req.cookies.token;

  if (!token && req.headers.authorization) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    console.warn(`Unauthorized access attempt to ${req.originalUrl} - No token found in cookies or headers`);
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    (req as any).user = decoded;
    next();
  } catch (error) {
    console.error(`Auth error for ${req.originalUrl}:`, error);
    res.status(401).json({ error: 'Token inválido' });
  }
};

// Users management (superadmin only)
router.get('/users', requireAuth, (req: any, res) => {
  if (req.user.rol !== 'superadmin') return res.status(403).json({ error: 'Forbidden' });
  try {
    const stmt = db.prepare('SELECT id, nombre, usuario, email, rol, created_at FROM users ORDER BY created_at DESC');
    res.json(stmt.all());
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.post('/users', requireAuth, (req: any, res) => {
  if (req.user.rol !== 'superadmin') return res.status(403).json({ error: 'Forbidden' });
  const { nombre, usuario, email, password, rol } = req.body;
  
  try {
    // Check if email or username already exists
    const existing = db.prepare('SELECT id FROM users WHERE email = ? OR usuario = ?').get(email, usuario);
    if (existing) {
      return res.status(400).json({ error: 'El correo o usuario ya está registrado.' });
    }

    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);
    const insertUser = db.prepare(`
      INSERT INTO users (id, nombre, usuario, email, password, rol)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertUser.run(uuidv4(), nombre, usuario, email, hash, rol);
    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

router.delete('/users/:id', requireAuth, (req: any, res) => {
  if (req.user.rol !== 'superadmin') return res.status(403).json({ error: 'Forbidden' });
  try {
    const stmt = db.prepare('DELETE FROM users WHERE id = ?');
    stmt.run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

router.put('/users/:id', requireAuth, (req: any, res) => {
  if (req.user.rol !== 'superadmin') return res.status(403).json({ error: 'Forbidden' });
  const { nombre, usuario, email, password, rol } = req.body;
  
  try {
    // Check if email or username already exists for OTHER users
    const existing = db.prepare('SELECT id FROM users WHERE (email = ? OR usuario = ?) AND id != ?').get(email, usuario, req.params.id);
    if (existing) {
      return res.status(400).json({ error: 'El correo o usuario ya está registrado por otro usuario.' });
    }

    if (password) {
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(password, salt);
      const stmt = db.prepare(`
        UPDATE users 
        SET nombre = ?, usuario = ?, email = ?, password = ?, rol = ?
        WHERE id = ?
      `);
      stmt.run(nombre, usuario, email, hash, rol, req.params.id);
    } else {
      const stmt = db.prepare(`
        UPDATE users 
        SET nombre = ?, usuario = ?, email = ?, rol = ?
        WHERE id = ?
      `);
      stmt.run(nombre, usuario, email, rol, req.params.id);
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

router.put('/me', requireAuth, (req: any, res) => {
  const { nombre, usuario, email, password } = req.body;
  
  try {
    // Check if email or username already exists for OTHER users
    const existing = db.prepare('SELECT id FROM users WHERE (email = ? OR usuario = ?) AND id != ?').get(email, usuario, req.user.id);
    if (existing) {
      return res.status(400).json({ error: 'El correo o usuario ya está registrado por otro usuario.' });
    }

    if (password) {
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(password, salt);
      const stmt = db.prepare(`
        UPDATE users 
        SET nombre = ?, usuario = ?, email = ?, password = ?
        WHERE id = ?
      `);
      stmt.run(nombre, usuario, email, hash, req.user.id);
    } else {
      const stmt = db.prepare(`
        UPDATE users 
        SET nombre = ?, usuario = ?, email = ?
        WHERE id = ?
      `);
      stmt.run(nombre, usuario, email, req.user.id);
    }
    
    // Fetch updated user to return
    const stmt = db.prepare('SELECT id, nombre, usuario, email, rol FROM users WHERE id = ?');
    const updatedUser = stmt.get(req.user.id);
    
    res.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;
