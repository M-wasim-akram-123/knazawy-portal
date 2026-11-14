import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { AirlinesController } from './airlines.controller';
import { AirlinesService } from './airlines.service';

@Module({
  imports: [AuthModule],
  controllers: [AirlinesController],
  providers: [AirlinesService],
})
export class AirlinesModule {}
