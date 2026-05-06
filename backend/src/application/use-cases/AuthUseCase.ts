import { IStellarService, IUserRepository } from '../ports';
import { AuthLoginDtoType } from '../dtos';
import { UnauthorizedException } from '../../domain/exceptions';
import jwt from 'jsonwebtoken';

export class AuthUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly stellarService: IStellarService,
    private readonly jwtSecret: string
  ) {}

  async login(data: AuthLoginDtoType): Promise<{ token: string; user: any }> {
    const isValid = this.stellarService.verifySignature(
      data.wallet_address,
      data.signature,
      data.message
    );

    if (!isValid) {
      throw new UnauthorizedException('Invalid signature');
    }

    let user = await this.userRepository.findByWalletAddress(data.wallet_address);
    if (!user) {
      user = await this.userRepository.create({ wallet_address: data.wallet_address });
    }

    const token = jwt.sign(
      { sub: user.id, wallet_address: user.wallet_address, kyc_status: user.kyc_status },
      this.jwtSecret,
      { expiresIn: '24h' }
    );

    return { token, user };
  }
}
