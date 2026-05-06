"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoryUseCase = void 0;
const exceptions_1 = require("../../domain/exceptions");
class CategoryUseCase {
    categoryRepository;
    constructor(categoryRepository) {
        this.categoryRepository = categoryRepository;
    }
    async createCategory(name) {
        const existing = await this.categoryRepository.findByName(name);
        if (existing) {
            throw new exceptions_1.DomainException('Category already exists', 409);
        }
        return this.categoryRepository.create({ name });
    }
    async listCategories() {
        return this.categoryRepository.findAll();
    }
    async getCategoryById(id) {
        const category = await this.categoryRepository.findById(id);
        if (!category) {
            throw new exceptions_1.NotFoundException('Category not found');
        }
        return category;
    }
    async updateCategory(id, name) {
        const existing = await this.categoryRepository.findById(id);
        if (!existing) {
            throw new exceptions_1.NotFoundException('Category not found');
        }
        if (name && name !== existing.name) {
            const duplicate = await this.categoryRepository.findByName(name);
            if (duplicate) {
                throw new exceptions_1.DomainException('Category already exists', 409);
            }
        }
        return this.categoryRepository.update(id, { name });
    }
    async deleteCategory(id) {
        const existing = await this.categoryRepository.findById(id);
        if (!existing) {
            throw new exceptions_1.NotFoundException('Category not found');
        }
        return this.categoryRepository.delete(id);
    }
}
exports.CategoryUseCase = CategoryUseCase;
