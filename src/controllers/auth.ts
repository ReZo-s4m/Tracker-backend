import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { ApiError, asyncHandler } from '../errors';
import { User } from '../models/User';
import { loginSchema, signupSchema } from '../schemas/auth';

const signToken = (userId: string) => jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: '7d' });

const toUserDto = (user: { id: string; name: string; email: string }) => ({
  id: user.id,
  name: user.name,
  email: user.email,
});

export const signup = asyncHandler(async (req, res) => {
  const body = signupSchema.parse(req.body);
  const passwordHash = await bcrypt.hash(body.password, 10);
  try {
    const user = await User.create({ name: body.name, email: body.email, passwordHash });
    res.status(201).json({ token: signToken(user.id), user: toUserDto(user) });
  } catch (err) {
    if (typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000) {
      throw new ApiError(409, 'Email already registered', 'EMAIL_TAKEN');
    }
    throw err;
  }
});

export const me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) throw new ApiError(401, 'Invalid or expired token', 'UNAUTHENTICATED');
  res.json({ user: toUserDto(user) });
});

export const login = asyncHandler(async (req, res) => {
  const body = loginSchema.parse(req.body);
  const user = await User.findOne({ email: body.email });
  const valid = user && (await bcrypt.compare(body.password, user.passwordHash));
  if (!valid) throw new ApiError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  res.json({ token: signToken(user.id), user: toUserDto(user) });
});
