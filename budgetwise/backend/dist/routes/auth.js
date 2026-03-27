import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { signAccessToken } from "../lib/jwt.js";
import { loginSchema, registerSchema, resetPasswordSchema } from "../validators/authSchemas.js";
import { authRequired, PASSWORD_HASH_SALT } from "../middleware/authRequired.js";
export const authRouter = Router();
/**
 * R-101: Register/Login with email/password.
 * Passwords are stored as bcrypt hashes (never plaintext).
 */
authRouter.post("/register", async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const { email, password, name } = parsed.data;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing)
        return res.status(409).json({ error: "Email already in use" });
    const passwordHash = await bcrypt.hash(password, PASSWORD_HASH_SALT);
    const user = await prisma.user.create({
        data: { email, passwordHash, name },
    });
    const token = signAccessToken({ sub: user.id, email: user.email });
    res.status(201).json({
        token,
        user: { id: user.id, email: user.email, name: user.name },
    });
});
authRouter.post("/login", async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user)
        return res.status(401).json({ error: "Invalid credentials" });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok)
        return res.status(401).json({ error: "Invalid credentials" });
    const token = signAccessToken({ sub: user.id, email: user.email });
    res.json({
        token,
        user: { id: user.id, email: user.email, name: user.name },
    });
});
authRouter.post("/resetPassword", async (req, res) => {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const { email, password } = parsed.data;
    const existingUser = await prisma.user.findUnique({
        where: { email },
    });
    if (!existingUser) {
        return res.status(404).json({ error: "User not found" });
    }
    const passwordHash = await bcrypt.hash(password, PASSWORD_HASH_SALT);
    const user = await prisma.user.update({
        where: { email },
        data: { passwordHash },
    });
    const token = signAccessToken({ sub: user.id, email: user.email });
    res.json({
        token,
        user: { id: user.id, email: user.email, name: user.name },
    });
});
/**
 * Contract convenience: /api/auth/me
 * Mirrors profile /me but under the Auth tag for the OpenAPI spec.
 */
authRouter.get("/me", authRequired, async (req, res) => {
    const userId = req.user.id;
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true, createdAt: true },
    });
    res.json({ user });
});
