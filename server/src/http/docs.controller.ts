import { Controller, Get, Header } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as yaml from 'js-yaml';

@Controller()
export class DocsController {
  @Get('openapi.json')
  @Header('content-type', 'application/json')
  openapi() {
    const p = process.env.OPENAPI_PATH ?? join(process.cwd(), 'openapi/radar.yaml');
    return yaml.load(readFileSync(p, 'utf8'));
  }

  @Get('docs')
  @Header('content-type', 'text/html; charset=utf-8')
  docs() {
    return `<!doctype html><html><head><meta charset="utf-8"><title>Security radar</title></head><body><h1>FederationCoin security radar</h1><p>OpenAPI at <a href="/v1/openapi.json">/v1/openapi.json</a>. Dummy MAIN is not live. Health is not a public page.</p></body></html>`;
  }
}
