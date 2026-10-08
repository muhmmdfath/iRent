import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { AuthRequest, Public, Roles } from '../../auth/auth.guard';
import { InventoryService } from './inventory.service';
import {
  ActiveDto,
  ItemDto,
  ItemPatchDto,
  MaintenanceDto,
  PageDto,
  UnitsDto,
  ZoneDto,
} from './inventory.dto';

@Controller('items')
@Public()
export class CatalogController {
  constructor(private readonly inventory: InventoryService) {}
  @Get() list(@Query() query: PageDto) {
    return this.inventory.list(query);
  }
  @Get(':id') detail(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.inventory.detail(id);
  }
}
@Controller('delivery-zones')
@Public()
export class PublicZonesController {
  constructor(private readonly inventory: InventoryService) {}
  @Get() list() {
    return this.inventory.zones();
  }
}
@Controller('admin')
@Roles('admin')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}
  @Get('items') list(@Query() query: PageDto) {
    return this.inventory.list(query, true);
  }
  @Post('items') create(@Req() req: AuthRequest, @Body() dto: ItemDto) {
    return this.inventory.createItem(req.auth, dto);
  }
  @Patch('items/:id') update(
    @Req() req: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ItemPatchDto,
  ) {
    return this.inventory.updateItem(req.auth, id, dto);
  }
  @Get('items/:id/units') units(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() page: PageDto,
  ) {
    return this.inventory.units(id, page);
  }
  @Post('items/:id/units') add(
    @Req() req: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UnitsDto,
  ) {
    return this.inventory.addUnits(req.auth, id, dto);
  }
  @Patch('units/:id/active') active(
    @Req() req: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ActiveDto,
  ) {
    return this.inventory.active(req.auth, id, dto.isActive);
  }
  @Post('units/:id/maintenance') maintenance(
    @Req() req: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: MaintenanceDto,
  ) {
    return this.inventory.startMaintenance(req.auth, id, dto.reason);
  }
  @Post('units/:id/maintenance/complete') complete(
    @Req() req: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.inventory.finishMaintenance(req.auth, id);
  }
  @Post('units/:id/preparation/complete') prepared(
    @Req() req: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.inventory.finishPreparation(req.auth, id);
  }
  @Get('delivery-zones') zones() {
    return this.inventory.zones(true);
  }
  @Post('delivery-zones') zone(@Req() req: AuthRequest, @Body() dto: ZoneDto) {
    return this.inventory.saveZone(req.auth, dto);
  }
  @Put('delivery-zones/:id') updateZone(
    @Req() req: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ZoneDto,
  ) {
    return this.inventory.saveZone(req.auth, dto, id);
  }
}
