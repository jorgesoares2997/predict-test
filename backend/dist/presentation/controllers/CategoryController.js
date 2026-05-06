"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoryController = void 0;
const dtos_1 = require("../../application/dtos");
class CategoryController {
    categoryUseCase;
    constructor(categoryUseCase) {
        this.categoryUseCase = categoryUseCase;
    }
    createCategory = async (request, reply) => {
        const data = dtos_1.CreateCategoryDto.parse(request.body);
        const category = await this.categoryUseCase.createCategory(data.name);
        return reply.status(201).send(category);
    };
    listCategories = async (_request, reply) => {
        const categories = await this.categoryUseCase.listCategories();
        return reply.status(200).send(categories);
    };
    getCategory = async (request, reply) => {
        const { id } = request.params;
        const category = await this.categoryUseCase.getCategoryById(id);
        return reply.status(200).send(category);
    };
    updateCategory = async (request, reply) => {
        const { id } = request.params;
        const data = dtos_1.UpdateCategoryDto.parse(request.body);
        const category = await this.categoryUseCase.updateCategory(id, data.name);
        return reply.status(200).send(category);
    };
    deleteCategory = async (request, reply) => {
        const { id } = request.params;
        await this.categoryUseCase.deleteCategory(id);
        return reply.status(204).send();
    };
}
exports.CategoryController = CategoryController;
