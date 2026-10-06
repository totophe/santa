import { Controller, Get } from '@nestjs/common';
import { MetaService, type PublicMeta } from './meta.service';

@Controller('meta')
export class MetaController {
  constructor(private readonly meta: MetaService) {}

  @Get()
  get(): PublicMeta {
    return this.meta.getPublicMeta();
  }
}
