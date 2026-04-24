import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WsException } from '@nestjs/websockets';
import * as jwt from 'jsonwebtoken';
import { Socket } from 'socket.io';

@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const client: Socket = context.switchToWs().getClient();
    const token = this.extractToken(client);

    if (!token) throw new WsException('Token no proporcionado');

    try {
      const secret = this.configService.get<string>('jwt.accessSecret');
      const decoded = jwt.verify(token, secret!) as any;

      // loggueo_service emite "sub" como email; normalizar a userId
      const userEmail = decoded.sub ?? decoded.user_id;
      if (!userEmail) throw new WsException('Token sin identificador de usuario');

      client.data.user = { email: userEmail, role: decoded.role };
      return true;
    } catch (err) {
      if (err instanceof WsException) throw err;
      this.logger.warn(`Token WS inválido: ${(err as Error).message}`);
      throw new WsException('Token inválido');
    }
  }

  private extractToken(client: Socket): string | undefined {
    // 1. handshake.auth.token
    const auth = client.handshake.auth as { token?: string } | undefined;
    if (auth?.token) return auth.token;

    // 2. Authorization header
    const authHeader = client.handshake.headers?.authorization;
    if (authHeader?.startsWith('Bearer ')) return authHeader.substring(7);

    // 3. Cookie access_token
    const cookie = client.handshake.headers?.cookie;
    if (cookie) {
      const match = cookie.split(';').find(c => c.trim().startsWith('access_token='));
      if (match) return match.split('=')[1]?.trim();
    }

    return undefined;
  }
}
