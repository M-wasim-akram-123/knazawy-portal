import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AirlinesModule } from './airlines/airlines.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { BillsModule } from './bills/bills.module';
import { DeliveriesModule } from './deliveries/deliveries.module';
import { HealthModule } from './health/health.module';
import { InvoicesModule } from './invoices/invoices.module';
import { ItemsModule } from './items/items.module';
import { LedgerModule } from './ledger/ledger.module';
import { LocationsModule } from './locations/locations.module';
import { MealCostsModule } from './meal-costs/meal-costs.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductionModule } from './production/production.module';
import { PurchasesModule } from './purchases/purchases.module';
import { RateCardsModule } from './rate-cards/rate-cards.module';
import { ReceiptsModule } from './receipts/receipts.module';
import { RecipesModule } from './recipes/recipes.module';
import { RequestsModule } from './requests/requests.module';
import { StockModule } from './stock/stock.module';
import { SuppliersModule } from './suppliers/suppliers.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    PrismaModule,
    AuditModule,
    AuthModule,
    AirlinesModule,
    HealthModule,
    InvoicesModule,
    LedgerModule,
    ItemsModule,
    SuppliersModule,
    LocationsModule,
    PurchasesModule,
    ReceiptsModule,
    BillsModule,
    DeliveriesModule,
    RecipesModule,
    ProductionModule,
    MealCostsModule,
    RequestsModule,
    RateCardsModule,
    StockModule,
  ],
})
export class AppModule {}
