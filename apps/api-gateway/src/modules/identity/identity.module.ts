import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrincipalRepository } from './principal.repository';
import { TokenService } from './token.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, PrincipalRepository, TokenService],
  exports: [AuthService, TokenService],
})
export class IdentityModule {}
