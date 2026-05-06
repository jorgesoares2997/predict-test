import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { UnauthorizedException } from '../../domain/exceptions';

export const authMiddleware = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid token');
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
    
    // Attach user payload to request
    (request as any).user = decoded;
  } catch (error) {
    throw new UnauthorizedException('Invalid or expired token');
  }
};
