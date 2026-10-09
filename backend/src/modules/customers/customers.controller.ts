import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { AuthRequest, Roles } from '../../auth/auth.guard';
import { AuthService } from '../../auth/auth.service';
import { RegisterDto, ResetPasswordDto } from '../../auth/auth.dto';
import { ProfileDto } from './profile.dto';
import { CustomersService } from './customers.service';
import { AccountsDto } from './accounts.dto';

@Controller('customer/profile')
@Roles('customer')
export class ProfileController {
  constructor(private readonly customers: CustomersService) {}
  @Get() get(@Req() req: AuthRequest) {
    return this.customers.profile(req.auth);
  }
  @Put() save(@Req() req: AuthRequest, @Body() dto: ProfileDto) {
    return this.customers.saveProfile(req.auth, dto);
  }
}

@Controller('admin')
@Roles('admin')
export class AdminAccountsController {
  constructor(
    private readonly auth: AuthService,
    private readonly customers: CustomersService,
  ) {}
  @Get('accounts') accounts(
    @Req() req: AuthRequest,
    @Query() dto: AccountsDto,
  ) {
    return this.customers.list(req.auth, 'admin', dto);
  }
  @Get('customers') customersList(
    @Req() req: AuthRequest,
    @Query() dto: AccountsDto,
  ) {
    return this.customers.list(req.auth, 'customer', dto);
  }
  @Post('accounts')
  createAdmin(@Req() req: AuthRequest, @Body() dto: RegisterDto) {
    return this.auth.register(dto, req.auth);
  }
  @Get('customers/:id')
  detail(
    @Req() req: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.customers.adminDetail(req.auth, id);
  }
  @Post('customers/:id/password')
  @HttpCode(204)
  reset(
    @Req() req: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ResetPasswordDto,
  ) {
    return this.auth.resetCustomerPassword(req.auth, id, dto.password);
  }
}
