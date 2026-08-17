import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { z } from 'zod';
import {
  pushSubscriptionSchema,
  sendTimesheetReminderSchema,
  unsubscribePushSchema,
  type NotificationDto,
  type PushPublicKeyResponse,
  type PushSubscriptionInput,
  type SendTimesheetReminderInput,
  type SendTimesheetReminderResponse,
  type UnsubscribePushInput,
} from '@fabxpert/shared/dto/notification.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { NotificationService } from './notification.service';
import { PushService } from './push.service';
import { TimesheetReminderService } from './timesheet-reminder.service';

const idParamSchema = z.string().trim().min(1);

@Controller('notifications')
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly pushService: PushService,
    private readonly timesheetReminderService: TimesheetReminderService,
  ) {}

  @Get()
  listMine(@CurrentUser() user: AuthenticatedUser): Promise<NotificationDto[]> {
    return this.notificationService.listForUser(user.id);
  }

  @Post(':id/dismiss')
  @HttpCode(HttpStatus.NO_CONTENT)
  dismiss(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ZodValidationPipe(idParamSchema)) id: string,
  ): Promise<void> {
    return this.notificationService.dismiss(user.id, id);
  }

  /** The app needs this key to call `pushManager.subscribe()`. */
  @Get('push/public-key')
  getPublicKey(): PushPublicKeyResponse {
    return { publicKey: this.pushService.getPublicKey() };
  }

  @Post('push/subscribe')
  @HttpCode(HttpStatus.NO_CONTENT)
  subscribe(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(pushSubscriptionSchema)) body: PushSubscriptionInput,
    @Headers('user-agent') userAgent?: string,
  ): Promise<void> {
    return this.notificationService.savePushSubscription(user.id, body, userAgent);
  }

  @Post('push/unsubscribe')
  @HttpCode(HttpStatus.NO_CONTENT)
  unsubscribe(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(unsubscribePushSchema)) body: UnsubscribePushInput,
  ): Promise<void> {
    return this.notificationService.removePushSubscription(user.id, body.endpoint);
  }

  /** Sends the reminder to a single person — the panou "Trimite notificare" button. */
  @Post('reminders/timesheet/send')
  @Roles('ADMIN')
  async sendTimesheetReminder(
    @Body(new ZodValidationPipe(sendTimesheetReminderSchema))
    body: SendTimesheetReminderInput,
  ): Promise<SendTimesheetReminderResponse> {
    return {
      pushDeviceCount: await this.timesheetReminderService.sendToPerson(body.personId),
    };
  }
}
