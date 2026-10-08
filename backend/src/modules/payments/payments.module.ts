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
} from './payments.dto';
import { PaymentExpiryWorker } from './payment-expiry.worker';

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

@Module({
  imports: [PrismaModule, AuthModule, PricingModule],
  controllers: [
    CustomerPaymentsController,
    PrivateProofsController,
    AdminPaymentsController,
  ],
  providers: [
    PaymentsService,
    PaymentLedgerService,
    ProofStorageService,
    PaymentExpiryWorker,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
