"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserController = void 0;
const dtos_1 = require("../../application/dtos");
const exceptions_1 = require("../../domain/exceptions");
class UserController {
    userRepository;
    constructor(userRepository) {
        this.userRepository = userRepository;
    }
    toFrontendUser(user) {
        return {
            id: user.id,
            publicKey: user.wallet_address,
            kycStatus: String(user.kyc_status || '').toLowerCase(),
            diditId: user.didit_id,
            createdAt: user.created_at,
        };
    }
    createUser = async (request, reply) => {
        const data = dtos_1.CreateUserDto.parse(request.body);
        const user = await this.userRepository.create({ wallet_address: data.wallet_address });
        if (data.kyc_status || data.didit_id) {
            const updated = await this.userRepository.update(user.id, {
                kyc_status: data.kyc_status,
                didit_id: data.didit_id,
            });
            return reply.status(201).send(this.toFrontendUser(updated));
        }
        return reply.status(201).send(this.toFrontendUser(user));
    };
    listUsers = async (_request, reply) => {
        const users = await this.userRepository.findAll();
        return reply.status(200).send(users.map((u) => this.toFrontendUser(u)));
    };
    getUser = async (request, reply) => {
        const { id } = request.params;
        const user = await this.userRepository.findById(id);
        if (!user) {
            throw new exceptions_1.NotFoundException('User not found');
        }
        return reply.status(200).send(this.toFrontendUser(user));
    };
    updateUser = async (request, reply) => {
        const { id } = request.params;
        const data = dtos_1.UpdateUserDto.parse(request.body);
        const existing = await this.userRepository.findById(id);
        if (!existing) {
            throw new exceptions_1.NotFoundException('User not found');
        }
        const user = await this.userRepository.update(id, data);
        return reply.status(200).send(this.toFrontendUser(user));
    };
    deleteUser = async (request, reply) => {
        const { id } = request.params;
        const existing = await this.userRepository.findById(id);
        if (!existing) {
            throw new exceptions_1.NotFoundException('User not found');
        }
        await this.userRepository.delete(id);
        return reply.status(204).send();
    };
}
exports.UserController = UserController;
