"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const exceptions_1 = require("../../domain/exceptions");
const authMiddleware = async (request, reply) => {
    try {
        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new exceptions_1.UnauthorizedException('Missing or invalid token');
        }
        const token = authHeader.split(' ')[1];
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        // Attach user payload to request
        request.user = decoded;
    }
    catch (error) {
        throw new exceptions_1.UnauthorizedException('Invalid or expired token');
    }
};
exports.authMiddleware = authMiddleware;
