import { FastifyReply, FastifyRequest } from 'fastify';
import { CreateCategoryDto, UpdateCategoryDto } from '../../application/dtos';
import { CategoryUseCase } from '../../application/use-cases/CategoryUseCase';

export class CategoryController {
  constructor(private readonly categoryUseCase: CategoryUseCase) {}

  createCategory = async (request: FastifyRequest, reply: FastifyReply) => {
    const data = CreateCategoryDto.parse(request.body);
    const category = await this.categoryUseCase.createCategory(data.name);
    return reply.status(201).send(category);
  };

  listCategories = async (_request: FastifyRequest, reply: FastifyReply) => {
    const categories = await this.categoryUseCase.listCategories();
    return reply.status(200).send(categories);
  };

  getCategory = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const category = await this.categoryUseCase.getCategoryById(id);
    return reply.status(200).send(category);
  };

  updateCategory = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const data = UpdateCategoryDto.parse(request.body);
    const category = await this.categoryUseCase.updateCategory(id, data.name);
    return reply.status(200).send(category);
  };

  deleteCategory = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    await this.categoryUseCase.deleteCategory(id);
    return reply.status(204).send();
  };
}
