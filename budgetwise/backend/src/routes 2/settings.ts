import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { authRequired, type AuthedRequest } from "../middleware/authRequired.js";
import { deleteAccountSchema } from "../validators/authSchemas.js";

export const settingsRouter = Router();

settingsRouter.patch("/profile", authRequired, async (req: AuthedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { name, email } = req.body;

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        name,
        email,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    res.json({ user });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

/**
 * Permanently removes the authenticated user and all related rows (expenses,
 * budget category allocations, goals, password-reset requests). Category names
 * on expenses/budgets are stored as strings; deleting those rows removes them.
 */
settingsRouter.delete("/account", authRequired, async (req: AuthedRequest, res) => {
  try {
    const parsed = deleteAccountSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const userId = req.user!.id;
    const { password } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: "Incorrect password" });
    }

    await prisma.$transaction(async (tx) => {
      await tx.expense.deleteMany({ where: { userId } });
      await tx.budget.deleteMany({ where: { userId } });
      await tx.goal.deleteMany({ where: { userId } });
      await tx.resetPasswordRequest.deleteMany({ where: { userId } });
      await tx.user.delete({ where: { id: userId } });
    });

    res.status(204).send();
  } catch (error) {
    console.error("Delete account error:", error);
    res.status(500).json({ error: "Failed to delete account" });
  }
});