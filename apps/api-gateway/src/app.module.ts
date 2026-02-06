import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { HealthModule } from './modules/health/health.module';
import { IdentityModule } from './modules/identity/identity.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { AuditModule } from './modules/audit/audit.module';
import { CorrelationMiddleware } from './middleware/correlation.middleware';
import { IdempotencyMiddleware } from './middleware/idempotency.middleware';
import { CustomersModule } from './modules/customers/customers.module';
import { KycModule } from './modules/kyc/kyc.module';
import { StoresModule } from './modules/stores/stores.module';
import { MerchantAccessModule } from './modules/merchant-access/merchant-access.module';
import { AgentAccessModule } from './modules/agent-access/agent-access.module';
import { PolicyModule } from './modules/policy/policy.module';
import { IamModule } from './modules/iam/iam.module';
import { SecurityModule } from './modules/security/security.module';
import { IdempotencyModule } from './modules/idempotency/idempotency.module';

@Module({
  imports: [
    HealthModule,
    IdentityModule,
    LedgerModule,
    AuditModule,
    CustomersModule,
    KycModule,
    StoresModule,
    MerchantAccessModule,
    AgentAccessModule,
    PolicyModule,
    IamModule,
    SecurityModule,
    IdempotencyModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationMiddleware).forRoutes('*');
    consumer.apply(IdempotencyMiddleware).forRoutes('*');
  }
}
