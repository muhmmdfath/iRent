import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthRequest, Roles, ProofUploadRoute } from '../../auth/auth.guard';
import { AuthModule } from '../../auth/auth.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { PricingModule } from '../pricing/pricing.module';
import { PaymentsModule } from '../payments/payments.module';
import {
  ReconcileReceiptDto,
  RejectProofDto,
  UploadProofDto,
  VerifyProofDto,
} from '../payments/payments.dto';
import {
  MAX_PROOF_BYTES,
  ProofUpload,
} from '../payments/proof-storage.service';
import {
  CreateExtensionDto,
  QuoteExtensionDto,
  SubmitExtensionDto,
} from './extensions.dto';
import { ExtensionsService } from './extensions.service';
import { ExtensionExpiryWorker } from './extensions.worker';
import { ExtensionDelayService } from './extension-delay.service';

@Controller('bookings/:bookingId/extensions')
export class CustomerExtensionsController {
  constructor(private readonly extensions: ExtensionsService) {}
  @Get(':id')
  @Header('Cache-Control', 'no-store')
  @Roles('customer', 'admin')
  detail(
    @Req() req: AuthRequest,
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.extensions.detail(req.auth, bookingId, id);
  }
  @Post() @Roles('customer') create(
    @Req() req: AuthRequest,
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
    @Body() input: CreateExtensionDto,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.extensions.create(req.auth, bookingId, input, key);
  }
  @Post(':id/submit') @Roles('customer') submit(
    @Req() req: AuthRequest,
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: SubmitExtensionDto,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.extensions.submit(req.auth, bookingId, id, input, key);
  }
  @Post(':id/cancel') @Roles('customer') cancel(
    @Req() req: AuthRequest,
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: RejectProofDto,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.extensions.cancel(req.auth, bookingId, id, input.reason, key);
  }
  @Post(':id/proofs')
  @Roles('customer')
  @ProofUploadRoute()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_PROOF_BYTES, files: 1, fields: 1, parts: 2 },
    }),
  )
  upload(
    @Req() req: AuthRequest,
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: UploadProofDto,
    @UploadedFile() file: ProofUpload | undefined,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.extensions.upload(req.auth, bookingId, id, input, file, key);
  }
}
@Controller('admin/bookings/:bookingId/extensions')
@Roles('admin')
export class AdminExtensionsController {
  constructor(private readonly extensions: ExtensionsService) {}
  @Post(':id/quote') quote(
    @Req() req: AuthRequest,
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: QuoteExtensionDto,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.extensions.quote(req.auth, bookingId, id, input, key);
  }
  @Post(':id/payments/verify') verify(
    @Req() req: AuthRequest,
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: VerifyProofDto,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.extensions.verify(req.auth, bookingId, id, input, key);
  }
  @Post(':id/proofs/:proofId/reject') rejectProof(
    @Req() req: AuthRequest,
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('proofId', new ParseUUIDPipe()) proofId: string,
    @Body() input: RejectProofDto,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.extensions.reject(
      req.auth,
      bookingId,
      id,
      input.reason,
      key,
      proofId,
    );
  }
  @Post(':id/reject') reject(
    @Req() req: AuthRequest,
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: RejectProofDto,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.extensions.reject(req.auth, bookingId, id, input.reason, key);
  }
  @Post(':id/approve') approve(
    @Req() req: AuthRequest,
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.extensions.approve(req.auth, bookingId, id, key);
  }
  @Post(':id/payments/reconcile') reconcile(
    @Req() req: AuthRequest,
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: ReconcileReceiptDto,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.extensions.reconcile(req.auth, bookingId, id, input, key);
  }
}
@Module({
  imports: [AuthModule, PrismaModule, PricingModule, PaymentsModule],
  controllers: [CustomerExtensionsController, AdminExtensionsController],
  providers: [ExtensionsService, ExtensionExpiryWorker, ExtensionDelayService],
  exports: [ExtensionsService],
})
export class ExtensionsModule {}
