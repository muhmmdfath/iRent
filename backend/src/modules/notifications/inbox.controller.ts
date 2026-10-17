import {
  Controller,
  Get,
  Post,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  Header,
} from '@nestjs/common';
import { AuthRequest } from '../../auth/auth.guard';
import { PageDto } from '../inventory/inventory.dto';
import { InboxService } from './inbox.service';
@Controller('notifications')
export class InboxController {
  constructor(private readonly inbox: InboxService) {}
  @Get() @Header('Cache-Control', 'no-store') list(
    @Req() req: AuthRequest,
    @Query() page: PageDto,
  ) {
    return this.inbox.list(req.auth, page);
  }
  @Post('read-all') readAll(@Req() req: AuthRequest) {
    return this.inbox.read(req.auth);
  }
  @Post(':id/read') read(
    @Req() req: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.inbox.read(req.auth, id);
  }
}
