import { FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';
import { AuthUseCase } from '../../application/use-cases/AuthUseCase';
import { AuthLoginDto } from '../../application/dtos';

export class AuthController {
  constructor(private readonly authUseCase: AuthUseCase) {}
  private challengeStore = new Map<string, string>();

  private toFrontendUser(user: any) {
    return {
      id: user.id,
      publicKey: user.wallet_address,
      kycStatus: String(user.kyc_status || '').toLowerCase(),
    };
  }

  login = async (request: FastifyRequest, reply: FastifyReply) => {
    const data = AuthLoginDto.parse(request.body);
    const result = await this.authUseCase.login(data);
    return reply.status(200).send({
      token: result.token,
      user: this.toFrontendUser(result.user),
    });
  };

  challenge = async (request: FastifyRequest, reply: FastifyReply) => {
    const { publicKey } = request.body as { publicKey: string };
    const message = `predict-io-auth:${publicKey}:${randomUUID()}`;
    this.challengeStore.set(publicKey, message);
    console.log('[auth/challenge]', { publicKey, messageLength: message.length });
    return reply.status(200).send({ message });
  };

  verify = async (request: FastifyRequest, reply: FastifyReply) => {
    const { publicKey, signature } = request.body as {
      publicKey: string;
      signature: string;
    };
    const message = this.challengeStore.get(publicKey);
    if (!message) {
      console.log('[auth/verify] challenge not found', { publicKey });
      return reply.status(400).send({ error: 'Challenge not found or expired' });
    }

    console.log('[auth/verify] payload received', {
      publicKey,
      signaturePrefix: String(signature || '').slice(0, 16),
      signatureLength: String(signature || '').length,
      messageLength: message.length,
    });

    const result = await this.authUseCase.login({
      wallet_address: publicKey,
      signature,
      message,
    });
    this.challengeStore.delete(publicKey);

    return reply.status(200).send({
      token: result.token,
      user: this.toFrontendUser(result.user),
    });
  };
}
