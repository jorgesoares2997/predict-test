import { Asset, Contract } from "@stellar/stellar-sdk";

const USDC_ISSUER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";

const usdcAsset = new Asset("USDC", USDC_ISSUER);
const sacAddress = usdcAsset.contractId("Public Global Stellar Network ; September 2015");

console.log("USDC SAC address (Mainnet):", sacAddress);