import { FastifyRequest, FastifyReply } from 'fastify';
import { IUserRepository } from '../../application/ports';
import { DiditWebhookDto } from '../../application/dtos';

export class WebhookController {
  constructor(private readonly userRepository: IUserRepository) {}

  diditWebhook = async (request: FastifyRequest, reply: FastifyReply) => {
    // Basic verification of webhook signature/token would go here.
    // For now we assume the request is validated by API Gateway or similar.
    
    const data = DiditWebhookDto.parse(request.body);
    
    const user = await this.userRepository.findByWalletAddress(data.wallet_address);
    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    await this.userRepository.updateKycStatus(user.id, data.status, data.didit_id);
    
    return reply.status(200).send({ message: 'KYC status updated' });
  };
}
