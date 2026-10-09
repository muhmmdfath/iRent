import {
  Controller,
  Get,
  Module,
  Query,
  Req,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthModule } from '../../auth/auth.module';
import { AuthRequest, Roles } from '../../auth/auth.guard';
import { PrismaModule } from '../../prisma/prisma.module';
import { ReportDto } from './reports.dto';
import { ReportsService } from './reports.service';

@Controller('admin/reports')
@Roles('admin')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}
  @Get() read(@Req() req: AuthRequest, @Query() dto: ReportDto) {
    return this.reports.read(req.auth, dto);
  }
  @Get('excel') async excel(
    @Req() req: AuthRequest,
    @Query() dto: ReportDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.reports.excel(req.auth, dto);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="irent-${dto.kind}-${dto.period}.xlsx"`,
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(data);
  }
}
@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
