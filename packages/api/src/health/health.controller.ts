import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  getHealth(): { status: 'ok'; service: 'knazawy-api' } {
    return { status: 'ok', service: 'knazawy-api' };
  }
}
