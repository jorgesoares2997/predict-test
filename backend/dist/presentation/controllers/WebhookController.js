"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookController = void 0;
const dtos_1 = require("../../application/dtos");
class WebhookController {
    userRepository;
    constructor(userRepository) {
        this.userRepository = userRepository;
    }
    diditWebhook = async (request, reply) => {
        // Basic verification of webhook signature/token would go here.
        // For now we assume the request is validated by API Gateway or similar.
        const data = dtos_1.DiditWebhookDto.parse(request.body);
        const user = await this.userRepository.findByWalletAddress(data.wallet_address);
        if (!user) {
            return reply.status(404).send({ error: 'User not found' });
        }
        await this.userRepository.updateKycStatus(user.id, data.status, data.didit_id);
        return reply.status(200).send({ message: 'KYC status updated' });
    };
}
exports.WebhookController = WebhookController;
