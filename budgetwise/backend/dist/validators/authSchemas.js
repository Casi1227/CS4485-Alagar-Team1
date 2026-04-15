import { z } from "zod";
const PASSWORD_MIN_LENGTH = 8;
export const RESET_PASSWORD_REQUEST_KEY_LENGTH = 0x100;
export const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(PASSWORD_MIN_LENGTH),
    name: z.string().min(1),
});
export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(PASSWORD_MIN_LENGTH),
});
export const forgotPasswordSchema = z.object({
    email: z.string().email(),
});
export const resetPasswordSchema = z.object({
    email: z.string().email(),
    key: z.string().length(RESET_PASSWORD_REQUEST_KEY_LENGTH),
    password: z.string().min(PASSWORD_MIN_LENGTH),
});
export const updateProfileSchema = z.object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
});
export const updatePasswordSchema = z.object({
    currentPassword: z.string().min(PASSWORD_MIN_LENGTH),
    newPassword: z.string().min(PASSWORD_MIN_LENGTH),
});
export const deleteAccountSchema = z.object({
    password: z.string().min(PASSWORD_MIN_LENGTH),
});
