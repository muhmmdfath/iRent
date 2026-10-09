import { Controller, Get, Injectable, Module } from '@nestjs/common';
import { OpenAPIObject } from '@nestjs/swagger';
import { Roles } from '../../auth/auth.guard';
@Injectable()
export class ApiDocsService {
  document!: OpenAPIObject;
}
@Controller('admin/api-docs')
@Roles('admin')
class ApiDocsController {
  constructor(private readonly docs: ApiDocsService) {}
  @Get() read() {
    return this.docs.document;
  }
}
@Module({
  controllers: [ApiDocsController],
  providers: [ApiDocsService],
  exports: [ApiDocsService],
})
export class ApiDocsModule {}
