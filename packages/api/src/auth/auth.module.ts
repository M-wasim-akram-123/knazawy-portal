import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { jwtSecret } from './jwt-secret';
import { LoginThrottle } from './login-throttle';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: jwtSecret(config.get<string>('JWT_ACCESS_SECRET'), config.get<string>('NODE_ENV')),
        signOptions: { expiresIn: '30m' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, LoginThrottle],
  exports: [JwtModule, JwtAuthGuard],
})
export class AuthModule {}
