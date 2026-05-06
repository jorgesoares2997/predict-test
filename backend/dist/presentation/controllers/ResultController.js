"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResultController = void 0;
const dtos_1 = require("../../application/dtos");
const exceptions_1 = require("../../domain/exceptions");
class ResultController {
    resultRepository;
    constructor(resultRepository) {
        this.resultRepository = resultRepository;
    }
    createResult = async (request, reply) => {
        const data = dtos_1.CreateResultDto.parse(request.body);
        const result = await this.resultRepository.create({
            name: data.name,
            market_id: data.market_id,
        });
        return reply.status(201).send(result);
    };
    listResults = async (request, reply) => {
        const { market_id } = request.query;
        const results = await this.resultRepository.findAll({ market_id });
        return reply.status(200).send(results);
    };
    getResult = async (request, reply) => {
        const { id } = request.params;
        const result = await this.resultRepository.findById(id);
        if (!result) {
            throw new exceptions_1.NotFoundException('Result not found');
        }
        return reply.status(200).send(result);
    };
    updateResult = async (request, reply) => {
        const { id } = request.params;
        const data = dtos_1.UpdateResultDto.parse(request.body);
        const existing = await this.resultRepository.findById(id);
        if (!existing) {
            throw new exceptions_1.NotFoundException('Result not found');
        }
        const result = await this.resultRepository.update(id, data);
        return reply.status(200).send(result);
    };
    deleteResult = async (request, reply) => {
        const { id } = request.params;
        const existing = await this.resultRepository.findById(id);
        if (!existing) {
            throw new exceptions_1.NotFoundException('Result not found');
        }
        await this.resultRepository.delete(id);
        return reply.status(204).send();
    };
}
exports.ResultController = ResultController;
