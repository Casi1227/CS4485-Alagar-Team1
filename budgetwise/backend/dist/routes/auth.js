import { Router } from "express";
import bcrypt from "bcryptjs";
import cryptoRandomString from "crypto-random-string";
import nodemailer from "nodemailer";
import { prisma } from "../lib/prisma.js";
import { signAccessToken } from "../lib/jwt.js";
import { loginSchema, registerSchema, forgotPasswordSchema, resetPasswordSchema, RESET_PASSWORD_REQUEST_KEY_LENGTH } from "../validators/authSchemas.js";
import { authRequired, PASSWORD_HASH_SALT } from "../middleware/authRequired.js";
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
    const user = await prisma.user.findUnique({
        where: { email },
    });
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
        create: { keyHash },
    });
    const MESSAGE_SUBMISSION_TLS_PORT = 465;
    const MESSAGE_SUBMISSION_PORT = 587;
    const mailServerName = process.env.MAIL_SERVER_NAME ?? "localhost";
    let mailServerPort = process.env.MAIL_SERVER_PORT;
    let mailServerSecure = process.env.MAIL_SERVER_SECURE;
    if (mailServerPort == null || mailServerPort == "") {
        if (mailServerSecure == null || mailServerSecure == "") {
            mailServerSecure = true;
        }
        mailServerPort = mailServerSecure
            ? MESSAGE_SUBMISSION_TLS_PORT
            : MESSAGE_SUBMISSION_PORT;
    }
    else if (mailServerSecure == null || mailServerSecure == "") {
        mailServerSecure = mailServerPort == MESSAGE_SUBMISSION_TLS_PORT;
    }
    const mailTransport = nodemailer.createTransport({
        host: mailServerName,
        port: mailServerPort,
        secure: mailServerSecure,
    });
    let resetPasswordUrl = new URL("/reset-password", `${req.protocol}://${req.host}`);
    resetPasswordUrl.searchParams.set("email", user.email);
    resetPasswordUrl.searchParams.set("key", key);
    return mailTransport.sendMail({
        from: `\
Budgetwise <${process.env.MAIL_SERVER_RESET_PASSWORD_SENDER}>\
`,
        to: `${user.name} <${user.email}>`,
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
    }, (err, info) => {
        console.log(`Reset-password email: ${info}`);
        if (err) {
            return res.status(500).json({ error: err });
        }
        return res.json({ ok: true });
    });
});
authRouter.post("/reset-password", async (req, res) => {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    const { email, key, password } = parsed.data;
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
        || await bcrypt.hash(key, PASSWORD_HASH_SALT)
            != resetPasswordRequest.keyHash
        || now - resetPasswordRequest.createdAt
            > RESET_PASSWORD_REQUEST_MAX_LIFESPAN_MS) {
        return res
            .status(404)
            .json({ error: "Reset-password link expired" });
    }
    await prisma.resetPasswordRequest.delete({
        where: { userId },
    });
    const passwordHash = await bcrypt.hash(password, PASSWORD_HASH_SALT);
    const user = await prisma.user.update({
        where: { id: userId },
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
