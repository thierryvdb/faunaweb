import env from './config/env';
import { buildApp } from './app';

async function bootstrap() {
  const app = buildApp();
  try {
    await app.listen({ port: env.port, host: '0.0.0.0' });
    console.log(`API ouvindo na porta ${env.port}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

bootstrap();
