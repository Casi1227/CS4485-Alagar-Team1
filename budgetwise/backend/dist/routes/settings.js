import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authRequired } from "../middleware/authRequired.js";
export const settingsRouter = Router();
settingsRouter.patch("/profile", authRequired, async (req, res) => {
    try {
        const userId = req.user.id;
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
    }
    catch (error) {
        console.error("Profile update error:", error);
        res.status(500).json({ error: "Failed to update profile" });
    }
});
