"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const crypto_1 = require("crypto");
const dtos_1 = require("../../application/dtos");
class AuthController {
    authUseCase;
    constructor(authUseCase) {
        this.authUseCase = authUseCase;
    }
    challengeStore = new Map();
    toFrontendUser(user) {
        return {
            id: user.id,
            publicKey: user.wallet_address,
            kycStatus: String(user.kyc_status || '').toLowerCase(),
        };
    }
    login = async (request, reply) => {
        const data = dtos_1.AuthLoginDto.parse(request.body);
        const result = await this.authUseCase.login(data);
        return reply.status(200).send({
            token: result.token,
            user: this.toFrontendUser(result.user),
        });
    };
    challenge = async (request, reply) => {
        const { publicKey } = request.body;
        const message = `predict-io-auth:${publicKey}:${(0, crypto_1.randomUUID)()}`;
        this.challengeStore.set(publicKey, message);
        console.log('[auth/challenge]', { publicKey, messageLength: message.length });
        return reply.status(200).send({ message });
    };
    verify = async (request, reply) => {
        const { publicKey, signature } = request.body;
        const message = this.challengeStore.get(publicKey);
        if (!message) {
            console.log('[auth/verify] challenge not found', { publicKey });
            return reply.status(400).send({ error: 'Challenge not found or expired' });
        }
        console.log('[auth/verify] payload received', {
            publicKey,
            signaturePrefix: String(signature || '').slice(0, 16),
            signatureLength: String(signature || '').length,
            messageLength: message.length,
        });
        const result = await this.authUseCase.login({
            wallet_address: publicKey,
            signature,
            message,
        });
        this.challengeStore.delete(publicKey);
        return reply.status(200).send({
            token: result.token,
            user: this.toFrontendUser(result.user),
        });
    };
}
exports.AuthController = AuthController;
