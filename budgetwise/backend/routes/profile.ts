import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../src/db.js";
import { authRequired, type AuthedRequest } from "../middleware/authRequired.js";
import { updatePasswordSchema, updateProfileSchema } from "../validators/authSchemas.js";

export const profileRouter = Router();

/**
 * R-103: View profile and update security credentials.
 */
profileRouter.get("/me", authRequired, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, createdAt: true } });
  res.json({ user });
});

profileRouter.put("/me", authRequired, async (req: AuthedRequest, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const userId = req.user!.id;
  const updated = await prisma.user.update({
    where: { id: userId },
    data: parsed.data,
    select: { id: true, email: true, name: true, createdAt: true },
  });
  res.json({ user: updated });
});

profileRouter.put("/me/password", authRequired, async (req: AuthedRequest, res) => {
  const parsed = updatePasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const userId = req.user!.id;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ error: "User not found" });

  const ok = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Current password is incorrect" });

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  res.json({ ok: true });
});

/**
 * R-104: Cascading delete of all user data.
 * Prisma relations are configured with onDelete: Cascade.
 */
profileRouter.delete("/me", authRequired, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  await prisma.user.delete({ where: { id: userId } });
  res.json({ ok: true });
});
