import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserRepository } from './user.repository';
import { TokenService } from './token.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, UserRepository, TokenService],
  exports: [AuthService, TokenService],
})
export class IdentityModule {}
