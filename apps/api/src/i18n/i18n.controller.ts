import { Controller, Get, Param } from '@nestjs/common';
import { I18nService } from './i18n.service';

/** Serves app locale strings to the web client (English-fallback merged). */
@Controller('i18n')
export class I18nController {
  constructor(private readonly i18n: I18nService) {}

  @Get(':lang')
  get(@Param('lang') lang: string): { lang: string; messages: Record<string, string> } {
    return { lang: this.i18n.normalize(lang), messages: this.i18n.getMessages(lang) };
  }
}
