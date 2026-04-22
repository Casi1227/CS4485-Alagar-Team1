import { Configuration, CountryCode, PlaidApi, PlaidEnvironments, Products } from "plaid";
import { env } from "../config/env.js";
function parseCsv(value) {
    return value
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
}
export function getPlaidProducts() {
    const configured = parseCsv(env.PLAID_PRODUCTS).map((p) => p.toLowerCase());
    const products = configured.map((p) => p);
    return products.length > 0 ? products : [Products.Transactions];
}
export function getPlaidCountryCodes() {
    const configured = parseCsv(env.PLAID_COUNTRY_CODES).map((c) => c.toUpperCase());
    const countries = configured.map((c) => c);
    return countries.length > 0 ? countries : [CountryCode.Us];
}
const configuration = new Configuration({
    basePath: PlaidEnvironments[env.PLAID_ENV],
    baseOptions: {
        headers: {
            "PLAID-CLIENT-ID": env.PLAID_CLIENT_ID,
            "PLAID-SECRET": env.PLAID_SECRET,
            "Plaid-Version": "2020-09-14",
        },
    },
});
export const plaidClient = new PlaidApi(configuration);
