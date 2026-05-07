import { FastifyReply, FastifyRequest } from 'fastify';
import { CreateUserDto, UpdateUserDto } from '../../application/dtos';
import { IUserRepository } from '../../application/ports';
import { NotFoundException } from '../../domain/exceptions';

export class UserController {
  constructor(private readonly userRepository: IUserRepository) {}

  private toFrontendUser(user: any) {
    return {
      id: user.id,
      publicKey: user.wallet_address,
      name: user.name ?? null,
      email: user.email ?? null,
      kycStatus: String(user.kyc_status || '').toLowerCase(),
      diditId: user.didit_id,
      createdAt: user.created_at,
    };
  }

  createUser = async (request: FastifyRequest, reply: FastifyReply) => {
    const data = CreateUserDto.parse(request.body);
    const user = await this.userRepository.create({
      wallet_address: data.wallet_address,
      name: data.name ?? null,
      email: data.email ?? null,
    });
    if (data.kyc_status || data.didit_id || data.name !== undefined || data.email !== undefined) {
      const updated = await this.userRepository.update(user.id, {
        name: data.name,
        email: data.email,
        kyc_status: data.kyc_status,
        didit_id: data.didit_id,
      });
      return reply.status(201).send(this.toFrontendUser(updated));
    }
    return reply.status(201).send(this.toFrontendUser(user));
  };

  listUsers = async (_request: FastifyRequest, reply: FastifyReply) => {
    const users = await this.userRepository.findAll();
    return reply.status(200).send(users.map((u) => this.toFrontendUser(u)));
  };

  getUser = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return reply.status(200).send(this.toFrontendUser(user));
  };

  updateUser = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const data = UpdateUserDto.parse(request.body);
    const existing = await this.userRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('User not found');
    }
    const user = await this.userRepository.update(id, data);
    return reply.status(200).send(this.toFrontendUser(user));
  };

  deleteUser = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const existing = await this.userRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('User not found');
    }
    await this.userRepository.delete(id);
    return reply.status(204).send();
  };
}
