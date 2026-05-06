import { FastifyReply, FastifyRequest } from 'fastify';
import { CreateResultDto, UpdateResultDto } from '../../application/dtos';
import { IResultRepository } from '../../application/ports';
import { NotFoundException } from '../../domain/exceptions';

export class ResultController {
  constructor(private readonly resultRepository: IResultRepository) {}

  createResult = async (request: FastifyRequest, reply: FastifyReply) => {
    const data = CreateResultDto.parse(request.body);
    const result = await this.resultRepository.create({
      name: data.name,
      market_id: data.market_id,
    });
    return reply.status(201).send(result);
  };

  listResults = async (request: FastifyRequest, reply: FastifyReply) => {
    const { market_id } = request.query as { market_id?: string };
    const results = await this.resultRepository.findAll({ market_id });
    return reply.status(200).send(results);
  };

  getResult = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const result = await this.resultRepository.findById(id);
    if (!result) {
      throw new NotFoundException('Result not found');
    }
    return reply.status(200).send(result);
  };

  updateResult = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const data = UpdateResultDto.parse(request.body);
    const existing = await this.resultRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('Result not found');
    }
    const result = await this.resultRepository.update(id, data);
    return reply.status(200).send(result);
  };

  deleteResult = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const existing = await this.resultRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('Result not found');
    }
    await this.resultRepository.delete(id);
    return reply.status(204).send();
  };
}
