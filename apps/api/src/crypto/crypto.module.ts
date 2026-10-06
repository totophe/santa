import { Global, Module } from '@nestjs/common';
import { CONFIG, type AppConfig } from '../config/env';
import { CryptoService } from './crypto.service';

@Global()
@Module({
  providers: [
    {
      provide: CryptoService,
      inject: [CONFIG],
      useFactory: (config: AppConfig) =>
        CryptoService.fromBase64(config.encryptionKey),
    },
  ],
  exports: [CryptoService],
})
export class CryptoModule {}
