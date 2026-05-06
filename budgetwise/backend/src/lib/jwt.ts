import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export type JwtPayload = {
    sub: string;
    email: string;
};
export type RefreshJwtPayload = {
    sub: string;
    email: string;
    type: "refresh";
};

export function signAccessToken(payload: JwtPayload) {
    /* Cast keeps runtime behavior the same
     * while satisfying jsonwebtoken's strict union type. */
    const expiresIn = env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"];
    return jwt.sign(payload, env.JWT_SECRET, { expiresIn });
}

export function verifyAccessToken(token: string) {
    return jwt.verify(token, env.JWT_SECRET) as
        JwtPayload & { iat: number; exp: number };
}

export function signRefreshToken(payload: JwtPayload) {
    const expiresIn = env.JWT_REFRESH_EXPIRES_IN as
        jwt.SignOptions["expiresIn"];
    return jwt.sign({ ...payload, type: "refresh" } satisfies
        RefreshJwtPayload, env.JWT_REFRESH_SECRET, { expiresIn });
}

export function verifyRefreshToken(token: string) {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as
        RefreshJwtPayload & { iat: number; exp: number };
}
