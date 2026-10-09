import {
  Body,
  Controller,
  Get,
  Headers,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { AuthModule } from '../../auth/auth.module';
import { AuthRequest, ProofUploadRoute, Roles } from '../../auth/auth.guard';
import { PrismaModule } from '../../prisma/prisma.module';
import { PricingModule } from '../pricing/pricing.module';
import { PaymentsService } from './payments.service';
import { PaymentLedgerService } from './payment-ledger.service';
import {
  MAX_PROOF_BYTES,
  ProofStorageService,
  ProofUpload,
} from './proof-storage.service';
import {
  ReconcileReceiptDto,
  RejectProofDto,
  UploadProofDto,
  VerifyProofDto,
  CorrectReceiptDto,
  SettlementReceiptDto,
} from './payments.dto';
import { PaymentExpiryWorker } from './payment-expiry.worker';
import { RefundsService } from './refunds.service';
import { NoShowService } from './no-show.service';
import { ReceiptCorrectionsService } from './receipt-corrections.service';
import { NoShowWorker } from './no-show.worker';
import { RisksModule } from '../risks/risks.module';
import { DeliveryFailureDto } from './no-show.dto';
import {
  CancelBookingDto,
  RefundRecipientDto,
  TransferRefundDto,
} from './refunds.dto';

@Controller()
export class RefundsController {
  constructor(
    private readonly refunds: RefundsService,
    private readonly storage: ProofStorageService,
  ) {}

  @Post('bookings/:id/cancel') @Roles('customer') cancel(
    @Req() req: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: CancelBookingDto,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.refunds.cancel(req.auth, id, input.reason, key);
  }

  @Post('admin/bookings/:id/cancel') @Roles('admin') shopCancel(
    @Req() req: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: CancelBookingDto,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.refunds.cancel(req.auth, id, input.reason, key, true);
  }

  @Post('refunds/:id/recipient') @Roles('customer') recipient(
    @Req() req: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: RefundRecipientDto,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.refunds.recipient(req.auth, id, input, key);
  }

  @Post('admin/refunds/:id/approve') @Roles('admin') approve(
    @Req() req: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.refunds.approve(req.auth, id, key);
  }

  @Post('admin/refunds/:id/recipient') @Roles('admin') adminRecipient(
    @Req() req: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: RefundRecipientDto,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.refunds.recipient(req.auth, id, input, key);
  }

  @Post('admin/refunds/:id/reject') @Roles('admin') reject(
    @Req() req: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: RejectProofDto,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.refunds.reject(req.auth, id, input.reason, key);
  }

  @Post('admin/refunds/:id/transfer')
  @Roles('admin')
  @ProofUploadRoute()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_PROOF_BYTES, files: 1, fields: 4, parts: 5 },
    }),
  )
  transfer(
    @Req() req: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: TransferRefundDto,
    @UploadedFile() file: ProofUpload | undefined,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.refunds.transfer(req.auth, id, input, file, key);
  }

  @Get('refunds/:id/file') async download(
    @Req() req: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const proof = await this.refunds.proof(req.auth, id);
    const metadata = await this.storage.metadata(proof.path);
    const stream = await this.storage.download(proof.path);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; sandbox",
    );
    return new StreamableFile(stream, {
      type: metadata.mime,
      length: metadata.size,
      disposition:
        'attachment; filename="refund-' +
        proof.id +
        '.' +
        proof.path.split('.').pop() +
        '"',
    });
  }
}

@Controller('admin/bookings')
@Roles('admin')
export class NoShowController {
  constructor(private readonly noShow: NoShowService) {}

  @Get('delivery-follow-up') followUp(@Req() req: AuthRequest) {
    return this.noShow.followUp(req.auth);
  }
  @Post(':id/delivery/customer-failure') deliveryFailure(
    @Req() req: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: DeliveryFailureDto,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.noShow.deliveryFailure(req.auth, id, input, key);
  }
}

@Controller('bookings')
export class CustomerPaymentsController {
  constructor(private readonly payments: PaymentsService) {}
  @Get(':id/payments') detail(
    @Req() req: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.payments.detail(req.auth, id);
  }
  @Post(':id/obligations/:obligationId/proofs')
  @Roles('customer')
  @ProofUploadRoute()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_PROOF_BYTES, files: 1, fields: 1, parts: 2 },
    }),
  )
  upload(
    @Req() req: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('obligationId', new ParseUUIDPipe()) obligationId: string,
    @Body() input: UploadProofDto,
    @UploadedFile() file: ProofUpload | undefined,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.payments.upload(req.auth, id, obligationId, input, file, key);
  }
  @Post(':id/settlement') @Roles('customer') settlement(
    @Req() req: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.payments.settlement(req.auth, id, key);
  }
}

@Controller('payment-proofs')
export class PrivateProofsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly storage: ProofStorageService,
  ) {}
  @Get(':id/file') async download(
    @Req() req: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const proof = await this.payments.proof(req.auth, id);
    const stream = await this.storage.download(proof.proofPath);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; sandbox",
    );
    return new StreamableFile(stream, {
      type: proof.mime,
      length: proof.size,
      disposition:
        'attachment; filename="bukti-' +
        proof.id +
        '.' +
        proof.proofPath.split('.').pop() +
        '"',
    });
  }
}

@Controller('admin/bookings')
@Roles('admin')
export class AdminPaymentsController {
  constructor(private readonly payments: PaymentsService) {}
  @Post(':id/settlement') recordSettlement(
    @Req() req: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: SettlementReceiptDto,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.payments.recordSettlement(req.auth, id, input, key);
  }
  @Post(':id/payments/verify') verify(
    @Req() req: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: VerifyProofDto,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.payments.verify(req.auth, id, input, key);
  }
  @Post(':id/proofs/:proofId/reject') reject(
    @Req() req: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('proofId', new ParseUUIDPipe()) proofId: string,
    @Body() input: RejectProofDto,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.payments.reject(req.auth, id, proofId, input.reason, key);
  }
  @Post(':id/payments/reconcile') reconcile(
    @Req() req: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: ReconcileReceiptDto,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.payments.reconcile(req.auth, id, input, key);
  }
  @Post(':id/approve') approve(
    @Req() req: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.payments.approve(req.auth, id, key);
  }
}

@Controller('admin/bookings')
@Roles('admin')
class ReceiptCorrectionsController {
  constructor(private readonly corrections: ReceiptCorrectionsService) {}
  @Post(':id/payments/:paymentId/correct') correct(
    @Req() req: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('paymentId', new ParseUUIDPipe()) paymentId: string,
    @Body() input: CorrectReceiptDto,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.corrections.correct(req.auth, id, paymentId, input, key);
  }
}

@Module({
  imports: [PrismaModule, AuthModule, PricingModule, RisksModule],
  controllers: [
    CustomerPaymentsController,
    PrivateProofsController,
    AdminPaymentsController,
    RefundsController,
    NoShowController,
    ReceiptCorrectionsController,
  ],
  providers: [
    PaymentsService,
    PaymentLedgerService,
    ProofStorageService,
    PaymentExpiryWorker,
    RefundsService,
    NoShowService,
    ReceiptCorrectionsService,
    NoShowWorker,
  ],
  exports: [PaymentsService, PaymentLedgerService, ProofStorageService],
})
export class PaymentsModule {}
