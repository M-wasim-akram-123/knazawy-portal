import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { BillsModule } from './bills/bills.module';
import { HealthModule } from './health/health.module';
import { ItemsModule } from './items/items.module';
import { LocationsModule } from './locations/locations.module';
import { MealCostsModule } from './meal-costs/meal-costs.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductionModule } from './production/production.module';
import { PurchasesModule } from './purchases/purchases.module';
import { ReceiptsModule } from './receipts/receipts.module';
import { RecipesModule } from './recipes/recipes.module';
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
    HealthModule,
    ItemsModule,
    SuppliersModule,
    LocationsModule,
    PurchasesModule,
    ReceiptsModule,
    BillsModule,
    RecipesModule,
    ProductionModule,
    MealCostsModule,
    StockModule,
  ],
})
export class AppModule {}
