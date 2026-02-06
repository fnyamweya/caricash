import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { AuditModule } from './modules/audit/audit.module';
import { ConfigModule } from './modules/config/config.module';
import { HealthModule } from './modules/health/health.module';
import { StaffAuthMiddleware } from './middleware/staff-auth.middleware';

@Module({
  imports: [HealthModule, AuditModule, ConfigModule],
})
export class AdminModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(StaffAuthMiddleware).exclude('(.*)/health').forRoutes('*');
  }
}
