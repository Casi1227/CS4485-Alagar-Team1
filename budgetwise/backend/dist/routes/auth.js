import { Router } from "express";
import bcrypt from "bcryptjs";
import cryptoRandomString from "crypto-random-string";
import nodemailer from "nodemailer";
import { prisma } from "../lib/prisma.js";
import { signAccessToken } from "../lib/jwt.js";
import { loginSchema, registerSchema, forgotPasswordSchema, resetPasswordSchema, RESET_PASSWORD_REQUEST_KEY_LENGTH } from "../validators/authSchemas.js";
import { authRequired, PASSWORD_HASH_SALT } from "../middleware/authRequired.js";
import { env } from "../config/env.js";
export const authRouter = Router();
/* 30 minutes. */
const RESET_PASSWORD_REQUEST_MAX_LIFESPAN_MS = 1_800_000;
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
authRouter.post("/forgot-password", async (req, res) => {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    const { email } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }
    const key = cryptoRandomString({
        length: RESET_PASSWORD_REQUEST_KEY_LENGTH,
        type: "url-safe",
    });
    const keyHash = await bcrypt.hash(key, PASSWORD_HASH_SALT);
    await prisma.resetPasswordRequest.upsert({
        where: { userId: user.id },
        update: { keyHash, createdAt: new Date() },
        create: { userId: user.id, keyHash },
    });
    const mailTransport = nodemailer.createTransport({
        host: env.MAIL_SERVER_NAME,
        port: env.MAIL_SERVER_PORT,
        secure: env.MAIL_SERVER_SECURE,
        auth: {
            user: env.MAIL_SERVER_USER,
            pass: env.MAIL_SERVER_PASSWORD,
        },
    });
    let resetPasswordUrl = new URL("/reset-password", env.CORS_ORIGIN);
    resetPasswordUrl.searchParams.set("email", user.email);
    resetPasswordUrl.searchParams.set("key", key);
    const resetPasswordEmailMessage = {
        from: {
            name: env.RESET_PASSWORD_SENDER_NAME,
            address: env.RESET_PASSWORD_SENDER_ADDRESS,
        },
        to: {
            name: user.name,
            address: user.email,
        },
        subject: "Reset Your Account Password",
        text: `\
Hello, ${user.name}.

Please user the following link to reset your password. \
The link is valid \
for ${RESET_PASSWORD_REQUEST_MAX_LIFESPAN_MS / 60_000} minutes.

${resetPasswordUrl.href}

Thank you,
Budgetwise\
`,
    };
    //console.log(
    //	`Reset-password email message: ${
    //		JSON.stringify(resetPasswordEmailMessage, null, '\t')
    //	}`,
    //);
    try {
        await mailTransport.sendMail(resetPasswordEmailMessage);
    }
    catch (err) {
        return res.status(500).json({ error: err });
    }
    return res.json({ ok: true });
});
authRouter.post("/reset-password", async (req, res) => {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    const { email, key, password } = parsed.data;
    console.log(email);
    console.log(key);
    console.log(password);
    const existingUser = await prisma.user.findUnique({
        where: { email },
    });
    if (!existingUser) {
        return res.status(404).json({ error: "User not found" });
    }
    const userId = existingUser.id;
    const now = new Date();
    const resetPasswordRequest = await prisma.resetPasswordRequest.findUnique({
        where: { userId },
    });
    if (!resetPasswordRequest
        || !await bcrypt.compare(key, resetPasswordRequest.keyHash)
        || Number(now) - Number(resetPasswordRequest.createdAt)
            > RESET_PASSWORD_REQUEST_MAX_LIFESPAN_MS) {
        //console.log(resetPasswordRequest);
        //console.log(
        //    Number(now) - Number(resetPasswordRequest.createdAt)
        //);
        return res
            .status(404)
            .json({ error: "Reset-password link expired" });
    }
    await prisma.resetPasswordRequest.delete({
        where: { userId },
    });
    const passwordHash = await bcrypt.hash(password, PASSWORD_HASH_SALT);
    await prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
    });
    return res.json({ ok: true });
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
