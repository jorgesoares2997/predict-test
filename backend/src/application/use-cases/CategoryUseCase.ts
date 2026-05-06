import { ICategoryRepository } from '../ports';
import { DomainException, NotFoundException } from '../../domain/exceptions';

export class CategoryUseCase {
  constructor(private readonly categoryRepository: ICategoryRepository) {}

  async createCategory(name: string) {
    const existing = await this.categoryRepository.findByName(name);
    if (existing) {
      throw new DomainException('Category already exists', 409);
    }
    return this.categoryRepository.create({ name });
  }

  async listCategories() {
    return this.categoryRepository.findAll();
  }

  async getCategoryById(id: string) {
    const category = await this.categoryRepository.findById(id);
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  async updateCategory(id: string, name?: string) {
    const existing = await this.categoryRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('Category not found');
    }
    if (name && name !== existing.name) {
      const duplicate = await this.categoryRepository.findByName(name);
      if (duplicate) {
        throw new DomainException('Category already exists', 409);
      }
    }
    return this.categoryRepository.update(id, { name });
  }

  async deleteCategory(id: string) {
    const existing = await this.categoryRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('Category not found');
    }
    await this.categoryRepository.detachMarkets(id);
    return this.categoryRepository.delete(id);
  }
}
