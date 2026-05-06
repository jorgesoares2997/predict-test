"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthUseCase = void 0;
const exceptions_1 = require("../../domain/exceptions");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
class AuthUseCase {
    userRepository;
    stellarService;
    jwtSecret;
    constructor(userRepository, stellarService, jwtSecret) {
        this.userRepository = userRepository;
        this.stellarService = stellarService;
        this.jwtSecret = jwtSecret;
    }
    async login(data) {
        const isValid = this.stellarService.verifySignature(data.wallet_address, data.signature, data.message);
        if (!isValid) {
            throw new exceptions_1.UnauthorizedException('Invalid signature');
        }
        let user = await this.userRepository.findByWalletAddress(data.wallet_address);
        if (!user) {
            user = await this.userRepository.create({ wallet_address: data.wallet_address });
        }
        const token = jsonwebtoken_1.default.sign({ sub: user.id, wallet_address: user.wallet_address, kyc_status: user.kyc_status }, this.jwtSecret, { expiresIn: '24h' });
        return { token, user };
    }
}
exports.AuthUseCase = AuthUseCase;
