import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
export function signAccessToken(payload) {
    // Cast keeps runtime behavior the same while satisfying jsonwebtoken's strict union type.
    const expiresIn = env.JWT_EXPIRES_IN;
    return jwt.sign(payload, env.JWT_SECRET, { expiresIn });
}
export function verifyAccessToken(token) {
    return jwt.verify(token, env.JWT_SECRET);
}
