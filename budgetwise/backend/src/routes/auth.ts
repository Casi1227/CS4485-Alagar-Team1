import { Router, type Request } from "express";
import bcrypt from "bcryptjs";
import cryptoRandomString from "crypto-random-string";
import nodemailer from "nodemailer";
import { prisma } from "../lib/prisma.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../lib/jwt.js";
import {
    loginSchema,
    registerSchema,
    forgotPasswordSchema,
    refreshTokenSchema,
    resetPasswordSchema,
    RESET_PASSWORD_REQUEST_KEY_LENGTH
} from "../validators/authSchemas.js";
import { authRequired, type AuthedRequest, PASSWORD_HASH_SALT } from "../middleware/authRequired.js";
import { env } from "../config/env.js"

export const authRouter = Router();

/* 30 minutes. */
const RESET_PASSWORD_REQUEST_MAX_LIFESPAN_MS = 1_800_000;
const loginAttemptsByIp = new Map<string, number[]>();
const loginAttemptsByAccount = new Map<string, number[]>();

function pruneAttempts(attempts: number[], now: number) {
    const cutoff = now - env.AUTH_LOGIN_RATE_WINDOW_MS;
    while (attempts.length > 0 && attempts[0] < cutoff) attempts.shift();
}

function recordAttempt(bucket: Map<string, number[]>, key: string, now: number) {
    const attempts = bucket.get(key) ?? [];
    attempts.push(now);
    pruneAttempts(attempts, now);
    bucket.set(key, attempts);
    return attempts.length;
}

function getClientIp(req: Request) {
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.trim().length > 0) {
        return forwarded.split(",")[0]!.trim();
    }
    return req.ip ?? "unknown";
}

/**
 * R-101: Register/Login with email/password.
 * Passwords are stored as bcrypt hashes (never plaintext).
 */
authRouter.post("/register", async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({
        error: parsed.error.flatten(),
    });

    const { email, password, name } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: "Email already in use" });

    const passwordHash = await bcrypt.hash(password, PASSWORD_HASH_SALT);

    const user = await prisma.user.create({
        data: { email, passwordHash, name },
    });

    const token = signAccessToken({ sub: user.id, email: user.email });
    const refreshToken = signRefreshToken({
        sub: user.id,
        email: user.email,
    });

    res.status(201).json({
        token,
        refreshToken,
        user: { id: user.id, email: user.email, name: user.name },
    });
});

authRouter.post("/login", async (req, res) => {
    const startedAt = Date.now();
    const ip = getClientIp(req);
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }

    const { email, password } = parsed.data;

    const normalizedEmail = email.trim().toLowerCase();
    const now = Date.now();
    const ipAttempts = recordAttempt(loginAttemptsByIp, ip, now);
    const accountAttempts = recordAttempt(
        loginAttemptsByAccount, normalizedEmail, now,
    );
    if (ipAttempts > env.AUTH_LOGIN_RATE_LIMIT_PER_IP
            || accountAttempts > env.AUTH_LOGIN_RATE_LIMIT_PER_ACCOUNT) {
        console.warn(
            JSON.stringify({
                type: "auth_login_rate_limited",
                ip,
                email: normalizedEmail,
                ipAttempts,
                accountAttempts,
                windowMs: env.AUTH_LOGIN_RATE_WINDOW_MS,
            }),
        );
        return res.status(429).json({
            error: "Too many login attempts. Please try again shortly.",
        });
    }

    const user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
    });
    if (!user) {
        const latencyMs = Date.now() - startedAt;
        console.log(
            JSON.stringify({
                type: "auth_login_result",
                status: 401,
                reason: "user_not_found",
                ip,
                email: normalizedEmail,
                latencyMs,
            }),
        );
        return res.status(401).json({ error: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
        const latencyMs = Date.now() - startedAt;
        console.log(
            JSON.stringify({
                type: "auth_login_result",
                status: 401,
                reason: "bad_password",
                ip,
                email: normalizedEmail,
                latencyMs,
            }),
        );
        return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = signAccessToken({ sub: user.id, email: user.email });
    const refreshToken = signRefreshToken({ sub: user.id, email: user.email });
    const latencyMs = Date.now() - startedAt;
    console.log(
        JSON.stringify({
            type: "auth_login_result",
            status: 200,
            ip,
            email: normalizedEmail,
            latencyMs,
        }),
    );

    res.json({
        token,
        refreshToken,
        user: { id: user.id, email: user.email, name: user.name },
    });
});

authRouter.post("/refresh", async (req, res) => {
    const parsed = refreshTokenSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }

    try {
        const payload = verifyRefreshToken(parsed.data.refreshToken);
        if (payload.type !== "refresh") {
            return res.status(401).json({ error: "Invalid refresh token" });
        }

        const user = await prisma.user.findUnique({
            where: { id: payload.sub },
            select: { id: true, email: true, name: true },
        });
        if (!user) {
            return res.status(401).json({ error: "Invalid refresh token" });
        }

        const token = signAccessToken({ sub: user.id, email: user.email });
        const refreshToken = signRefreshToken({
            sub: user.id, email: user.email,
        });
        return res.json({ token, refreshToken, user });
    } catch {
        return res.status(401).json({ error: "Invalid refresh token" });
    }
});

authRouter.post("/forgot-password", async (req, res) => {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }

    const { email } = parsed.data;

    const user = await prisma.user.findUnique({where: { email }});
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

    const mailTransport = nodemailer.createTransport(env.MAIL_SERVER_URL);

    const resetPasswordUrl = new URL(
        "/reset-password", env.FRONTEND_SERVER_ORIGIN,
    );
    resetPasswordUrl.searchParams.set("email", user.email);
    resetPasswordUrl.searchParams.set("key", key);

    const resetPasswordEmailMessage = {
        from: {
            name: env.MAIL_SERVER_MBOX_NO_REPLY_DISPLAY_NAME,
            address: env.MAIL_SERVER_MBOX_NO_REPLY_LOCAL_PART
                + '@'
                + env.MAIL_SERVER_DOMAIN,
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
    //    `Reset-password email message: ${
    //        JSON.stringify(resetPasswordEmailMessage, null, 4)
    //    }`,
    //);

    try {
        await mailTransport.sendMail(resetPasswordEmailMessage);
    } catch (err) {
        //console.error(err);
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
    const resetPasswordRequest =
        await prisma.resetPasswordRequest.findUnique({
            where: { userId },
        });
    if (
        !resetPasswordRequest
        || !await bcrypt.compare(key, resetPasswordRequest.keyHash)
        || Number(now) - Number(resetPasswordRequest.createdAt)
            > RESET_PASSWORD_REQUEST_MAX_LIFESPAN_MS
    ) {
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
authRouter.get("/me", authRequired, async (req: AuthedRequest, res) => {
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true, createdAt: true },
    });

    res.json({ user });
});
