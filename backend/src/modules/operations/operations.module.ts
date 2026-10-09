import {
  Body,
  Controller,
  Headers,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { AuthRequest, Roles } from '../../auth/auth.guard';
import { AuthModule } from '../../auth/auth.module';
import { PaymentsModule } from '../payments/payments.module';
import { RejectProofDto } from '../payments/payments.dto';
import { PricingModule } from '../pricing/pricing.module';
import {
  CorrectReturnDto,
  HandoverDto,
  VerifyReturnDto,
} from './operations.dto';
import { OperationsService } from './operations.service';
import { ExtensionDelayService } from '../extensions/extension-delay.service';
import { RisksModule } from '../risks/risks.module';
import { ReplaceUnitDto, VerifyLossDto } from './loss.dto';

@Controller('bookings')
@Roles('customer')
export class CustomerReturnsController {
  constructor(private readonly operations: OperationsService) {}
  @Post(':id/items/:itemId/return-report') report(
    @Req() req: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('itemId', new ParseUUIDPipe()) itemId: string,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.operations.report(req.auth, id, itemId, key);
  }
}
@Controller('admin/bookings')
@Roles('admin')
export class AdminOperationsController {
  constructor(private readonly operations: OperationsService) {}
  @Post(':id/items/:itemId/return/correct') correctReturn(
    @Req() req: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('itemId', new ParseUUIDPipe()) itemId: string,
    @Body() input: CorrectReturnDto,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.operations.correctReturn(req.auth, id, itemId, input, key);
  }
  @Post(':id/items/:itemId/loss/verify') loss(
    @Req() req: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('itemId', new ParseUUIDPipe()) itemId: string,
    @Body() input: VerifyLossDto,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.operations.verifyLoss(req.auth, id, itemId, input, key);
  }
  @Post(':id/items/:itemId/unit/replace') replace(
    @Req() req: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('itemId', new ParseUUIDPipe()) itemId: string,
    @Body() input: ReplaceUnitDto,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.operations.replaceUnit(req.auth, id, itemId, input, key);
  }
  @Post(':id/handover') handover(
    @Req() req: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: HandoverDto,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.operations.handover(req.auth, id, input, key);
  }
  @Post(':id/items/:itemId/return-report/reject') reject(
    @Req() req: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('itemId', new ParseUUIDPipe()) itemId: string,
    @Body() input: RejectProofDto,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.operations.rejectReport(
      req.auth,
      id,
      itemId,
      input.reason,
      key,
    );
  }
  @Post(':id/items/:itemId/return/verify') verify(
    @Req() req: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('itemId', new ParseUUIDPipe()) itemId: string,
    @Body() input: VerifyReturnDto,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.operations.verifyReturn(req.auth, id, itemId, input, key);
  }
}
@Module({
  imports: [AuthModule, PaymentsModule, PricingModule, RisksModule],
  controllers: [CustomerReturnsController, AdminOperationsController],
  providers: [OperationsService, ExtensionDelayService],
  exports: [OperationsService],
})
export class OperationsModule {}
