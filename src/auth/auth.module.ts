import { Module } from '@nestjs/common';
import { WsJwtGuard } from './ws-jwt.guard';

@Module({
  providers: [WsJwtGuard],
  exports: [WsJwtGuard],
})
export class AuthModule {}
