import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { AuditModule } from './modules/audit/audit.module';
import { ConfigModule } from './modules/config/config.module';
import { HealthModule } from './modules/health/health.module';
import { StaffAuthMiddleware } from './middleware/staff-auth.middleware';
import { AgentsModule } from './modules/agents/agents.module';

@Module({
  imports: [HealthModule, AuditModule, ConfigModule, AgentsModule],
})
export class AdminModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(StaffAuthMiddleware).exclude('(.*)/health').forRoutes('*');
  }
}
